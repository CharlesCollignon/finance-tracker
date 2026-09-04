import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MONTH_READ_COOLDOWN_SECONDS,
  MONTH_READ_RESERVATION_SECONDS,
  MONTH_READ_WRITES_PER_MONTH,
  type MonthReadTally,
} from "@finance/core/month-read-budget";
import type { MonthFacts } from "@finance/core/month-facts";
import type { MonthRead } from "@finance/core/month-read";
import { monthColumnValue } from "@finance/core/month-close";
import type { Database, MonthReadRow } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * The database side of a month read.
 *
 * Reads go straight through row level security like any other query. Writes
 * go through the three `security definer` functions in migration 024 and
 * never through an UPDATE, because a counter a client may write is a counter
 * a client may set back to zero.
 *
 * Tolerant of the migration not having run, exactly as `lib/bank/pull.ts`
 * and `lib/queries/bank-balance.ts` are: an optional feature's missing table
 * must not take down the Month page. The difference from those is that
 * `tracked: false` here *stops the writer being asked at all* — a call that
 * cannot be counted is a call that is not capped.
 */

function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    // No such function: the migration-not-run case for an RPC.
    error?.code === "42883"
  );
}

export interface StoredMonthRead {
  read: MonthRead | null;
  facts: MonthFacts | null;
  writtenAt: string | null;
  model: string | null;
  promptVersion: number | null;
  trimmed: number;
  tally: MonthReadTally;
}

export interface MonthReadState {
  /** Null when nothing has ever been written for this month. */
  stored: StoredMonthRead | null;
  /** False when migration 024 has not run. */
  tracked: boolean;
}

function toStored(row: MonthReadRow): StoredMonthRead {
  return {
    read: (row.read as MonthRead | null) ?? null,
    facts: (row.facts as MonthFacts | null) ?? null,
    writtenAt: row.written_at,
    model: row.model,
    promptVersion: row.prompt_version,
    trimmed: row.trimmed,
    tally: {
      writes: row.writes,
      refused: row.refused,
      lastWrittenAt: row.last_written_at,
      pendingSince: row.pending_since,
    },
  };
}

export async function readMonthReadState(
  userId: string,
  year: number,
  month: number,
  client?: Client,
): Promise<MonthReadState> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("month_reads")
    .select("*")
    .eq("user_id", userId)
    .eq("month", monthColumnValue(year, month))
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { stored: null, tracked: false };
    }
    throw error;
  }

  return {
    stored: data ? toStored(data as MonthReadRow) : null,
    tracked: true,
  };
}

/**
 * Take an attempt, if the allowance permits.
 *
 * Returns the row as it stands afterwards, or null when the reservation was
 * declined or the schema is absent. The caller compares `writes` with what it
 * saw before to know which happened — the function itself cannot say, because
 * "declined" and "granted" both come back as a row.
 */
export async function reserveWrite(
  userId: string,
  year: number,
  month: number,
  client?: Client,
): Promise<MonthReadTally | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("reserve_month_read", {
    target_user: userId,
    target_month: monthColumnValue(year, month),
    allowance: MONTH_READ_WRITES_PER_MONTH,
    cooldown_seconds: MONTH_READ_COOLDOWN_SECONDS,
    reservation_seconds: MONTH_READ_RESERVATION_SECONDS,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  return data ? toStored(data as MonthReadRow).tally : null;
}

/** Land a finished attempt. `read` null means nothing survived verification. */
export async function storeWrite(
  userId: string,
  year: number,
  month: number,
  payload: {
    read: MonthRead | null;
    facts: MonthFacts | null;
    digest: string | null;
    trimmed: number;
    model: string;
    promptVersion: number;
    refusedDelta: number;
  },
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.rpc("store_month_read", {
    target_user: userId,
    target_month: monthColumnValue(year, month),
    new_read: payload.read as never,
    new_facts: payload.facts as never,
    new_digest: payload.digest,
    new_trimmed: payload.trimmed,
    new_model: payload.model,
    new_prompt_version: payload.promptVersion,
    refused_delta: payload.refusedDelta,
    new_source: "pressed",
  });

  if (error && !isMissingSchema(error)) {
    throw error;
  }
}

/**
 * Hand back an attempt that never reached the provider.
 *
 * Never fatal. A refund that fails leaves the user one attempt worse off,
 * which is a far better outcome than an error on a press whose real problem
 * was that a model could not be reached.
 */
export async function refundWrite(
  userId: string,
  year: number,
  month: number,
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  try {
    await supabase.rpc("refund_month_read", {
      target_user: userId,
      target_month: monthColumnValue(year, month),
    });
  } catch {
    // Deliberately swallowed; see above.
  }
}
