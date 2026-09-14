/**
 * What an instrument's own price did, ready to draw.
 *
 * Distinct from the position chart in `./investment-positions`, which plots
 * the user's money — what they put in against what it is worth. This plots the
 * instrument: one line, no axis, and the percentage between its ends. A price
 * is a fact about the fund; a position is a fact about the person holding it,
 * and the two answer different questions.
 *
 * Everything here is pure. The fetching and the euro conversion live in
 * `./market/fx`; what arrives is a dated series and what leaves is four slices
 * of it, each thinned to something a sparkline can carry.
 */

import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "./i18n/locale";

export type PriceRange = "1M" | "1Y" | "5Y" | "ALL";

export const PRICE_RANGES: readonly PriceRange[] = [
  "1M",
  "1Y",
  "5Y",
  "ALL",
] as const;

/** How far back each range reaches, in months. `ALL` reaches everywhere. */
const RANGE_MONTHS: Record<Exclude<PriceRange, "ALL">, number> = {
  "1M": 1,
  "1Y": 12,
  "5Y": 60,
};

/**
 * Points per range after thinning.
 *
 * A year of daily closes is ~252 points drawn across a few hundred pixels, so
 * most of them land on a pixel another already occupies. Sixty is enough to
 * keep every turn the eye can see at this size, and it holds the payload for a
 * portfolio of fifteen holdings to a few tens of kilobytes.
 */
const MAX_POINTS_PER_RANGE = 60;

export interface DatedPrice {
  /** YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface RangeSeries {
  /** Oldest first. Fewer than two points draws nothing. */
  values: number[];
  /** Move from the first close to the last, in percent. */
  changePct: number | null;
}

export type InstrumentPriceSeries = Record<PriceRange, RangeSeries>;

/** An empty answer, so a symbol that could not be read renders as absent. */
export function emptyPriceSeries(): InstrumentPriceSeries {
  return {
    "1M": { values: [], changePct: null },
    "1Y": { values: [], changePct: null },
    "5Y": { values: [], changePct: null },
    ALL: { values: [], changePct: null },
  };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

/**
 * The same day-of-month, `months` earlier, clamped to a month that has it.
 *
 * Without the clamp, one month before the 31st is the 31st of a month with
 * thirty days, which `Date` rolls forward into the next one — quietly making
 * the 1M window shorter than a month exactly when the month is short.
 */
function shiftMonthsBack(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return date;
  }

  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const clamped = String(Math.min(day, daysInTarget)).padStart(2, "0");
  const targetMonth = String(target.getUTCMonth() + 1).padStart(2, "0");

  return `${target.getUTCFullYear()}-${targetMonth}-${clamped}`;
}

/** Keep the trailing window of a dated series for a range preset. */
export function sliceSeriesByRange(
  points: DatedPrice[],
  range: PriceRange,
  today: string,
): DatedPrice[] {
  if (range === "ALL") {
    return points;
  }

  const cutoff = shiftMonthsBack(today, RANGE_MONTHS[range]);
  return points.filter((point) => point.date >= cutoff);
}

/**
 * Thin a series to at most `maxPoints`, keeping both ends.
 *
 * Even sampling rather than averaging: the ends are what the percentage is
 * taken between, so they have to survive untouched, and an averaged line would
 * flatten the spikes that are the only reason to look at the shape.
 */
export function downsample(
  points: DatedPrice[],
  maxPoints: number = MAX_POINTS_PER_RANGE,
): DatedPrice[] {
  if (maxPoints < 2 || points.length <= maxPoints) {
    return points;
  }

  const step = (points.length - 1) / (maxPoints - 1);
  const thinned: DatedPrice[] = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const point = points[Math.round(index * step)];
    if (point) {
      thinned.push(point);
    }
  }

  return thinned;
}

/** The move between the ends of a series, in percent, to two decimals. */
export function percentChange(points: DatedPrice[]): number | null {
  if (points.length < 2) {
    return null;
  }

  const first = points[0]!.close;
  const last = points[points.length - 1]!.close;

  if (first <= 0) {
    return null;
  }

  return Math.round(((last - first) / first) * 10000) / 100;
}

/**
 * Re-price a series in euro, month by month.
 *
 * A single rate applied to the whole series is the same series scaled: the
 * shape survives and the percentage comes out as the instrument's own
 * currency, wearing a euro label. Using the rate that held at the time is what
 * makes the figure the one the holder actually experienced.
 *
 * A month with no rate takes the nearest earlier one — FX series have gaps
 * where markets close, and the rate that held last month is a far better guess
 * for this month than today's is. `fallbackRate` catches points older than any
 * rate on hand.
 */
export function applyMonthlyRates(
  points: DatedPrice[],
  rates: Record<string, number>,
  fallbackRate: number,
): DatedPrice[] {
  const months = Object.keys(rates).sort();

  if (months.length === 0) {
    return points.map((point) => ({
      date: point.date,
      close: Math.round(point.close * fallbackRate * 10000) / 10000,
    }));
  }

  let cursor = 0;
  let carried = fallbackRate;

  return points.map((point) => {
    const key = monthKey(point.date);

    while (cursor < months.length && months[cursor]! <= key) {
      carried = rates[months[cursor]!]!;
      cursor += 1;
    }

    // Points older than the first rate on hand keep the fallback rather than
    // borrowing a later one, which would be a guess pointing the wrong way.
    const rate = months[0]! <= key ? carried : fallbackRate;

    return {
      date: point.date,
      close: Math.round(point.close * rate * 10000) / 10000,
    };
  });
}

export interface PriceHistory {
  /** Daily closes over roughly the last year. May be empty. */
  daily: DatedPrice[];
  /** Monthly closes over the instrument's whole life. */
  monthly: DatedPrice[];
}

/**
 * Which grain answers which range.
 *
 * A month of monthly closes is two points and a straight line; five years of
 * daily closes is more points than the pixels to draw them. Each range reads
 * from the series that can actually describe it, and falls back to the other
 * when a listing gives only one.
 */
const RANGE_GRAIN: Record<PriceRange, keyof PriceHistory> = {
  "1M": "daily",
  "1Y": "daily",
  "5Y": "monthly",
  ALL: "monthly",
};

/** The four ranges the investments page offers, from a price history. */
export function buildPriceSeries(
  history: PriceHistory,
  today: string,
  maxPoints: number = MAX_POINTS_PER_RANGE,
): InstrumentPriceSeries {
  const series = emptyPriceSeries();

  for (const range of PRICE_RANGES) {
    const preferred = history[RANGE_GRAIN[range]];
    const source =
      preferred.length > 1
        ? preferred
        : RANGE_GRAIN[range] === "daily"
          ? history.monthly
          : history.daily;

    const sliced = downsample(
      sliceSeriesByRange(source, range, today),
      maxPoints,
    );

    series[range] = {
      values: sliced.map((point) => point.close),
      changePct: percentChange(sliced),
    };
  }

  return series;
}

/**
 * The move beside the line: "+12.4%", "−3.1%", "—" when there is nothing.
 *
 * `signDisplay: "exceptZero"` so a rise is marked and a flat run is not, and
 * the locale's own percent spacing is observed — French puts a no-break space
 * before the sign, English does not.
 */
export function formatSignedPercent(
  changePct: number | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (changePct === null) {
    return "—";
  }

  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(changePct / 100);
}
