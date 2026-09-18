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

/** Below this many months with any activity, a chart would draw noise as a shape. */
export const MIN_MONTHS_FOR_TREND = 3;

export type TrendPresentation =
  | { kind: "empty" }
  /** Too little real history for a shape — worth listing, not plotting. */
  | { kind: "thin"; points: MonthlyTrendPoint[] }
  | { kind: "chart"; points: MonthlyTrendPoint[] };

/**
 * Whether a trend has enough real history to draw as a shape, a handful of
 * numbers worth listing instead, or nothing at all.
 *
 * `bucketMonthlyTrend` deliberately keeps a quiet month as a real zero — see
 * its own doc comment — and that is right for an account that already
 * existed and simply had a flat month. It is wrong for a month before the
 * account existed at all: `getMonthlyTrend`'s default window is six months
 * regardless of how long the reader has been using the app, so a brand-new
 * account gets five zeros it never lived through and one real month. A
 * chart cannot tell those two kinds of zero apart; filtering to months with
 * any income or outflow can. This is the one piece of judgement the
 * deleted mobile `TrendCard` carried that its replacement panel block did
 * not, moved here so both clients' block asks the same question rather than
 * each answering it by hand.
 *
 * Inherited tension, not a new one: the same filter also drops a genuinely
 * quiet month that falls between two active ones, which is exactly the
 * "gap is information" case `bucketMonthlyTrend` argues for keeping. This
 * function does not resolve that — it restores `TrendCard`'s own answer
 * unchanged, which chose "cannot tell a pre-signup zero from a real one, so
 * treat both alike" over drawing the flat month back in.
 */
export function presentTrend(
  points: readonly MonthlyTrendPoint[],
): TrendPresentation {
  const active = points.filter(
    (point) => point.income !== 0 || point.outflow !== 0,
  );

  if (active.length === 0) {
    return { kind: "empty" };
  }
  if (active.length < MIN_MONTHS_FOR_TREND) {
    return { kind: "thin", points: active };
  }
  return { kind: "chart", points: active };
}
