/**
 * What the Journal shows, worked out once for both apps: the rows a filter
 * keeps, the planned rows it keeps, the figures over what is on screen, and
 * the days the list is read in.
 *
 * The two Journals had each written these for themselves, and had drifted:
 * the web searched the category name and the note as one joined string, so
 * a query could match across the seam between them, while the phone looked
 * in each on its own. Each field on its own is the rule now, and an amount
 * typed finds the rows of that amount (`@finance/core/ledger-search`).
 *
 * A month is read as what has happened or as what is still to come
 * (`LedgerTime`, `ledgerShowing`) — the week strip that cut it into weeks
 * went in October 2026, at the owner's ask — and in either order
 * (`LedgerOrder`).
 */

import type { PlannedOccurrence } from "./apply-recurring";
import { matchesNeedle, searchNeedle } from "./ledger-search";
import type { CategoryType, TransactionWithCategory } from "./types/database";

export type LedgerTypeFilter = "all" | CategoryType;

export interface LedgerFilter {
  type: LedgerTypeFilter;
  /** A category id, or "all". */
  categoryId: string;
  /** What was typed in the search box, as typed. */
  query: string;
  /**
   * A bank account's id, or "all": with several current accounts, only the
   * rows that one brought in. Read through `accountOf`.
   */
  accountId?: string;
}

/** Which end of the month the list starts from. */
export type LedgerOrder = "newest" | "oldest";

/**
 * What the list shows: the rows that have happened, or the ones the charges
 * still call for.
 */
export type LedgerTime = "past" | "upcoming";

export interface LedgerDay {
  /** YYYY-MM-DD. */
  date: string;
  /** The day's recorded rows, in the order they were given. */
  rows: TransactionWithCategory[];
  /** The day's planned rows, after its recorded ones. */
  planned: PlannedOccurrence[];
  /**
   * What the day did: income in, everything else out. Planned rows are left
   * out of it — a planned row has not done anything yet.
   */
  net: number;
}

/** The recorded rows a filter keeps. */
export function filterLedger(
  transactions: readonly TransactionWithCategory[],
  { type, categoryId, query, accountId = "all" }: LedgerFilter,
  /** Which bank account brought each row in, by transaction id. */
  accountOf: ReadonlyMap<string, string> = new Map(),
): TransactionWithCategory[] {
  const needle = searchNeedle(query);
  return transactions.filter(
    (tx) =>
      (type === "all" || tx.categories.type === type) &&
      (categoryId === "all" || tx.category_id === categoryId) &&
      (accountId === "all" || accountOf.get(tx.id) === accountId) &&
      (!needle ||
        matchesNeedle(
          needle,
          [tx.categories.name, tx.note],
          Number(tx.amount),
        )),
  );
}

/**
 * The planned rows the same filter keeps, so choosing "Income" or a category
 * narrows what is still to come as well as what has happened. None under an
 * account: a row still to come has come from no account yet.
 */
export function filterPlanned(
  planned: readonly PlannedOccurrence[],
  { type, categoryId, query, accountId = "all" }: LedgerFilter,
): PlannedOccurrence[] {
  if (accountId !== "all") {
    return [];
  }
  const needle = searchNeedle(query);
  return planned.filter(
    (occurrence) =>
      (type === "all" || occurrence.categoryType === type) &&
      (categoryId === "all" || occurrence.categoryId === categoryId) &&
      (!needle ||
        matchesNeedle(
          needle,
          [occurrence.categoryName, occurrence.name, occurrence.note],
          Number(occurrence.amount),
        )),
  );
}

/** Each kind of money's total over the rows given — the rows on screen. */
export function ledgerTotals(
  transactions: readonly TransactionWithCategory[],
): Record<CategoryType, number> {
  const totals = { income: 0, expense: 0, savings: 0, investment: 0 };
  for (const tx of transactions) {
    totals[tx.categories.type] += Number(tx.amount);
  }
  return totals;
}

/**
 * What the charges still call for, by kind of money, as `ledgerTotals` sums
 * what has happened: the figures over the list when it shows what is to come.
 */
export function ledgerPlannedTotals(
  planned: readonly PlannedOccurrence[],
): Record<CategoryType, number> {
  const totals = { income: 0, expense: 0, savings: 0, investment: 0 };
  for (const occurrence of planned) {
    totals[occurrence.categoryType] += Number(occurrence.amount);
  }
  return totals;
}

/**
 * Which half of the month the list shows. The one asked for, unless the
 * month has nothing there and something in the other: a month gone by has
 * nothing still to come, and a month ahead nothing that has happened.
 */
export function ledgerShowing(
  chosen: LedgerTime,
  counts: { past: number; upcoming: number },
): LedgerTime {
  if (chosen === "upcoming" && counts.upcoming === 0) {
    return "past";
  }
  if (chosen === "past" && counts.past === 0 && counts.upcoming > 0) {
    return "upcoming";
  }
  return chosen;
}

/**
 * The list as it is read: a day at a time, newest first unless asked
 * otherwise, each heading with its rows, so a date can never be drawn with
 * nothing under it.
 */
