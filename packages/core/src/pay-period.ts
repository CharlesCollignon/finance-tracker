/**
 * Grouping payments by the period they belong to rather than the calendar
 * month they landed in.
 *
 * A salary paid at the end of the month sometimes clears on the 30th and
 * sometimes on the 1st. Bucketed by calendar month that is two payments in
 * December and none in November, which makes a twelve-month chart of a
 * perfectly regular income look violently irregular, and makes "a normal
 * month" — a mean over the months that had anything in them — read high by
 * the share of months that happened to hold two.
 *
 * So: find where in the month a category's payments actually cluster, and
 * assign each payment to the occurrence of that anchor it is nearest to. The
 * anchor always stays in its own month, so the labels do not slide; only the
 * strays either side of a boundary move.
 *
 * This is a reading of the same rows, not a change to them. A month here can
 * therefore disagree with the same month in the Ledger, which is exactly the
 * kind of second opinion this app is otherwise careful not to have — so it
 * only applies where it demonstrably fixes something, and the screen using it
 * has to say so.
 */

/** Below this there is no rhythm to find, only noise. */
const MIN_PAYMENTS = 6;

/** Monthly-ish, allowing for weekends and short months. */
const MIN_GAP_DAYS = 24;
const MAX_GAP_DAYS = 38;

/**
 * How tightly the payments have to cluster, as the length of the mean unit
 * vector. 1 is every payment on the same day of the month; 0 is scattered.
 * Groceries land all month long and score near zero, which is what keeps this
 * away from categories it would only distort.
 */
const MIN_CONCENTRATION = 0.8;

export interface PayRhythm {
  /** Where in the month the payments cluster, 0 at the 1st, 1 at month end. */
  anchor: number;
  /** How tightly they cluster, 0 to 1. */
  concentration: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Where in its month a date falls, 0 to 1, centred on the day. */
function phaseOf(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return (day! - 0.5) / daysInMonth(year!, month!);
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000,
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

/**
 * The rhythm a category is paid on, or null when it has none worth using.
 *
 * The anchor is a circular mean, because the day of the month wraps: the 31st
 * and the 1st are a day apart, and an ordinary average of 31 and 1 lands on
 * the 16th, which is the one place the payments never are.
 */
export function detectPayRhythm(dates: string[]): PayRhythm | null {
  if (dates.length < MIN_PAYMENTS) {
    return null;
  }

  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(daysBetween(sorted[i - 1]!, sorted[i]!));
  }

  const typical = median(gaps);
  if (typical < MIN_GAP_DAYS || typical > MAX_GAP_DAYS) {
    return null;
  }

  let x = 0;
  let y = 0;
  for (const date of sorted) {
    const angle = 2 * Math.PI * phaseOf(date);
    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  x /= sorted.length;
  y /= sorted.length;

  const concentration = Math.hypot(x, y);
  if (concentration < MIN_CONCENTRATION) {
    return null;
  }

  const anchor = (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1;
  return { anchor, concentration };
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year!, month! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Which period a payment belongs to, as a YYYY-MM key.
 *
 * The payment goes to whichever occurrence of the anchor it is closest to —
 * this month's, last month's or next month's. Measuring from the anchor
 * rather than from a cut-off is what keeps the labels honest: a payment
 * sitting exactly on the anchor can never be moved out of its own month, so
 * a category paid on the 2nd does not silently shift its whole series back a
 * month.
 */
export function payPeriodKey(iso: string, rhythm: PayRhythm): string {
  const monthKey = iso.slice(0, 7);
  const phase = phaseOf(iso);

  const here = Math.abs(phase - rhythm.anchor);
  const previous = phase + (1 - rhythm.anchor);
  const next = 1 - phase + rhythm.anchor;

  if (previous < here && previous <= next) {
    return shiftMonthKey(monthKey, -1);
  }
  if (next < here && next < previous) {
    return shiftMonthKey(monthKey, 1);
  }
  return monthKey;
}

/**
 * How lumpy a set of monthly buckets is: how many periods hold none or more
 * than one payment.
 *
 * Used as the test of whether shifting is worth doing at all. Regrouping is a
 * second opinion about which month money belongs to, and it has to earn that
 * by actually making the series regular — not merely by being available.
 */
export function unevenness(keys: string[]): number {
  if (keys.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = [...counts.keys()].sort();
  let span = 0;
  let cursor = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  while (cursor <= last && span < 600) {
    span += 1;
    if (cursor === last) {
      break;
    }
    cursor = shiftMonthKey(cursor, 1);
  }

  const empty = span - counts.size;
  let doubled = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      doubled += count - 1;
    }
  }

  return empty + doubled;
}

export interface PayPeriodGrouping {
  /** Payment date to the period it is counted in. */
  keyOf: (iso: string) => string;
  /** Whether anything was actually moved. */
  shifted: boolean;
}

/**
 * Decide whether to regroup a category's payments, and how.
 *
 * Falls back to the calendar month unless a rhythm exists and using it makes
 * the series measurably more regular.
 */
export function groupByPayPeriod(dates: string[]): PayPeriodGrouping {
  const calendar = (iso: string) => iso.slice(0, 7);
  const rhythm = detectPayRhythm(dates);

  if (!rhythm) {
    return { keyOf: calendar, shifted: false };
  }

  const before = unevenness(dates.map(calendar));
  const after = unevenness(dates.map((iso) => payPeriodKey(iso, rhythm)));

  if (after >= before) {
    return { keyOf: calendar, shifted: false };
  }

  return { keyOf: (iso) => payPeriodKey(iso, rhythm), shifted: true };
}
