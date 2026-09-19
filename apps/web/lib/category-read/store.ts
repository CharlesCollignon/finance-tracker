import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_READ_COOLDOWN_SECONDS,
  CATEGORY_READ_RESERVATION_SECONDS,
  CATEGORY_READ_WRITES_PER_MONTH,
  type CategoryRead,
} from "@finance/core/category-read";
import type { CategoryFacts } from "@finance/core/category-facts";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import { getCurrentMonth } from "@finance/core/constants";
import { monthColumnValue } from "@finance/core/month-close";
import type { CategoryReadRow, Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, parseLocale, type Locale } from "@finance/core/i18n/locale";

type Client = SupabaseClient<Database>;

/**
 * The database side of a category read.
 *
 * Reads go straight through row level security like any other query. Writes
 * go through the three `security definer` functions in migration 035 and
 * never through an UPDATE, for the reason `month-read/store.ts` gives at
 * length: a counter a client may write is a counter a client may set back to
 * zero.
 *
 * One thing here is not in that file, because migration 035's allowance is
 * shaped differently from 024's. `category_reads.writes` is this category's
 * own before/after signal, not the ceiling — the ceiling is counted across
 * every category, in `category_read_tallies`, so that twenty categories at
 * ten writes each is not a hundred calls inside a ten-write cap. Every
 * function below that needs to know what is left reads the tally
 * separately from the per-category row, and combines the two into one
 * `MonthReadTally`-shaped value so `decideMonthReadWrite` can be reused
 * unchanged: `writes` from the tally, `lastWrittenAt` and `pendingSince`
 * from the category's own row, because the cooldown is per category so that
 * pressing one does not lock the other nineteen.
 *
 * Tolerant of the migration not having run, exactly as `month-read/store.ts`
 * is: `tracked: false` stops the writer being asked at all, because a call
 * that cannot be counted is a call that is not capped.
 *
 * Also tolerant of the category having gone since the reservation was taken
 * — deleted mid-flight, most often. `reserve_category_read`,
 * `store_category_read` and `refund_category_read` all raise rather than
 * silently doing nothing when the category no longer belongs to the caller
 * (see 035's comments), and that raise is treated exactly like a missing
 * schema everywhere below: the call did not happen, and nothing here is
 * worth a 500 over. `refundWrite` needs no special case for it — it never
 * inspects the RPC's error at all, the same as `month-read/store.ts`'s, so a
 * raise there simply has nothing to propagate.
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

/** The ownership check in 035's functions raising: not yours, or not any more. */
function isGoneCategory(error: { message?: string } | null): boolean {
  return Boolean(
    error?.message && /is not a category of that user/.test(error.message),
  );
}

function toleratedRpcFailure(error: { code?: string; message?: string } | null): boolean {
  return isMissingSchema(error) || isGoneCategory(error);
}

export interface StoredCategoryRead {
  read: CategoryRead | null;
  facts: CategoryFacts | null;
  writtenAt: string | null;
  model: string | null;
  promptVersion: number | null;
  trimmed: number;
  /** The language the prose was written in. Null means English; see `month-read/store.ts`. */
  locale: Locale;
}

export interface CategoryReadState {
  /** Null when nothing has ever been written for this category. */
  stored: StoredCategoryRead | null;
  /**
   * This category's own before/after attempt counter, read off
   * `category_reads.writes`. Not the ceiling — see the module doc.
   */
  writes: number;
  /**
   * The tally `decideMonthReadWrite` is checked against: `writes` is the
   * cross-category count from `category_read_tallies`, `lastWrittenAt` and
   * `pendingSince` are this category's own.
   */
  tally: MonthReadTally;
  /** False when migration 035 has not run. */
  tracked: boolean;
}

const EMPTY_TALLY: MonthReadTally = {
  writes: 0,
  refused: 0,
  lastWrittenAt: null,
  pendingSince: null,
};

function thisMonthColumn(): string {
  const { year, month } = getCurrentMonth();
  return monthColumnValue(year, month);
}

function toStored(row: CategoryReadRow): StoredCategoryRead {
  return {
    read: (row.read as CategoryRead | null) ?? null,
    facts: (row.facts as CategoryFacts | null) ?? null,
    writtenAt: row.written_at,
    model: row.model,
    promptVersion: row.prompt_version,
    trimmed: row.trimmed,
    locale: parseLocale(row.locale) ?? DEFAULT_LOCALE,
  };
}

/**
 * The cross-category ceiling for the month in progress, or null when the
 * schema is absent. Read on its own — never folded into `toStored` — because
 * every caller below needs it whether or not this category has ever been
 * read.
 */
async function readTallyWrites(
  userId: string,
  supabase: Client,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("category_read_tallies")
    .select("writes")
    .eq("user_id", userId)
    .eq("month", thisMonthColumn())
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  return data?.writes ?? 0;
}

/**
 * The cross-category ceiling on its own, for a screen that needs to show
 * "N left" without asking about any one category. `tracked` is false when
 * migration 035 has not run.
 */
