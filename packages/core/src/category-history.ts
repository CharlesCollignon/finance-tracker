/**
 * How one category has moved, month by month.
 *
 * The dashboard answers "what is this month doing"; this answers "is this
 * getting worse". They are different questions and the second one is only
 * ever legible over a run of months, which is why it gets its own shape
 * rather than another figure on a card.
 *
 * One category at a time, deliberately. A chart of every category at once
 * shows the total and hides the thing you came to find out, which is whether
 * groceries have crept up since spring.
 */

import { formatMonthLabel, shiftMonth } from "./constants";
import { groupByPayPeriod } from "./pay-period";
import type { CategoryType, TransactionWithCategory } from "./types/database";

export interface CategoryMonthPoint {
  /** YYYY-MM. */
  monthKey: string;
  /** "October 2026". */
  label: string;
  /** "Oct", for an axis with no room. */
  shortLabel: string;
  total: number;
  /** Nothing was recorded, as against recorded as zero. */
  empty: boolean;
}

export interface CategoryHistory {
  categoryId: string;
  name: string;
  type: CategoryType;
  points: CategoryMonthPoint[];
  /** Mean across the months that had anything in them. */
  average: number;
  /** The largest month, which is what the bars are drawn against. */
  peak: number;
  total: number;
  /**
   * The most recent month against the average of the ones before it, as a
   * fraction: 0.2 means a fifth above normal. Null until there is enough
   * history for "normal" to mean anything.
   */
  trend: number | null;
  /**
   * True when payments were counted against the period they belong to rather
   * than the calendar month they cleared in — see pay-period.ts. A month in
   * this series can then differ from the same month in the ledger, so a
   * screen showing it has to say so.
   */
  periodShifted: boolean;
}

/** Months back from and including (year, month), oldest first. */
function monthKeysEndingAt(
  year: number,
  month: number,
  months: number,
): { key: string; year: number; month: number }[] {
  const out: { key: string; year: number; month: number }[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const shifted = shiftMonth(year, month, -back);
    out.push({
      key: `${shifted.year}-${String(shifted.month).padStart(2, "0")}`,
      year: shifted.year,
      month: shifted.month,
    });
  }
  return out;
}

export interface BuildCategoryHistoryOptions {
  months?: number;
}

/**
 * A series per category, over the window ending at (year, month).
 *
 * Every month in the window appears even where nothing was recorded, because
 * a gap is information — a subscription that stopped should read as a hole in
 * the run, not as the series quietly getting shorter.
 */
export function buildCategoryHistory(
  transactions: readonly TransactionWithCategory[],
  year: number,
  month: number,
  { months = 12 }: BuildCategoryHistoryOptions = {},
): CategoryHistory[] {
  const window = monthKeysEndingAt(year, month, months);
  const inWindow = new Set(window.map((entry) => entry.key));

  const byCategory = new Map<
    string,
    {
      name: string;
      type: CategoryType;
      totals: Map<string, number>;
      shifted: boolean;
    }
  >();

  // Which bucket a payment falls in is a fact about its own category's
  // rhythm, so the grouping has to be worked out per category before any
  // totalling. A wider slice than the window is read for it: a rhythm needs
  // half a year of payments to be visible at all, and the window's first
  // month has neighbours outside it that decide where its payments land.
  const datesByCategory = new Map<string, string[]>();
  for (const tx of transactions) {
    const dates = datesByCategory.get(tx.category_id) ?? [];
    dates.push(tx.occurred_on);
    datesByCategory.set(tx.category_id, dates);
  }
  const groupingByCategory = new Map(
    [...datesByCategory].map(
      ([categoryId, dates]) => [categoryId, groupByPayPeriod(dates)] as const,
    ),
  );

  for (const tx of transactions) {
    const grouping = groupingByCategory.get(tx.category_id);
    const monthKey = grouping
      ? grouping.keyOf(tx.occurred_on)
      : tx.occurred_on.slice(0, 7);
    if (!inWindow.has(monthKey)) {
      continue;
    }

    const entry = byCategory.get(tx.category_id) ?? {
      name: tx.categories.name,
      type: tx.categories.type,
      totals: new Map<string, number>(),
      shifted: grouping?.shifted ?? false,
    };
    // A withdrawal or a reimbursement subtracts, the same way it does in the
    // monthly figures; a series that ignored the sign would show a month of
    // moving money back and forth as a month of heavy saving.
    const signed =
      tx.categories.counts_toward_summary === false &&
      (tx.categories.type === "savings" || tx.categories.type === "income")
        ? -Number(tx.amount)
        : Number(tx.amount);
    entry.totals.set(monthKey, (entry.totals.get(monthKey) ?? 0) + signed);
    byCategory.set(tx.category_id, entry);
  }

  const histories: CategoryHistory[] = [];

  for (const [categoryId, entry] of byCategory) {
    const points = window.map(({ key, year: y, month: m }) => {
      const raw = entry.totals.get(key);
      return {
        monthKey: key,
        label: formatMonthLabel(y, m),
        shortLabel: formatMonthLabel(y, m).slice(0, 3),
        total: Math.round((raw ?? 0) * 100) / 100,
        empty: raw === undefined,
      };
    });

    const active = points.filter((point) => !point.empty);
    const total = active.reduce((sum, point) => sum + point.total, 0);
    const average = active.length > 0 ? total / active.length : 0;
    const peak = points.reduce((max, point) => Math.max(max, point.total), 0);

    const latest = points[points.length - 1];
    const earlier = active.filter(
      (point) => point.monthKey !== latest?.monthKey,
    );
    const baseline =
      earlier.length >= 2
        ? earlier.reduce((sum, point) => sum + point.total, 0) / earlier.length
        : null;

    histories.push({
      categoryId,
      name: entry.name,
      type: entry.type,
      points,
      average: Math.round(average * 100) / 100,
      peak,
      total: Math.round(total * 100) / 100,
      trend:
        baseline !== null && baseline > 0 && latest && !latest.empty
          ? Math.round(((latest.total - baseline) / baseline) * 100) / 100
          : null,
      periodShifted: entry.shifted,
    });
  }

  // Busiest first: the category you want is almost never the alphabetical one.
  return histories.sort((left, right) => right.total - left.total);
}
