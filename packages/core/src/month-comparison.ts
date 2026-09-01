/**
 * This month against the last one.
 *
 * A dashboard that reads identically on the 3rd and the 5th gives nobody a
 * reason to open it. One honest comparison line does — but only if the
 * comparison is fair: on the 8th, this month's eight days must be compared
 * with the previous month's first eight days, not its whole total. Comparing
 * a partial month to a complete one would report a fall in spending every
 * single month, which is worse than saying nothing.
 */

import { formatMonthLabel } from "./constants";
import type { CategoryType, TransactionWithCategory } from "./types/database";

export type ComparisonDirection = "up" | "down" | "flat";

export interface MonthComparison {
  current: number;
  previous: number;
  /** current − previous. Positive means more than last month. */
  delta: number;
  /** delta / previous, or null when there is nothing to divide by. */
  ratio: number | null;
  direction: ComparisonDirection;
  /** Day of month both sides are counted up to. */
  throughDay: number;
  /** False when the month is complete, so no truncation was applied. */
  partial: boolean;
  /** False when the previous month has nothing to compare against. */
  comparable: boolean;
  /** "August", for the sentence. */
  previousLabel: string;
}

/** Below this, a change is rounding rather than news. */
const FLAT_EPSILON = 0.005;

function dayOf(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function previousMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

/** Totals one category type up to and including a day of the month. */
export function sumThroughDay(
  transactions: TransactionWithCategory[],
  type: CategoryType,
  throughDay: number,
): number {
  return transactions
    .filter(
      (tx) =>
        tx.categories.type === type &&
        tx.categories.counts_toward_summary !== false &&
        dayOf(tx.occurred_on) <= throughDay,
    )
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
}

export interface BuildMonthComparisonOptions {
  /** Transactions in the month being viewed. */
  current: TransactionWithCategory[];
  /** Transactions in the month before it. */
  previous: TransactionWithCategory[];
  year: number;
  month: number;
  /** Today, so a month in the past compares whole rather than truncated. */
  today: string;
  type?: CategoryType;
}

/**
 * Builds the comparison for one category type, truncating both months to the
 * same day when the month being viewed is still running.
 */
export function buildMonthComparison({
  current,
  previous,
  year,
  month,
  today,
  type = "expense",
}: BuildMonthComparisonOptions): MonthComparison {
  const [previousYear, previousMonthNumber] = previousMonth(year, month);
  const previousLabel = formatMonthLabel(previousYear, previousMonthNumber);

  const monthLength = lastDayOfMonth(year, month);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);

  const viewingCurrentMonth = todayYear === year && todayMonth === month;
  const viewingFuture =
    (todayYear ?? 0) < year ||
    ((todayYear ?? 0) === year && (todayMonth ?? 0) < month);

  // A finished month is compared whole. A running one is cut at today. A month
  // that has not started yet has nothing in it, so the cut does not matter.
  const throughDay = viewingCurrentMonth
    ? Math.min(todayDay ?? monthLength, monthLength)
    : viewingFuture
      ? 0
      : monthLength;

  // The comparison month may be shorter — 31 January against 28 February would
  // otherwise flatter February.
  const previousLength = lastDayOfMonth(previousYear, previousMonthNumber);
  const comparableDay = Math.min(throughDay, previousLength);

  // Both sides use the same window, or the comparison is not one.
  const currentTotal = sumThroughDay(current, type, comparableDay);
  const previousTotal = sumThroughDay(previous, type, comparableDay);

  const delta = currentTotal - previousTotal;
  const ratio = previousTotal > 0 ? delta / previousTotal : null;

  const direction: ComparisonDirection =
    Math.abs(delta) < FLAT_EPSILON ? "flat" : delta > 0 ? "up" : "down";

  return {
    current: currentTotal,
    previous: previousTotal,
    delta,
    ratio,
    direction,
    throughDay: comparableDay,
    partial: viewingCurrentMonth && throughDay < monthLength,
    comparable: previousTotal > 0,
    previousLabel,
  };
}

/**
 * The sentence that goes under the hero number.
 *
 * Returns null rather than an awkward line when there is nothing worth
 * saying — a first month with no history, or a difference of pennies.
 */
export function formatMonthComparison(
  comparison: MonthComparison,
  formatAmount: (amount: number) => string,
): string | null {
  if (!comparison.comparable) {
    return null;
  }

  if (comparison.direction === "flat") {
    return comparison.partial
      ? `About the same as this point in ${comparison.previousLabel}.`
      : `About the same as ${comparison.previousLabel}.`;
  }

  const amount = formatAmount(Math.abs(comparison.delta));
  const word = comparison.direction === "up" ? "more" : "less";
  const when = comparison.partial
    ? `this point in ${comparison.previousLabel}`
    : comparison.previousLabel;

  return `${amount} ${word} than ${when}.`;
}
