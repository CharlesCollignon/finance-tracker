/**
 * A property's moments: something that happened to the user's own loan or
 * home, said back to them once — on the loan's card, and by a push.
 *
 * - Half a loan repaid: the payment after which what is still owed is half
 *   of what was borrowed, or less. An in fine loan has none: it repays
 *   nothing until its last payment.
 * - A loan's last payment: the day it ends, or the day the bank said
 *   nothing was owed any more.
 * - A new estimate: a market reading whose sales reach a half-year the one
 *   before did not — the public record of sales grows twice a year — so at
 *   most twice a year for a home.
 *
 * Each is a change, not a state: a loan that passed half long before the
 * app knew it is not news, so a loan's moment counts only for a month after
 * the day it happened. Whether a push was already sent for it is the
 * notification log's to say, by its key.
 */

import { cents, loanSchedule } from "./loan-schedule";
import { loanTermsFromRow } from "./property";
import type { PropertyLoan } from "./types/database";

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

/**
 * The loan's moment as of `today`, if one happened in the last month: its
 * last payment before its halfway mark, when an early repayment made both.
 */
export function loanMoment(loan: PropertyLoan, today: string): LoanMoment | null {
  const recent = (on: string | null): on is string =>
    on !== null && on <= today && daysBetween(on, today) < MOMENT_DAYS;
  const last = lastPaymentOn(loan);
  if (recent(last)) {
    return { kind: "last", on: last };
  }
  const half = halfRepaidOn(loan);
  return recent(half) ? { kind: "half", on: half } : null;
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
