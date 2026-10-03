import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaOrFunction } from "@finance/data/schema";
import {
  CATEGORY_READ_COOLDOWN_SECONDS,
  CATEGORY_READ_RESERVATION_SECONDS,
  CATEGORY_READ_WRITES_PER_MONTH,
  type CategoryRead,
} from "@finance/core/category-read";
import type { CategoryFacts } from "@finance/core/category-facts";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import type { CategoryReadRow, Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@finance/core/i18n/locale";
import * as categoryReads from "@finance/data/category-screen";
import type { StoredCategoryRead } from "@finance/data/category-screen";

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

/** The ownership check in 035's functions raising: not yours, or not any more. */
function isGoneCategory(error: { message?: string } | null): boolean {
  return Boolean(
    error?.message && /is not a category of that user/.test(error.message),
  );
}

/**
 * Postgres refusing to run two statements that met on the same rows.
 *
 * `reserve_category_read` takes the tally's row lock and then the read's;
 * `refund_category_read` takes them the other way about. A reserve and a
 * refund arriving together on one category can therefore deadlock, and
 * Postgres resolves it by raising `40P01` in one of them. The refund side
 * never inspects its own error and so fails safe already; the reserve side
 * rethrows anything it does not recognise, which let a deadlock out through
 * `writeCategoryRead`, whose doc comment promises that nothing there throws.
 *
 * `40001` is the same class of answer under a stricter isolation level, and
 * is here so that raising one later does not reopen this.
 *
 * Tolerated, not fixed: locking the two tables in one order in both functions
 * is the real repair and it belongs in the migration, not in this file. The
 * failure mode of tolerating it is mild — the press comes back as "already in
 * flight", and any reservation that was taken ages out on its own — while the
 * failure mode of letting it through is a 500 on a button whose worst honest
 * outcome is "not this time".
 */
function isLockContention(error: { code?: string } | null): boolean {
  return error?.code === "40P01" || error?.code === "40001";
}

function toleratedRpcFailure(
  error: { code?: string; message?: string } | null,
): boolean {
  return (
    isMissingSchemaOrFunction(error) ||
    isGoneCategory(error) ||
    isLockContention(error)
  );
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
    categoryReads.categoryReadTallyWrites(supabase, userId),
  ]);

  if (error && !isMissingSchemaOrFunction(error)) {
    throw error;
  }

  if (error || tallyWrites === null) {
    return { stored: null, writes: 0, tally: EMPTY_TALLY, tracked: false };
  }

  const row = data as CategoryReadRow | null;

  return {
    stored: row ? categoryReads.storedCategoryRead(row) : null,
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
  const tallyWrites = await categoryReads.categoryReadTallyWrites(
    supabase,
    userId,
  );
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
