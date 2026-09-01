/**
 * Money-weighted return.
 *
 * Absolute gain is close to meaningless for someone contributing monthly:
 * €500 of gain on €10,000 paid in over three years and €500 on €10,000 paid
 * in last month are very different outcomes and read identically. This solves
 * for the annual rate that makes the dated contributions and the current value
 * balance — the same figure a broker calls performance, computed from the
 * cashflows the ledger already holds.
 *
 * Sign convention follows the spreadsheet one: money leaving the user's pocket
 * into the investment is negative, value coming back (including the terminal
 * market value) is positive.
 */

const DAYS_PER_YEAR = 365;

/** Below this the rate is reported as-is rather than refined further. */
const TOLERANCE = 1e-7;
const MAX_ITERATIONS = 128;

/** A rate of -100% means total loss; the maths is undefined at or below it. */
const MIN_RATE = -0.999999;
const MAX_RATE = 1e6;

export interface Cashflow {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Negative into the investment, positive out of it. */
  amount: number;
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

/** Net present value of the cashflows at an annual rate. */
function netPresentValue(
  flows: { years: number; amount: number }[],
  rate: number,
): number {
  let total = 0;
  for (const flow of flows) {
    total += flow.amount / (1 + rate) ** flow.years;
  }
  return total;
}

function netPresentValueDerivative(
  flows: { years: number; amount: number }[],
  rate: number,
): number {
  let total = 0;
  for (const flow of flows) {
    if (flow.years === 0) {
      continue;
    }
    total -= (flow.years * flow.amount) / (1 + rate) ** (flow.years + 1);
  }
  return total;
}

function bisect(
  flows: { years: number; amount: number }[],
  low: number,
  high: number,
): number | null {
  let lowValue = netPresentValue(flows, low);
  let a = low;
  let b = high;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const mid = (a + b) / 2;
    const midValue = netPresentValue(flows, mid);

    if (Math.abs(midValue) < TOLERANCE || (b - a) / 2 < TOLERANCE) {
      return mid;
    }

    if (Math.sign(midValue) === Math.sign(lowValue)) {
      a = mid;
      lowValue = midValue;
    } else {
      b = mid;
    }
  }

  return null;
}

/**
 * The annual money-weighted rate, or null when the cashflows cannot produce
 * one — fewer than two flows, no sign change, or everything on one day.
 * Returning null rather than a number is deliberate: a made-up return is worse
 * than an honest "not enough history yet".
 */
export function xirr(cashflows: Cashflow[]): number | null {
  if (cashflows.length < 2) {
    return null;
  }

  const hasInflow = cashflows.some((flow) => flow.amount > 0);
  const hasOutflow = cashflows.some((flow) => flow.amount < 0);
  if (!hasInflow || !hasOutflow) {
    return null;
  }

  const days = cashflows.map((flow) => dayNumber(flow.date));
  const start = Math.min(...days);
  const span = Math.max(...days) - start;

  // A return over zero elapsed time is not a rate.
  if (span <= 0) {
    return null;
  }

  const flows = cashflows.map((flow, index) => ({
    amount: flow.amount,
    years: (days[index]! - start) / DAYS_PER_YEAR,
  }));

  // Newton converges in a handful of steps for well-behaved cashflows.
  let rate = 0.1;
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const value = netPresentValue(flows, rate);

    if (Math.abs(value) < TOLERANCE) {
      return rate;
    }

    const slope = netPresentValueDerivative(flows, rate);
    if (slope === 0 || !Number.isFinite(slope)) {
      break;
    }

    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= MIN_RATE || next >= MAX_RATE) {
      break;
    }

    if (Math.abs(next - rate) < TOLERANCE) {
      return next;
    }

    rate = next;
  }

  // Newton can wander for irregular cashflows; bracket and bisect instead.
  let low = MIN_RATE;
  let lowValue = netPresentValue(flows, low);

  for (const high of [-0.9, -0.5, -0.1, 0, 0.1, 0.5, 1, 5, 20, 100, 1000]) {
    const highValue = netPresentValue(flows, high);
    if (!Number.isFinite(highValue)) {
      continue;
    }
    if (Math.sign(highValue) !== Math.sign(lowValue)) {
      return bisect(flows, low, high);
    }
    low = high;
    lowValue = highValue;
  }

  return null;
}

export interface PortfolioReturn {
  /** Annual money-weighted rate as a fraction, e.g. 0.074 for 7.4%. */
  rate: number | null;
  /** Total put in, as a positive number. */
  invested: number;
  /** What it is worth now. */
  currentValue: number;
  /** currentValue − invested. */
  absoluteGain: number;
  /** Days between the first contribution and now. */
  daysHeld: number;
  /**
   * Why there is no rate, when `rate` is null. Lets the UI explain itself
   * instead of showing a blank where a number should be.
   */
  unavailableReason: "no-contributions" | "too-short" | "not-solvable" | null;
}

/** A rate over less than this reads as noise, not performance. */
const MIN_DAYS_FOR_RATE = 30;

/**
 * Builds the return for one position or wallet from its dated contributions
 * and today's market value.
 *
 * `contributions` are the amounts the user put in, as positive numbers dated
 * when they went in — the caller does not have to know the sign convention.
 */
export function buildPortfolioReturn(
  contributions: { date: string; amount: number }[],
  currentValue: number,
  asOfDate: string,
): PortfolioReturn {
  const positive = contributions.filter((row) => Number(row.amount) > 0);
  const invested = positive.reduce((sum, row) => sum + Number(row.amount), 0);

  const base: PortfolioReturn = {
    rate: null,
    invested,
    currentValue,
    absoluteGain: currentValue - invested,
    daysHeld: 0,
    unavailableReason: "no-contributions",
  };

  if (positive.length === 0) {
    return base;
  }

  const days = positive.map((row) => dayNumber(row.date));
  const daysHeld = dayNumber(asOfDate) - Math.min(...days);

  if (daysHeld < MIN_DAYS_FOR_RATE) {
    return { ...base, daysHeld, unavailableReason: "too-short" };
  }

  const rate = xirr([
    ...positive.map((row) => ({ date: row.date, amount: -Number(row.amount) })),
    { date: asOfDate, amount: currentValue },
  ]);

  return {
    ...base,
    rate,
    daysHeld,
    unavailableReason: rate === null ? "not-solvable" : null,
  };
}

/** "+7.4% a year" / "−2.1% a year", or null when there is no rate. */
export function formatAnnualRate(
  rate: number | null,
  locale = "en-GB",
): string | null {
  if (rate === null) {
    return null;
  }

  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(rate);

  return `${percent} a year`;
}
