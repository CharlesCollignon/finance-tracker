import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WALLET_READS_PER_MONTH,
  WALLET_READ_COOLDOWN_SECONDS,
  WALLET_READ_RESERVATION_SECONDS,
} from "@finance/core/wallet-read-budget";
import type { LookThroughFacts } from "@finance/core/look-through-facts";
import type { WalletRead } from "@finance/core/wallet-read";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import { monthColumnValue } from "@finance/core/month-close";
import { getCurrentMonth } from "@finance/core/constants";
import type { Database, WalletReadRow } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";

type Client = SupabaseClient<Database>;

/**
 * The database side of a wallet read.
 *
 * Read straight through row level security, written only via the three
 * `security definer` functions in migration 033 — because a counter a client
 * may UPDATE is a counter a client may reset. The shape is
 * `lib/bearing/store.ts` exactly.
 *
 * Tolerant of the migration not having run, for the same reason the other two
 * stores are: a missing optional table must not take down a surface whose
 * arithmetic works perfectly well without it. Somebody who has not applied
 * 033 still gets the whole look-through, with no Review button.
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

/** The month the allowance is counted in. */
function thisMonthColumn(): string {
  const { year, month } = getCurrentMonth();
  return monthColumnValue(year, month);
}

export interface StoredWalletRead {
  read: WalletRead | null;
  facts: LookThroughFacts | null;
  factsDigest: string | null;
  readAt: string | null;
  model: string | null;
  promptVersion: number | null;
  dropped: number;
  /**
   * The language the prose is in.
   *
   * Prose stays in the language it was written in, so the labels spliced
   * into it have to as well — the reasoning `028` recorded for a month read.
   */
  locale: Locale;
  tally: MonthReadTally;
  tallyMonth: string;
}

export interface WalletReadState {
  /** Null when nothing has ever been read. */
  stored: StoredWalletRead | null;
  /** False when migration 033 has not run. */
  tracked: boolean;
}

function toStored(row: WalletReadRow): StoredWalletRead {
  const current = thisMonthColumn();
  return {
    read: (row.read as WalletRead | null) ?? null,
    facts: (row.facts as LookThroughFacts | null) ?? null,
    factsDigest: row.facts_digest,
    readAt: row.read_at,
    model: row.model,
    promptVersion: row.prompt_version,
    dropped: row.dropped,
    locale: parseLocale(row.locale) ?? DEFAULT_LOCALE,
    tally: {
      // A tally from a month that has passed is not this month's tally. The
      // database resets it on the next reservation, but a page rendered
      // before that would otherwise say "none left" on the first of the month.
      writes: row.tally_month < current ? 0 : row.writes,
      refused: row.refused,
      lastWrittenAt: row.last_written_at,
      pendingSince: row.pending_since,
    },
    tallyMonth: row.tally_month,
  };
}

export async function readWalletReadState(
  userId: string,
  client?: Client,
): Promise<WalletReadState> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("wallet_reads")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { stored: null, tracked: false };
    }
    throw error;
  }

  return {
    stored: data ? toStored(data as WalletReadRow) : null,
    tracked: true,
  };
}

/**
 * Take an attempt, if the allowance permits.
 *
 * Returns the tally as it stands afterwards, or null when the schema is
 * absent. The caller compares `writes` with what it saw before to learn
 * whether the reservation was granted — the function cannot say, because
 * "declined" and "granted" both come back as a row.
 */
export async function reserveWalletRead(
  userId: string,
  client?: Client,
): Promise<MonthReadTally | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("reserve_wallet_read", {
    target_user: userId,
    this_month: thisMonthColumn(),
    allowance: WALLET_READS_PER_MONTH,
    cooldown_seconds: WALLET_READ_COOLDOWN_SECONDS,
    reservation_seconds: WALLET_READ_RESERVATION_SECONDS,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  return data ? toStored(data as WalletReadRow).tally : null;
}

/** Land a finished attempt. A null `read` means nothing survived. */
export async function storeWalletRead(
  userId: string,
  payload: {
    read: WalletRead | null;
    facts: LookThroughFacts | null;
    digest: string | null;
    dropped: number;
    model: string;
    promptVersion: number;
    locale: Locale;
    refusedDelta: number;
  },
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.rpc("store_wallet_read", {
    target_user: userId,
    new_read: payload.read as never,
    new_facts: payload.facts as never,
    new_digest: payload.digest,
    new_dropped: payload.dropped,
    new_model: payload.model,
    new_prompt_version: payload.promptVersion,
    new_locale: payload.locale,
    refused_delta: payload.refusedDelta,
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
export async function refundWalletRead(
  userId: string,
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  try {
    await supabase.rpc("refund_wallet_read", { target_user: userId });
  } catch {
    // Swallowed on purpose: see above.
  }
}
