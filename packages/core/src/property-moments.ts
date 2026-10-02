/**
 * A property's moments: something that happened to the user's own loan or
 * home, said back to them once — on the loan's card, and by a push.
 *
 * - Half a loan repaid: the payment after which what is still owed is half
 *   of what was borrowed, or less. An in fine loan has none: it repays
 *   nothing until its last payment.
 * - A loan's last payment: the day it ends, or the day the bank said
 *   nothing was owed any more.
 * - Half the home the user's: the payment after which what its loans owe is
 *   half the user's part of its value or less, at today's estimate — the
 *   payments did it, so a market reading that moves the value is not it.
 * - A new estimate: a market reading whose sales reach a half-year the one
 *   before did not — the public record of sales grows twice a year — so at
 *   most twice a year for a home.
 *
 * Each is a change, not a state: a loan that passed half long before the
 * app knew it is not news, so a loan's moment counts only for a month after
 * the day it happened. Whether a push was already sent for it is the
 * notification log's to say, by its key.
 */

import { cents, loanSchedule, outstandingOn } from "./loan-schedule";
import {
  estimatedValue,
  loanTermsFromRow,
  type MarketContext,
} from "./property";
import type { Property, PropertyLoan } from "./types/database";

/** How long a loan's moment stays news, from the day it happened. */
export const MOMENT_DAYS = 31;

/** The day a loan's outstanding principal first fell to half or less. */
export function halfRepaidOn(loan: PropertyLoan): string | null {
  if (loan.kind === "in_fine") {
    return null;
  }
  const terms = loanTermsFromRow(loan);
  const half = terms.principal / 2;
  const known = terms.known;
  for (const row of loanSchedule(terms)) {
    // The bank's own figure, when it came before this payment and already
    // said half or less: an early repayment crossed it that day.
    if (known && known.on < row.on && known.outstanding <= half) {
      return known.on;
    }
    if (row.outstanding <= half) {
      return row.on;
    }
  }
  return known && known.outstanding <= half ? known.on : null;
}

/** The day a loan's last payment falls, or fell. */
export function lastPaymentOn(loan: PropertyLoan): string | null {
  const terms = loanTermsFromRow(loan);
  if (terms.known && cents(terms.known.outstanding) <= 0) {
    return terms.known.on;
  }
  return loanSchedule(terms).at(-1)?.on ?? null;
}

export interface LoanMoment {
  kind: "half" | "last";
  on: string;
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

/** Whether a moment's day is still news on `today`. */
function isRecent(on: string | null, today: string): on is string {
  return on !== null && on <= today && daysBetween(on, today) < MOMENT_DAYS;
}

/**
 * The loan's moment as of `today`, if one happened in the last month: its
 * last payment before its halfway mark, when an early repayment made both.
 */
export function loanMoment(loan: PropertyLoan, today: string): LoanMoment | null {
  const last = lastPaymentOn(loan);
  if (isRecent(last, today)) {
    return { kind: "last", on: last };
  }
  const half = halfRepaidOn(loan);
  return isRecent(half, today) ? { kind: "half", on: half } : null;
}

/**
 * The day half the user's part of a home became theirs through their
 * payments: what its loans owe fell to half that part of its estimated value
 * or less. Null when it was so from the purchase — a large deposit is not a
 * crossing — or is not yet.
 */
export function equityHalfOn(
  property: Property,
  loans: readonly PropertyLoan[],
  market: MarketContext | null,
): string | null {
  if (loans.length === 0) {
    return null;
  }
  const half =
    (estimatedValue(property, market).value * Number(property.ownership_share)) /
    2;
  const plans = loans.map((loan) => {
    const terms = loanTermsFromRow(loan);
    return {
      terms,
      schedule: loanSchedule(terms),
      part: Number(loan.borrower_share),
    };
  });
  const owedOn = (day: string) =>
    plans.reduce(
      (total, { terms, schedule, part }) =>
        total + outstandingOn(terms, schedule, day) * part,
      0,
    );
  if (owedOn(property.purchased_on) <= half) {
    return null;
  }
  const days = [
    ...new Set(
      plans.flatMap(({ terms, schedule }) => [
        ...schedule.map((row) => row.on),
        ...(terms.known ? [terms.known.on] : []),
      ]),
    ),
  ].sort();
  return (
    days.find((day) => day >= property.purchased_on && owedOn(day) <= half) ??
    null
  );
}

/** Half the home the user's, if that happened in the last month. */
export function equityMoment(
  property: Property,
  loans: readonly PropertyLoan[],
  market: MarketContext | null,
  today: string,
): { on: string } | null {
  const on = equityHalfOn(property, loans, market);
  return isRecent(on, today) ? { on } : null;
}

/** The half-year a day falls in: « 2026-H1 ». */
export function halfYearOf(isoDate: string): string {
  return `${isoDate.slice(0, 4)}-H${Number(isoDate.slice(5, 7)) <= 6 ? 1 : 2}`;
}

/**
 * Whether a fresh reading brings sales the last one did not have: its last
 * sale falls in a later half-year. A home with no reading before has
 * nothing to compare with, and is not news.
 */
export function isNewRelease(
  previousPeriodTo: string | null,
  periodTo: string,
): boolean {
  return (
    previousPeriodTo !== null &&
    halfYearOf(periodTo) > halfYearOf(previousPeriodTo)
  );
}
