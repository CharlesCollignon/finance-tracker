import type { CategoryFacts } from "@finance/core/category-facts";
import type { CategoryRead } from "@finance/core/category-read";
import {
  buildCategoryScreen,
  CATEGORY_MONTHS_READ,
  hasStoredRead,
  type CategoryScreen,
} from "@finance/core/category-screen";
import type { CategorySelection } from "@finance/core/category-selection";
import { getCurrentMonth, shiftMonth } from "@finance/core/constants";
import {
  FALLBACK_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import { monthColumnValue } from "@finance/core/month-close";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import { allRows } from "@finance/core/paging";
import type {
  CategoryReadRow,
  CategorySelectionRow,
  TransactionWithCategory,
} from "@finance/core/types/database";

import type { Db } from "./client";
import { getMonthlySummary } from "./month-ledger";
import { isMissingSchemaOrFunction } from "./schema";

/**
 * The by-category screen's reads, for both apps: the rows of the window,
 * the stored category reads and their allowance, and the band's stored
 * order — then `buildCategoryScreen` over them.
 *
 * Reads go straight through row level security like any other query; the
 * writes that fill these tables are the web's, through migration 035's
 * `security definer` functions, and stay there. Tolerant of that migration
 * not having run: `tracked: false` stops a model being asked at all,
 * because a call that cannot be counted is a call that is not capped.
 */

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

/* ------------------------------------------------------ category reads */

export interface StoredCategoryRead {
  read: CategoryRead | null;
  facts: CategoryFacts | null;
  writtenAt: string | null;
  model: string | null;
  promptVersion: number | null;
  trimmed: number;
  /** The language the prose was written in. Null means English. */
  locale: Locale;
}

export function storedCategoryRead(row: CategoryReadRow): StoredCategoryRead {
  return {
    read: (row.read as CategoryRead | null) ?? null,
    facts: (row.facts as CategoryFacts | null) ?? null,
    writtenAt: row.written_at,
    model: row.model,
    promptVersion: row.prompt_version,
    trimmed: row.trimmed,
    locale: parseLocale(row.locale) ?? FALLBACK_LOCALE,
  };
}

/**
 * The cross-category ceiling for the month in progress, or null when the
 * schema is absent. Counted across every category, so twenty categories at
 * ten writes each is not a hundred calls inside a ten-write cap.
 */
export async function categoryReadTallyWrites(
  db: Db,
  userId: string,
): Promise<number | null> {
  const { data, error } = await db
    .from("category_read_tallies")
    .select("writes")
    .eq("user_id", userId)
    .eq("month", thisMonthColumn())
    .maybeSingle();

  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  return data?.writes ?? 0;
}

/** The ceiling on its own, for "N left" without asking about one category. */
export async function readCategoryReadTally(
  db: Db,
  userId: string,
): Promise<{ writes: number; tracked: boolean }> {
  const writes = await categoryReadTallyWrites(db, userId);
  return writes === null
    ? { writes: 0, tracked: false }
    : { writes, tracked: true };
}

/**
 * Every stored read, keyed by category id. Rows with nothing successfully
 * written yet (`read` still null) are included, so "never asked" can be told
 * apart from "asked and nothing survived".
 */
export async function listStoredCategoryReads(
  db: Db,
  userId: string,
): Promise<{ byCategory: Map<string, StoredCategoryRead>; tracked: boolean }> {
  const { data, error } = await db
    .from("category_reads")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return { byCategory: new Map(), tracked: false };
    }
    throw error;
  }

  const byCategory = new Map<string, StoredCategoryRead>();
  for (const row of (data ?? []) as CategoryReadRow[]) {
    byCategory.set(row.category_id, storedCategoryRead(row));
  }
  return { byCategory, tracked: true };
}

/* ---------------------------------------------------- the band's order */

/**
 * What is stored beside the order. The locale is kept inside the jsonb,
 * because migration 035 gives this table no column for it.
 */
export interface StoredSelectionPayload extends CategorySelection {
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

/**
 * The count, ignoring one left over from a month that has since turned:
 * `reserve_category_selection` resets it only on the first press of the new
 * month, and until then the row still carries last month's.
 */
export function categorySelectionWrites(
  row: CategorySelectionRow | null,
): number {
  if (!row || row.tally_month !== thisMonthColumn()) {
    return 0;
  }
  return row.writes;
}

export function categorySelectionTally(
  row: CategorySelectionRow | null,
): MonthReadTally {
  if (!row) {
    return EMPTY_TALLY;
  }
  return {
    writes: categorySelectionWrites(row),
    refused: row.refused,
    lastWrittenAt: row.last_written_at,
    pendingSince: row.pending_since,
  };
}

/**
 * The order as stored, or null. Defensive about the jsonb's shape: a row
 * written by an older version, or by hand, falls back to the app's own
 * order rather than taking the screen down. An order with nothing in it is
 * not an order — returning one would light the band's "chosen by a model"
 * note over a list still in the app's own sequence.
 */
export function storedCategorySelection(
  row: CategorySelectionRow,
): StoredCategorySelection | null {
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

  if (picks.length === 0) {
    return null;
  }

  return {
    selection: { picks },
    digest: row.findings_digest,
    locale: parseLocale(payload.locale) ?? FALLBACK_LOCALE,
  };
}

export async function readCategorySelectionState(
  db: Db,
  userId: string,
): Promise<CategorySelectionState> {
  const { data, error } = await db
    .from("category_selections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return { stored: null, tally: EMPTY_TALLY, tracked: false };
    }
    throw error;
  }

  const row = (data as CategorySelectionRow | null) ?? null;
  return {
    stored: row ? storedCategorySelection(row) : null,
    tally: categorySelectionTally(row),
    tracked: true,
  };
}

/* ---------------------------------------------------------- the screen */

export interface CategoryScreenRead {
  screen: CategoryScreen;
  /** The category reads' shared allowance this month. */
  readTally: { writes: number; tracked: boolean };
  /** The band's order: its allowance, and whether it is counted at all. */
  selection: { tally: MonthReadTally; tracked: boolean };
}

/**
 * Everything the by-category screen draws, in one round-trip stage — and a
 * second only when a stored read needs this month's expenses for its
 * `share-of-month`, which on every load before anyone has pressed the
 * button does not run at all.
 */
export async function readCategoryScreen(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<CategoryScreenRead> {
  const current = getCurrentMonth();
  const oldest = shiftMonth(
    current.year,
    current.month,
    -(CATEGORY_MONTHS_READ - 1),
  );
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const [rows, { byCategory: storedReads }, readTally, selectionState] =
    await Promise.all([
      // Months of every category at once, so paged past the row cap.
      allRows((start, end) =>
        db
          .from("transactions")
          .select("*, categories(name, type, icon, counts_toward_summary)")
          .eq("user_id", userId)
          .gte("occurred_on", from)
          .order("occurred_on", { ascending: false })
          .order("id")
          .range(start, end),
      ),
      listStoredCategoryReads(db, userId),
      readCategoryReadTally(db, userId),
      readCategorySelectionState(db, userId),
    ]);

  const summary = hasStoredRead(storedReads)
    ? await getMonthlySummary(
        db,
        userId,
        current.year,
        current.month,
        "current",
      )
    : null;

  return {
    screen: buildCategoryScreen({
      rows: rows as TransactionWithCategory[],
      year: current.year,
      month: current.month,
      locale,
      storedReads,
      storedSelection: selectionState.stored,
      monthExpenses: summary?.expenses ?? null,
    }),
    readTally,
    selection: { tally: selectionState.tally, tracked: selectionState.tracked },
  };
}
