import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_SELECTION_COOLDOWN_SECONDS,
  CATEGORY_SELECTION_RESERVATION_SECONDS,
  CATEGORY_SELECTION_WRITES_PER_MONTH,
  type CategorySelection,
} from "@finance/core/category-selection";
import { getCurrentMonth } from "@finance/core/constants";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import { monthColumnValue } from "@finance/core/month-close";
import type { CategorySelectionRow, Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * The database side of the band's order.
 *
 * Reads go straight through row level security like any other query. Writes
 * go through the three `security definer` functions in migration 035 and
 * never through an UPDATE, for the reason `month-read/store.ts` gives at
 * length: a counter a client may write is a counter a client may set back to
 * zero.
 *
 * ## One row, and the tally on it
 *
 * There is one order per user, so — unlike the category read, whose allowance
 * is counted across categories in a table of its own — the count lives on the
 * same row as the thing it counts. It carries the month it belongs to, and
 * `reserve_category_selection` resets it inside the reservation statement
 * when that month is not the current one, so nothing has to remember to.
 *
 * That reset is why `effectiveWrites` below exists rather than reading
 * `writes` directly: between the turn of the month and the first press of the
 * new one, the row still carries last month's count. Handing that straight to
 * `decideMonthReadWrite` would refuse a press for an allowance spent in a
 * month that is over — and worse, it would make a granted reservation look
 * declined, because the count comes back *lower* than it went in.
 *
 * Tolerant of the migration not having run, exactly as `category-read/store.ts`
 * is: `tracked: false` stops the model being asked at all, because a call that
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

/**
 * What is stored beside the order.
 *
 * The locale is kept *inside* the `selection` jsonb rather than in a column
 * of its own, because migration 035 gives this table none — the read's table
 * has one, the selection's does not. A remark is the model's own prose with
 * no app label spliced into it, so it is not the two-halves nonsense a
 * mixed-language read would be; but it is still written in one language, and
 * the band says so by showing remarks only to a reader in that language. The
 * order itself has no language and is applied either way.
 */
interface StoredSelectionPayload extends CategorySelection {
  locale: Locale;
}

export interface StoredCategorySelection {
  selection: CategorySelection;
  /** The findings it was chosen from. Null means it cannot be trusted at all. */
  digest: string | null;
  /** The language the remarks are in. */
  locale: Locale;
}

export interface CategorySelectionState {
  /** Null when no order has ever been stored for this user. */
  stored: StoredCategorySelection | null;
  /** The tally `decideMonthReadWrite` is checked against, month-corrected. */
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

/** The count, ignoring one left over from a month that has since turned. */
function effectiveWrites(row: CategorySelectionRow | null): number {
  if (!row || row.tally_month !== thisMonthColumn()) {
    return 0;
  }
  return row.writes;
}

function toTally(row: CategorySelectionRow | null): MonthReadTally {
  if (!row) {
    return EMPTY_TALLY;
  }
  return {
    writes: effectiveWrites(row),
    refused: row.refused,
    lastWrittenAt: row.last_written_at,
    pendingSince: row.pending_since,
  };
}

/**
 * The order as stored, or null.
 *
 * Defensive about the jsonb's shape rather than trusting it: a row written by
 * an older version of this app, or by hand, must not take the screen down.
 * An unreadable payload is treated as no order at all, which falls back to
 * the app's own — the same direction every other failure here falls.
 */
function toStored(row: CategorySelectionRow): StoredCategorySelection | null {
  const payload = row.selection as Partial<StoredSelectionPayload> | null;
  if (!payload || !Array.isArray(payload.picks) || payload.picks.length === 0) {
    return null;
  }

  const picks = payload.picks
    .filter((pick): pick is { id: string; remark?: string } =>
      Boolean(pick && typeof pick.id === "string"),
    )
    .map((pick) => ({
      id: pick.id,
      ...(typeof pick.remark === "string" && pick.remark
        ? { remark: pick.remark }
        : {}),
    }));

  // An order with nothing in it is not an order. Returning one would light
  // the band's "chosen by a model" note over a list still in the app's own
  // sequence, which is a claim about the screen that is not true of it.
  if (picks.length === 0) {
    return null;
  }

  return {
    selection: { picks },
    digest: row.findings_digest,
    locale: parseLocale(payload.locale) ?? DEFAULT_LOCALE,
  };
}

export async function readCategorySelectionState(
  userId: string,
  client?: Client,
): Promise<CategorySelectionState> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .from("category_selections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { stored: null, tally: EMPTY_TALLY, tracked: false };
    }
    throw error;
  }

  const row = (data as CategorySelectionRow | null) ?? null;

  return {
    stored: row ? toStored(row) : null,
    tally: toTally(row),
    tracked: true,
  };
}

export interface ReservedCategorySelection {
  /** The count after the call, month-corrected. */
  writes: number;
  tally: MonthReadTally;
}

/**
 * Take an attempt, if the allowance permits.
 *
 * Null when the schema is absent. The caller compares `writes` with what it
 * saw before to know whether the reservation was granted — the RPC's own
 * return cannot say, because "declined" and "granted" both come back as a row
 * (migration 035's comment on `reserve_category_selection`). Both sides of
 * that comparison are month-corrected, so the first press of a new month
 * reads as 0 → 1 rather than as 5 → 1, which would say "declined" about a
 * reservation that was in fact granted.
 */
export async function reserveSelection(
  userId: string,
  client?: Client,
): Promise<ReservedCategorySelection | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("reserve_category_selection", {
    target_user: userId,
    allowance: CATEGORY_SELECTION_WRITES_PER_MONTH,
    cooldown_seconds: CATEGORY_SELECTION_COOLDOWN_SECONDS,
    reservation_seconds: CATEGORY_SELECTION_RESERVATION_SECONDS,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as CategorySelectionRow;
  return { writes: effectiveWrites(row), tally: toTally(row) };
}

/** Land a finished attempt. `selection` null means nothing survived. */
export async function storeSelection(
  userId: string,
  payload: {
    selection: CategorySelection | null;
    digest: string | null;
    model: string;
    promptVersion: number;
    refusedDelta: number;
    /** The language the remarks are in, stored so they can be shown in it. */
    locale: Locale;
  },
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const stored: StoredSelectionPayload | null = payload.selection
    ? { ...payload.selection, locale: payload.locale }
    : null;

  const { error } = await supabase.rpc("store_category_selection", {
    target_user: userId,
    new_selection: stored as never,
    new_digest: payload.digest,
    new_model: payload.model,
    new_prompt_version: payload.promptVersion,
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
 * was that a model could not be reached — see `month-read/store.ts`.
 */
export async function refundSelection(
  userId: string,
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  try {
    await supabase.rpc("refund_category_selection", { target_user: userId });
  } catch {
    // Deliberately swallowed; see above.
  }
}