export function ledgerDays(
  transactions: readonly TransactionWithCategory[],
  planned: readonly PlannedOccurrence[],
  order: LedgerOrder = "newest",
): LedgerDay[] {
  const byDate = new Map<string, LedgerDay>();
  const day = (date: string) => {
    let entry = byDate.get(date);
    if (!entry) {
      entry = { date, rows: [], planned: [], net: 0 };
      byDate.set(date, entry);
    }
    return entry;
  };

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const entry = day(tx.occurred_on);
    entry.rows.push(tx);
    entry.net += tx.categories.type === "income" ? amount : -amount;
  }
  for (const occurrence of planned) {
    day(occurrence.occurredOn).planned.push(occurrence);
  }

  const days = [...byDate.values()];
  return order === "newest"
    ? days.sort((a, b) => b.date.localeCompare(a.date))
    : days.sort((a, b) => a.date.localeCompare(b.date));
}

/** The type chips, in the order drawn: everything, then each kind of money. */
export const LEDGER_TYPE_FILTERS: readonly LedgerTypeFilter[] = [
  "all",
  "income",
  "expense",
  "savings",
  "investment",
];

/**
 * The rows in the order they are read: newest day first, rows within a day
 * as they were given. Oldest first is that list turned over, rows within a
 * day included, so a day reads in the order its rows were written.
 */
export function ledgerRows(
  filtered: readonly TransactionWithCategory[],
  order: LedgerOrder,
): TransactionWithCategory[] {
  const newest = [...filtered].sort((a, b) =>
    b.occurred_on.localeCompare(a.occurred_on),
  );
  return order === "newest" ? newest : newest.reverse();
}

/**
 * The categories the month's rows use, by name, for the category filter —
 * the planned rows' too, so a month ahead, which has only those, filters
 * the same way.
 */
export function ledgerCategoryOptions(
  transactions: readonly TransactionWithCategory[],
  planned: readonly PlannedOccurrence[],
): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const tx of transactions) {
    if (!seen.has(tx.category_id)) {
      seen.set(tx.category_id, tx.categories.name);
    }
  }
  for (const occurrence of planned) {
    if (!seen.has(occurrence.categoryId)) {
      seen.set(occurrence.categoryId, occurrence.categoryName);
    }
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The filters tucked behind the button — the category and the account —
 * which it has to own up to.
 */
export function hiddenFilterCount(filter: LedgerFilter): number {
  return (
    (filter.categoryId !== "all" ? 1 : 0) +
    ((filter.accountId ?? "all") !== "all" ? 1 : 0)
  );
}

/** Whether anything narrows the list: a chip, a dropdown, or words typed. */
export function hasLedgerFilters(filter: LedgerFilter): boolean {
  return (
    filter.type !== "all" ||
    hiddenFilterCount(filter) > 0 ||
    filter.query.trim().length > 0
  );
}

/** Everything the list draws, from one call: both apps read this. */
export interface LedgerView {
  showing: LedgerTime;
  /** The recorded rows the filter keeps, in the order given. */
  filtered: TransactionWithCategory[];
  filteredPlanned: PlannedOccurrence[];
  /** `filtered`, in the order read. */
  rows: TransactionWithCategory[];
  /** The half shown, a day at a time. */
  days: LedgerDay[];
  /** The figures over what is on screen. */
  totals: Record<CategoryType, number>;
  shownCount: number;
  totalCount: number;
  /** The ids a selection can hold: the rows on screen. */
  visibleIds: string[];
}

/**
 * What the Journal shows, worked out once: which half of the month, the
 * rows the filter keeps, their order, their days and the figures over
 * them. The figures describe what is on screen, which is the whole reason
 * they are there: the month's own totals are Le point's, and repeating
 * them under a filter would state something the list contradicts. A day
 * of planned rows has no net at all — a figure there would be a forecast
 * set in the same type as the record.
 */
export function buildLedgerView({
  transactions,
  planned,
  filter,
  time,
  order,
  accountOf,
}: {
  transactions: readonly TransactionWithCategory[];
  planned: readonly PlannedOccurrence[];
  filter: LedgerFilter;
  time: LedgerTime;
  order: LedgerOrder;
  accountOf?: ReadonlyMap<string, string>;
}): LedgerView {
  const showing = ledgerShowing(time, {
    past: transactions.length,
    upcoming: planned.length,
  });
  const filtered = filterLedger(transactions, filter, accountOf);
  const filteredPlanned = filterPlanned(planned, filter);
  const rows = ledgerRows(filtered, order);
  const past = showing === "past";
  return {
    showing,
    filtered,
    filteredPlanned,
    rows,
    days: past
      ? ledgerDays(rows, [], order)
      : ledgerDays([], filteredPlanned, "oldest"),
    totals: past
      ? ledgerTotals(filtered)
      : ledgerPlannedTotals(filteredPlanned),
    shownCount: past ? filtered.length : filteredPlanned.length,
    totalCount: past ? transactions.length : planned.length,
    visibleIds: rows.map((tx) => tx.id),
  };
}
