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
 * A month can run to two hundred rows, so the list can also be read a week
 * at a time (`ledgerWeeks`, and `range` on the filter) and in either order
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
  /** Only the rows dated within, both days included: one week of the month. */
  range?: LedgerRange | null;
}

/** Two days, YYYY-MM-DD, both included. */
export interface LedgerRange {
  from: string;
  to: string;
}

/** Which end of the month the list starts from. */
export type LedgerOrder = "newest" | "oldest";

/** One day of a week strip: how many rows the list shows on it. */
export interface LedgerWeekDay {
  /** YYYY-MM-DD. */
  date: string;
  recorded: number;
  planned: number;
}

/** One week of the month, as the strip above the list draws it. */
export interface LedgerWeek extends LedgerRange {
  /**
   * Monday to Sunday, always seven. A day outside the month is null, so the
   * first and last weeks keep each weekday in its place and every week of
   * the strip is drawn the same width — a week of one day still has to be a
   * target a thumb can find.
   */
  days: (LedgerWeekDay | null)[];
  recorded: number;
  planned: number;
}

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

function inRange(date: string, range: LedgerRange | null | undefined) {
  return !range || (date >= range.from && date <= range.to);
}

/** The recorded rows a filter keeps. */
export function filterLedger(
  transactions: readonly TransactionWithCategory[],
  { type, categoryId, query, accountId = "all", range }: LedgerFilter,
  /** Which bank account brought each row in, by transaction id. */
  accountOf: ReadonlyMap<string, string> = new Map(),
): TransactionWithCategory[] {
  const needle = searchNeedle(query);
  return transactions.filter(
    (tx) =>
      (type === "all" || tx.categories.type === type) &&
      (categoryId === "all" || tx.category_id === categoryId) &&
      (accountId === "all" || accountOf.get(tx.id) === accountId) &&
      inRange(tx.occurred_on, range) &&
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
  { type, categoryId, query, accountId = "all", range }: LedgerFilter,
): PlannedOccurrence[] {
  if (accountId !== "all") {
    return [];
  }
  const needle = searchNeedle(query);
  return planned.filter(
    (occurrence) =>
      (type === "all" || occurrence.categoryType === type) &&
      (categoryId === "all" || occurrence.categoryId === categoryId) &&
      inRange(occurrence.occurredOn, range) &&
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

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The month cut into its weeks, Monday to Sunday as a French calendar has
 * them, the first and last cut at the month's edges — and each day with the
 * number of rows the list shows on it, so the strip drawn from this says
 * where the month's rows are before any week is chosen.
 *
 * Given the rows the other filters keep, not the week's: a search lights up
 * the days it found something on, across the whole month.
 */
export function ledgerWeeks(
  year: number,
  month: number,
  transactions: readonly TransactionWithCategory[],
  planned: readonly PlannedOccurrence[],
): LedgerWeek[] {
  const counts = new Map<string, { recorded: number; planned: number }>();
  const count = (date: string) => {
    let entry = counts.get(date);
    if (!entry) {
      entry = { recorded: 0, planned: 0 };
      counts.set(date, entry);
    }
    return entry;
  };
  for (const tx of transactions) {
    count(tx.occurred_on).recorded += 1;
  }
  for (const occurrence of planned) {
    count(occurrence.occurredOn).planned += 1;
  }

  const lastDay = new Date(year, month, 0).getDate();
  // Monday is 0: where the 1st sits in its week.
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const weeks: LedgerWeek[] = [];
  for (let start = 1 - lead; start <= lastDay; start += 7) {
    const days: (LedgerWeekDay | null)[] = [];
    for (let day = start; day < start + 7; day++) {
      if (day < 1 || day > lastDay) {
        days.push(null);
        continue;
      }
      const date = isoDay(year, month, day);
      days.push({ date, ...(counts.get(date) ?? { recorded: 0, planned: 0 }) });
    }
    const inMonth = days.filter((day): day is LedgerWeekDay => day !== null);
    weeks.push({
      from: inMonth[0]!.date,
      to: inMonth[inMonth.length - 1]!.date,
      days,
      recorded: inMonth.reduce((sum, day) => sum + day.recorded, 0),
      planned: inMonth.reduce((sum, day) => sum + day.planned, 0),
    });
  }
  return weeks;
}
