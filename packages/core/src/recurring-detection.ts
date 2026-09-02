/**
 * Finding the standing charges hiding in a statement.
 *
 * A year of transactions already contains every subscription, every
 * insurance premium and every direct debit the user has. Making them type
 * those in again, from a list the app is looking straight at, is work the
 * app should be doing.
 *
 * Nothing here creates anything. A template that was never agreed to is
 * worse than a missing one: it silently joins every projection, every runway
 * figure and every month-end view, and it is invisible once it is there. So
 * this proposes, and someone says yes.
 */

import { bankMerchantKey } from "./bank-merchant";
import type { Recurrence } from "./recurrence";
import type { CategoryType } from "./types/database";

export interface DetectionInput {
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
}

export interface RecurringProposal {
  /** The coarse merchant key the occurrences agree on. */
  key: string;
  /** The clearest spelling seen, for showing the user. */
  label: string;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  recurrence: Recurrence;
  /** Day of the month for monthly and yearly, weekday for weekly. */
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  /** The amount to propose: the most recent, not the average. */
  amount: number;
  /** How many occurrences back it. */
  count: number;
  /** Most recent occurrence, so a lapsed charge can be told apart. */
  lastSeenOn: string;
  /** How much the amounts move, as a fraction of the typical one. */
  variability: number;
}

/** Below this many sightings it is a coincidence, not a habit. */
const MIN_OCCURRENCES = 3;

/**
 * How far the gaps may wander and still count as a cadence. A monthly charge
 * lands anywhere from 28 to 31 days apart, and a weekend pushes it further.
 */
const MONTHLY_RANGE: readonly [number, number] = [25, 36];
const WEEKLY_RANGE: readonly [number, number] = [6, 8];
const YEARLY_RANGE: readonly [number, number] = [350, 380];

/**
 * How much the amount may move. A subscription is fixed; an energy bill is
 * not, and proposing a fixed template for something that varies by half
 * would put a wrong number into every projection.
 */
const MAX_VARIABILITY = 0.15;

function daysBetween(earlier: string, later: string): number {
  return (
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
    86_400_000
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function within(
  value: number,
  [low, high]: readonly [number, number],
): boolean {
  return value >= low && value <= high;
}

/** ISO weekday, Monday = 1. */
function isoWeekday(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

/** The cadence a run of gaps agrees on, if any. */
function cadenceOf(gaps: readonly number[]): Recurrence | null {
  if (gaps.length === 0) {
    return null;
  }
  const typical = median(gaps);
  if (within(typical, WEEKLY_RANGE)) {
    return "weekly";
  }
  if (within(typical, MONTHLY_RANGE)) {
    return "monthly";
  }
  if (within(typical, YEARLY_RANGE)) {
    return "yearly";
  }
  return null;
}

/**
 * Standing charges the statement implies.
 *
 * Grouped on the coarse bank key rather than the exact note, because a
 * terminal spells the same shop differently every visit — the same reason
 * the feed matches that way.
 */
export function detectRecurring(
  transactions: readonly DetectionInput[],
): RecurringProposal[] {
  const groups = new Map<string, DetectionInput[]>();

  for (const tx of transactions) {
    // Income arrives on someone else's schedule and a salary is not a
    // standing instruction the user issues; proposing one would put an
    // employer's payroll run into their own forecast.
    if (tx.categoryType === "income") {
      continue;
    }
    const key = bankMerchantKey(tx.note);
    if (key === "") {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }

  const proposals: RecurringProposal[] = [];

  for (const [key, rows] of groups) {
    if (rows.length < MIN_OCCURRENCES) {
      continue;
    }

    const ordered = [...rows].sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn),
    );

    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      gaps.push(
        daysBetween(ordered[i - 1]!.occurredOn, ordered[i]!.occurredOn),
      );
    }

    const recurrence = cadenceOf(gaps);
    if (!recurrence) {
      continue;
    }

    const amounts = ordered.map((row) => row.amount);
    const typical = median(amounts);
    if (typical <= 0) {
      continue;
    }
    const spread = (Math.max(...amounts) - Math.min(...amounts)) / typical;
    if (spread > MAX_VARIABILITY) {
      continue;
    }

    // The category the run mostly agreed on. A split verdict means the group
    // is really two things, and it should not become one template.
    const counts = new Map<string, number>();
    for (const row of ordered) {
      counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    }
    const [dominantId, dominantCount] = [...counts].sort(
      (a, b) => b[1] - a[1],
    )[0]!;
    if (dominantCount / ordered.length < 0.75) {
      continue;
    }

    const latest = ordered[ordered.length - 1]!;
    const dominant =
      ordered.find((row) => row.categoryId === dominantId) ?? latest;

    proposals.push({
      key,
      label: latest.note?.trim() || key,
      categoryId: dominant.categoryId,
      categoryName: dominant.categoryName,
      categoryType: dominant.categoryType,
      recurrence,
      dayOfMonth:
        recurrence === "weekly"
          ? null
          : Math.round(median(ordered.map((r) => dayOfMonth(r.occurredOn)))),
      dayOfWeek:
        recurrence === "weekly"
          ? Math.round(median(ordered.map((r) => isoWeekday(r.occurredOn))))
          : null,
      // The most recent, not the average: a price rise should carry forward
      // rather than be averaged away with the year before it.
      amount: latest.amount,
      count: ordered.length,
      lastSeenOn: latest.occurredOn,
      variability: Math.round(spread * 100) / 100,
    });
  }

  // Biggest commitment first, which is the order they matter in.
  return proposals.sort(
    (left, right) =>
      right.amount * cadenceWeight(right.recurrence) -
      left.amount * cadenceWeight(left.recurrence),
  );
}

/** Roughly how many times a year each cadence bills. */
function cadenceWeight(recurrence: Recurrence): number {
  return recurrence === "weekly" ? 52 : recurrence === "monthly" ? 12 : 1;
}

/**
 * Proposals worth showing: still live, and not already covered by a template
 * the user has. A charge last seen six months ago has lapsed.
 */
export function filterLiveProposals(
  proposals: readonly RecurringProposal[],
  today: string,
  existingKeys: ReadonlySet<string>,
): RecurringProposal[] {
  return proposals.filter((proposal) => {
    if (existingKeys.has(proposal.key)) {
      return false;
    }
    const staleAfter = proposal.recurrence === "yearly" ? 400 : 70;
    return daysBetween(proposal.lastSeenOn, today) <= staleAfter;
  });
}
