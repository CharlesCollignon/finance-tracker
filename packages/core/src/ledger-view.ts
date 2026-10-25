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
