/**
 * How the month is actually going, in the one figure people open the app for.
 *
 * Every total elsewhere in the app is a sum of movements — honest, and not
 * the question anyone has at the shop. That question is "can I spend this",
 * and answering it needs three things the app already holds separately: what
 * the account holds right now, what the rest of the month has already
 * promised to take out of it, and what is still due to arrive.
 *
 * The difference is the only number on the Month screen worth reading first.
 * It is deliberately not the same as "left this month", which measures income
 * against spending and says nothing about whether the money is in the
 * account: a month can be comfortably in surplus on paper while the rent
 * leaves tomorrow and the salary lands in a week.
 *
 * The second half of this is the part the app is unusual for knowing: how
 * much has left the account so far this month that no transaction explains.
 * That is measured rather than remembered, and comparing it against the
 * user's own normal is what turns a ledger into something worth keeping up
 * with. It is provisional by nature — a month is not over — so it is named
 * "so far" everywhere it surfaces and never presented as a close.
 *
 * Kept free of database and provider concerns so the arithmetic is testable
 * on its own.
 */

import { recordedOutflow, type RecordedCashFlows } from "./month-close";

/** Sub-cent differences are rounding, not findings. Same as a close uses. */
const TOLERANCE = 0.01;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface MonthPulseInput {
  /**
   * What the accounts the user spends from hold right now, or null when there
   * is no bank connected or its balance could not be read. Null is ordinary
   * and every figure that depends on it comes back null too — an invented
   * balance is far worse than an absent one.
   */
  onHand: number | null;
  /** What the rest of the month still owes: `StillToCome.leaving`. */
  committed: number;
  /** What is still due to arrive: `StillToCome.arriving`. */
  arriving: number;
  /** What this month has recorded so far. */
  flows: RecordedCashFlows;
  /**
   * The balance the last close left behind, or null when nothing has been
   * closed. Without it there is nothing to measure unrecorded spending from.
   */
  openingBalance: number | null;
  /** The user's cap on unrecorded spending, or null if they have not set one. */
  cap: number | null;
}

/**
 * Whether the month is comfortable, and if not, why not.
 *
 * `tight` is defined against the user's own cap rather than an invented
 * percentage: having less slack left than a normal month's unrecorded
 * spending is exactly the condition worth warning about, and it is the only
 * threshold here the user could be said to have chosen. Without a cap there
 * is no honest middle, so a month is either short or it is not.
 */
export type MonthStanding = "unknown" | "clear" | "tight" | "short";

export interface MonthPulse {
  onHand: number | null;
  committed: number;
  arriving: number;
  /**
   * What the account is on course to hold once everything the month already
   * knows about has happened. Null without a readable balance.
   */
  free: number | null;
  /**
   * What has left the account this month that the ledger cannot explain.
   *
   * Null when there is no readable balance or nothing has been closed, and
   * never negative: a balance higher than the records allow means something
   * is missing from the ledger, which `overRecorded` says instead.
   */
  unrecordedSoFar: number | null;
  /** The account holds more than the records allow — something is missing. */
  overRecorded: boolean;
  cap: number | null;
  /** `unrecordedSoFar` as a fraction of the cap, for a progress meter. */
  capRatio: number | null;
  overCap: boolean;
  standing: MonthStanding;
}

export function buildMonthPulse({
  onHand,
  committed,
  arriving,
  flows,
  openingBalance,
  cap,
}: MonthPulseInput): MonthPulse {
  const free =
    onHand === null ? null : roundMoney(onHand - committed + arriving);

  // The same arithmetic a close does, with today's balance standing in for
  // the one a close would read on the fifth of next month. That makes it an
  // estimate of a figure rather than the figure, which is why nothing here
  // writes a close.
  const gap =
    onHand === null || openingBalance === null
      ? null
      : roundMoney(
          openingBalance + flows.income - recordedOutflow(flows) - onHand,
        );

  const overRecorded = gap !== null && gap < -TOLERANCE;
  const unrecordedSoFar =
    gap === null || overRecorded ? null : Math.max(0, gap);

  const capRatio =
    unrecordedSoFar === null || cap === null || cap <= 0
      ? null
      : roundMoney(unrecordedSoFar / cap);

  const overCap =
    unrecordedSoFar !== null &&
    cap !== null &&
    unrecordedSoFar > cap + TOLERANCE;

  return {
    onHand,
    committed: roundMoney(committed),
    arriving: roundMoney(arriving),
    free,
    unrecordedSoFar,
    overRecorded,
    cap,
    capRatio,
    overCap,
    standing: standingOf(free, cap),
  };
}

function standingOf(free: number | null, cap: number | null): MonthStanding {
  if (free === null) {
    return "unknown";
  }
  if (free < 0) {
    return "short";
  }
  if (cap !== null && free < cap) {
    return "tight";
  }
  return "clear";
}

/**
 * What the headline figure is called, given what is known.
 *
 * The wording carries the claim, so it changes with the claim. With a
 * readable balance the figure is money that exists in an account; without one
 * it is the month's arithmetic, which is a different and weaker thing, and
 * calling both "on hand" would be the kind of small lie that costs an app its
 * credibility the first time someone checks.
 */
export function pulseHeadline(pulse: MonthPulse): string {
  if (pulse.onHand === null) {
    return "Left this month";
  }
  return pulse.free !== null && pulse.free < 0 ? "Short by" : "Yours to spend";
}

/**
 * One line explaining the headline, without repeating the number above it.
 */
export function pulseExplanation(pulse: MonthPulse): string {
  if (pulse.onHand === null) {
    return "Connect a bank to see what is actually in your account.";
  }
  if (pulse.committed <= 0 && pulse.arriving <= 0) {
    return "Nothing else is due this month.";
  }
  if (pulse.arriving <= 0) {
    return "After everything still due to leave.";
  }
  if (pulse.committed <= 0) {
    return "Including what is still due to arrive.";
  }
  return "After what is still due to leave, and what is still to arrive.";
}
