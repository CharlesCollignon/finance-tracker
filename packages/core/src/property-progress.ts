/**
 * A property's progress, as the owner can watch it grow: how much of their
 * part of it is theirs rather than the bank's, and how far each loan has
 * come. Facts read from the schedule and the estimate — never a score.
 */

import { cents, loanSchedule, outstandingOn } from "./loan-schedule";
import { loanTermsFromRow, type PropertyPosition } from "./property";
import type { PropertyLoan } from "./types/database";

/** The marks along a loan's track and an ownership bar. */
export const PROGRESS_MARKS = [0.25, 0.5, 0.75] as const;

export interface Ownership {
  /** The user's part of the value that is theirs: less what is still owed. */
  yours: number;
  /** What the loans still owe, the user's part. */
  owed: number;
  /** `yours` over the user's part of the value, from 0 to 1. */
  share: number;
}

/**
 * How much of the user's part of a home is theirs. A loan that owes more
 * than the home is worth leaves nothing theirs, not less than nothing.
 */
export function ownership(position: PropertyPosition): Ownership {
  const yours = Math.max(0, cents(position.value - position.owed));
  return {
    yours,
    owed: position.owed,
    share: position.value > 0 ? Math.min(1, yours / position.value) : 0,
  };
}

export interface LoanProgress {
  /** What was borrowed now repaid, from 0 to 1. */
  repaid: number;
  /** The marks it has passed. */
  passed: number[];
  /** Payments still to come after today. */
  paymentsLeft: number;
  /** Its last payment. */
  endsOn: string | null;
}

/**
 * How far a loan has come on `today`. Interest a total deferral adds to
 * what is owed counts as nothing repaid yet, and an in fine loan repays
 * nothing until its last payment — both say so plainly.
 */
export function loanProgress(loan: PropertyLoan, today: string): LoanProgress {
  const terms = loanTermsFromRow(loan);
  const schedule = loanSchedule(terms);
  const owed = outstandingOn(terms, schedule, today);
  const repaid =
    terms.principal > 0
      ? Math.min(1, Math.max(0, 1 - owed / terms.principal))
      : 0;
  return {
    repaid,
    passed: PROGRESS_MARKS.filter((mark) => repaid >= mark),
    paymentsLeft: schedule.filter((row) => row.on > today).length,
    endsOn: schedule.at(-1)?.on ?? null,
  };
}
