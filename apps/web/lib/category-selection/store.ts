import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaOrFunction } from "@finance/data/schema";
import {
  CATEGORY_SELECTION_COOLDOWN_SECONDS,
  CATEGORY_SELECTION_RESERVATION_SECONDS,
  CATEGORY_SELECTION_WRITES_PER_MONTH,
  type CategorySelection,
} from "@finance/core/category-selection";
import type { Locale } from "@finance/core/i18n/locale";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import type {
  CategorySelectionRow,
  Database,
} from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import * as selections from "@finance/data/category-screen";
import type {
  CategorySelectionState,
  StoredSelectionPayload,
} from "@finance/data/category-screen";

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
 * That reset is why `categorySelectionWrites` (in
 * `@finance/data/category-screen`) exists rather than reading `writes`
 * directly: between the turn of the month and the first press of the
 * new one, the row still carries last month's count. Handing that straight to
 * `decideMonthReadWrite` would refuse a press for an allowance spent in a
 * month that is over — and worse, it would make a granted reservation look
 * declined, because the count comes back *lower* than it went in.
 *
 * Tolerant of the migration not having run, exactly as `category-read/store.ts`
 * is: `tracked: false` stops the model being asked at all, because a call that
 * cannot be counted is a call that is not capped.
 */

/** The band's stored order and its tally — `@finance/data/category-screen`'s. */
export async function readCategorySelectionState(
  userId: string,
  client?: Client,
): Promise<CategorySelectionState> {
  return selections.readCategorySelectionState(
    client ?? (await createClient()),
    userId,
  );
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
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as CategorySelectionRow;
  return {
    writes: selections.categorySelectionWrites(row),
    tally: selections.categorySelectionTally(row),
  };
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

  if (error && !isMissingSchemaOrFunction(error)) {
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