export async function readCategoryReadTally(
  userId: string,
  client?: Client,
): Promise<{ writes: number; tracked: boolean }> {
  const supabase = client ?? (await createClient());
  const writes = await readTallyWrites(userId, supabase);
  return writes === null
    ? { writes: 0, tracked: false }
    : { writes, tracked: true };
}

/**
 * Every stored read this user has, across every category, keyed by category
 * id. For the by-category screen: every card on that page is drawn up front,
 * findings and all, and the reads sit beside them rather than behind a
 * second round trip per panel opened.
 *
 * Rows with nothing successfully written yet (`read` still null) are
 * included rather than filtered out, so a caller can tell "never asked"
 * apart from "asked and nothing survived" if it ever needs to.
 */
export async function listStoredCategoryReads(
  userId: string,
  client?: Client,
): Promise<{ byCategory: Map<string, StoredCategoryRead>; tracked: boolean }> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("category_reads")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return { byCategory: new Map(), tracked: false };
    }
    throw error;
  }

  const byCategory = new Map<string, StoredCategoryRead>();
  for (const row of (data ?? []) as CategoryReadRow[]) {
    byCategory.set(row.category_id, toStored(row));
  }
  return { byCategory, tracked: true };
}

export async function readCategoryReadState(
  userId: string,
  categoryId: string,
  client?: Client,
): Promise<CategoryReadState> {
  const supabase = client ?? (await createClient());

  const [{ data, error }, tallyWrites] = await Promise.all([
    supabase
      .from("category_reads")
      .select("*")
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .maybeSingle(),
    readTallyWrites(userId, supabase),
  ]);

  if (error && !isMissingSchema(error)) {
    throw error;
  }

  if (error || tallyWrites === null) {
    return { stored: null, writes: 0, tally: EMPTY_TALLY, tracked: false };
  }

  const row = data as CategoryReadRow | null;

  return {
    stored: row ? toStored(row) : null,
    writes: row?.writes ?? 0,
    tally: {
      writes: tallyWrites,
      refused: row?.refused ?? 0,
      lastWrittenAt: row?.last_written_at ?? null,
      pendingSince: row?.pending_since ?? null,
    },
    tracked: true,
  };
}

export interface ReservedCategoryRead {
  /** This category's own before/after attempt counter, after the call. */
  writes: number;
  /** The tally as it stands afterwards, read fresh — see the module doc. */
  tally: MonthReadTally;
}

/**
 * Take an attempt, if the allowance permits.
 *
 * Null when the reservation was declined, the schema is absent, or the
 * category is no longer the caller's. The caller compares `writes` with what
 * it saw before to know whether the reservation was granted — the RPC's own
 * return cannot say, because "declined" and "granted" both come back as a
 * row (migration 035's comment on `reserve_category_read`).
 */
export async function reserveWrite(
  userId: string,
  categoryId: string,
  client?: Client,
): Promise<ReservedCategoryRead | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("reserve_category_read", {
    target_user: userId,
    target_category: categoryId,
    allowance: CATEGORY_READ_WRITES_PER_MONTH,
    cooldown_seconds: CATEGORY_READ_COOLDOWN_SECONDS,
    reservation_seconds: CATEGORY_READ_RESERVATION_SECONDS,
  });

  if (error) {
    if (toleratedRpcFailure(error)) {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as CategoryReadRow;
  const tallyWrites = await readTallyWrites(userId, supabase);
  if (tallyWrites === null) {
    return null;
  }

  return {
    writes: row.writes,
    tally: {
      writes: tallyWrites,
      refused: row.refused,
      lastWrittenAt: row.last_written_at,
      pendingSince: row.pending_since,
    },
  };
}

/** Land a finished attempt. `read` null means nothing survived verification. */
export async function storeWrite(
  userId: string,
  categoryId: string,
  payload: {
    read: CategoryRead | null;
    facts: CategoryFacts | null;
    digest: string | null;
    trimmed: number;
    model: string;
    promptVersion: number;
    refusedDelta: number;
    /** The language the prose is in, stored so it can be rendered in it. */
    locale: Locale;
  },
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.rpc("store_category_read", {
    target_user: userId,
    target_category: categoryId,
    new_read: payload.read as never,
    new_facts: payload.facts as never,
    new_digest: payload.digest,
    new_trimmed: payload.trimmed,
    new_model: payload.model,
    new_prompt_version: payload.promptVersion,
    new_locale: payload.locale,
    refused_delta: payload.refusedDelta,
  });

  if (error && !toleratedRpcFailure(error)) {
    throw error;
  }
}

/**
 * Hand back an attempt that never reached the provider.
 *
 * Never fatal. A refund that fails leaves the user one attempt worse off,
 * which is a far better outcome than an error on a press whose real problem
 * was that a model could not be reached — see `month-read/store.ts`. This
 * never inspects the RPC's own error, deliberately: whether it is a missing
 * schema, a category deleted mid-flight, or anything else, the outcome here
 * is the same, so there is nothing to branch on.
 */
export async function refundWrite(
  userId: string,
  categoryId: string,
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  try {
    await supabase.rpc("refund_category_read", {
      target_user: userId,
      target_category: categoryId,
    });
  } catch {
    // Deliberately swallowed; see above.
  }
}
