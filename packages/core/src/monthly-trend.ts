import { formatMonthLabel } from "./constants";

export interface MonthlyTrendPoint {
  /** `YYYY-MM`, so a list of these sorts as text. */
  monthKey: string;
  label: string;
  income: number;
  outflow: number;
  net: number;
}

/**
 * One transaction, as much of it as a trend needs.
 *
 * Both clients read this out of the same two columns and the joined category,
 * but they spell the join differently — the phone gets `categories` nested by
 * PostgREST, the web query flattens it — so the caller maps into this rather
 * than this knowing either shape.
 */
export interface MonthlyTrendRow {
  amount: number | string;
  /** `YYYY-MM-DD`. */
  occurredOn: string;
  type: string;
  /** Categories excluded from the summary are excluded here too. */
  countsTowardSummary: boolean;
}

/**
 * The first day of the window a trend covers, as `YYYY-MM-DD`.
 *
 * Exported because it is what the query filters on, and a window that
 * disagreed with the buckets below would silently drop or invent a month.
 */
export function monthlyTrendStart(months: number, now: Date): string {
  const first = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const month = `${first.getMonth() + 1}`.padStart(2, "0");
  return `${first.getFullYear()}-${month}-01`;
}

/**
 * Income and outflow per month for the last `months` months, oldest first.
 *
 * Every month in the window gets a bucket whether or not anything happened in
 * it, because a gap in a trend is information: a month with no rows is a flat
 * stretch, not a missing point, and a sparkline that closed the gap would draw
 * a line the data does not support.
 *
 * Only categories that count toward the summary are included, which is what
 * makes these figures agree with the month totals shown beside them. Anything
 * that is not income counts as outflow — savings and investments included,
 * since from the account's point of view they left it.
 */
export function bucketMonthlyTrend(
  rows: MonthlyTrendRow[],
  months: number,
  now: Date,
): MonthlyTrendPoint[] {
  const buckets = new Map<string, { income: number; outflow: number }>();

  for (let index = 0; index < months; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
    buckets.set(key, { income: 0, outflow: 0 });
  }

  for (const row of rows) {
    if (!row.countsTowardSummary) {
      continue;
    }
    const bucket = buckets.get(row.occurredOn.slice(0, 7));
    if (!bucket) {
      continue;
    }
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) {
      continue;
    }
    if (row.type === "income") {
      bucket.income += amount;
    } else {
      bucket.outflow += amount;
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, totals]) => {
      const [year, month] = monthKey.split("-").map(Number);
      return {
        monthKey,
        label: formatMonthLabel(year!, month!),
        income: totals.income,
        outflow: totals.outflow,
        net: totals.income - totals.outflow,
      };
    });
}
