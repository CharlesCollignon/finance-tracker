/**
 * Which bank movement looks like the occurrence a template called for.
 *
 * Two records describe the same rent: the template that says €780 leaves on
 * the 5th, and the bank row that says €780 left on the 4th. Nothing connected
 * them, so every recurring charge the bank delivers was counted twice — once
 * as money that moved and once as money still forecast to move. On a salary
 * that is a whole month's income added to a figure the user is about to spend
 * against.
 *
 * This proposes the pairings. It does not make them. An earlier version of
 * this app matched bank rows to templates on amount and a five-day window,
 * which "turned out to prove nothing on a statement full of small round
 * figures" — and had to grow a recovery action to reopen the ones it swallowed.
 * So the output here is a list of questions, every one of which waits for a
 * press, and the thresholds are set to make the questions few rather than to
 * make the matching clever.
 *
 * Kept free of database concerns so the rules are testable on their own.
 */

import { recurringOccurrenceKey } from "./apply-recurring";
import type { CategoryType } from "./types/database";

/**
 * How far the amount may differ, as a fraction of what was expected.
 *
 * A salary moves with overtime and a subscription with VAT, so an exact match
 * would offer almost nothing. Five per cent is wide enough for both and
 * narrow enough that two different charges of a similar size are not
 * confused.
 */
export const MAX_AMOUNT_DRIFT = 0.05;

/**
 * The floor under that, in currency units.
 *
 * Five per cent of €4 is 20 cents, which no real charge respects. Below this
 * the absolute tolerance is what applies.
 */
export const MIN_AMOUNT_TOLERANCE = 1.5;

/**
 * How many days either side of the occurrence to look.
 *
 * A charge due on the 5th lands on the 3rd when the 5th is a Sunday, and a
 * salary due on the last day of the month arrives on the 1st. Four days
 * covers a weekend and a bank holiday; much more and a monthly charge starts
 * being a candidate for two consecutive occurrences at once.
 */
export const MAX_DAYS_APART = 4;

export interface FulfilmentOccurrence {
  templateId: string;
  /** The date the template calls for. */
  occurredOn: string;
  /** What the template says the amount is. */
  amount: number;
  categoryId: string;
  categoryType: CategoryType;
  /** What to call it on screen. */
  label: string;
}

export interface FulfilmentMovement {
  transactionId: string;
  occurredOn: string;
  amount: number;
  categoryId: string;
  /** The bank's own words, for a row the user has to recognise. */
  note: string | null;
}

export interface FulfilmentProposal {
  /** Stable across renders: the occurrence this would fulfil. */
  key: string;
  templateId: string;
  label: string;
  /** The occurrence, as the template describes it. */
  occurredOn: string;
  expectedAmount: number;
  categoryType: CategoryType;
  /** The movement that looks like it. */
  transactionId: string;
  actualAmount: number;
  actualOn: string;
  actualNote: string | null;
  /** Signed: positive when more moved than expected. */
  difference: number;
  /** Whole days between the occurrence and the movement, unsigned. */
  daysApart: number;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    Math.abs(Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) /
      86_400_000,
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether an amount is close enough to have been the same charge. */
export function amountsMatch(expected: number, actual: number): boolean {
  const tolerance = Math.max(
    MIN_AMOUNT_TOLERANCE,
    Math.abs(expected) * MAX_AMOUNT_DRIFT,
  );
  return Math.abs(expected - actual) <= tolerance + 1e-9;
}

/**
 * How poor a pairing is, for choosing between two candidates.
 *
 * Days first and amount second, deliberately. Two charges of the same size in
 * one month are usually the same standing charge paid twice; two charges on
 * the same day are usually unrelated. So the nearer date wins, and the amount
 * only breaks a tie.
 */
function cost(occurrence: FulfilmentOccurrence, movement: FulfilmentMovement) {
  const days = daysBetween(occurrence.occurredOn, movement.occurredOn);
  const drift = Math.abs(occurrence.amount - movement.amount);
  return days * 1000 + drift;
}

export interface ProposeOptions {
  /**
   * Today, ISO. Required, because the question this asks is "did this
   * arrive", and a movement dated after today has not.
   *
   * The occurrence may still be in the future — a charge due on the 5th and
   * paid by the bank on the 3rd is the case this whole feature exists for.
   * It is the *movement* that has to have happened. Without this the app
   * offered to reconcile a forecast against a forecast: an EDF charge dated
   * the 17th against an EDF occurrence dated the 17th, "the same to the
   * cent", thirteen days before either had happened.
   */
  today: string;
  /** Occurrences already fulfilled, as `recurringOccurrenceKey` values. */
  fulfilledKeys?: ReadonlySet<string>;
  /**
   * Pairings the user has already refused, as `${templateId}:${date}:${txId}`.
   * A refusal names the pair rather than the occurrence, so a better
   * candidate arriving later is still offered.
   */
  refusedPairs?: ReadonlySet<string>;
  /** Transactions already standing in for some occurrence. */
  claimedTransactionIds?: ReadonlySet<string>;
}

/** The key a refusal is recorded under. */
export function refusalKey(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): string {
  return `${templateId}:${occurredOn}:${transactionId}`;
}

/**
 * Pair up what a template expects with what the bank actually reported.
 *
 * One movement may fulfil at most one occurrence and one occurrence at most
 * one movement — otherwise a single rent payment could cancel two months of
 * forecast, which halves the month's expected outgoings on the strength of
 * one debit. Resolved greedily by closeness, best pairings first, which is
 * enough: the candidate sets here are a handful of rows, not a matching
 * problem.
 */
export function proposeFulfilments(
  occurrences: readonly FulfilmentOccurrence[],
  movements: readonly FulfilmentMovement[],
  {
    today,
    fulfilledKeys = new Set(),
    refusedPairs = new Set(),
    claimedTransactionIds = new Set(),
  }: ProposeOptions,
): FulfilmentProposal[] {
  const pairs: {
    occurrence: FulfilmentOccurrence;
    movement: FulfilmentMovement;
    score: number;
  }[] = [];

  for (const occurrence of occurrences) {
    if (
      fulfilledKeys.has(
        recurringOccurrenceKey(occurrence.templateId, occurrence.occurredOn),
      )
    ) {
      continue;
    }

    for (const movement of movements) {
      // Nothing dated after today has arrived. This is the first check
      // because it is the only one that is about the question rather than
      // about the closeness of the match.
      if (movement.occurredOn > today) {
        continue;
      }
      if (claimedTransactionIds.has(movement.transactionId)) {
        continue;
      }
      // The category is the one signal that is a fact rather than a
      // coincidence: the user put this movement in this category, and a
      // salary template can only ever be fulfilled by income filed as salary.
      if (movement.categoryId !== occurrence.categoryId) {
        continue;
      }
      if (
        daysBetween(occurrence.occurredOn, movement.occurredOn) > MAX_DAYS_APART
      ) {
        continue;
      }
      if (!amountsMatch(occurrence.amount, movement.amount)) {
        continue;
      }
      if (
        refusedPairs.has(
          refusalKey(
            occurrence.templateId,
            occurrence.occurredOn,
            movement.transactionId,
          ),
        )
      ) {
        continue;
      }

      pairs.push({
        occurrence,
        movement,
        score: cost(occurrence, movement),
      });
    }
  }

  pairs.sort((left, right) => left.score - right.score);

  const usedOccurrences = new Set<string>();
  const usedMovements = new Set<string>();
  const proposals: FulfilmentProposal[] = [];

  for (const { occurrence, movement } of pairs) {
    const key = recurringOccurrenceKey(
      occurrence.templateId,
      occurrence.occurredOn,
    );
    if (usedOccurrences.has(key) || usedMovements.has(movement.transactionId)) {
      continue;
    }
    usedOccurrences.add(key);
    usedMovements.add(movement.transactionId);

    proposals.push({
      key,
      templateId: occurrence.templateId,
      label: occurrence.label,
      occurredOn: occurrence.occurredOn,
      expectedAmount: occurrence.amount,
      categoryType: occurrence.categoryType,
      transactionId: movement.transactionId,
      actualAmount: movement.amount,
      actualOn: movement.occurredOn,
      actualNote: movement.note,
      difference: roundMoney(movement.amount - occurrence.amount),
      daysApart: daysBetween(occurrence.occurredOn, movement.occurredOn),
    });
  }

  // Soonest first, so the list reads in the order the month happened.
  proposals.sort(
    (left, right) =>
      left.actualOn.localeCompare(right.actualOn) ||
      right.actualAmount - left.actualAmount,
  );

  return proposals;
}

/**
 * How to describe a pairing in one line, without repeating the amount.
 *
 * The difference is the part worth saying: "the same to the cent" is
 * reassuring, "€33 more than expected" is the reason to look twice before
 * pressing, and both are more useful than restating a figure already on the
 * row.
 */
export function describeFulfilment(
  proposal: FulfilmentProposal,
  formatMoney: (amount: number) => string,
): string {
  // "on the day" beside a date label reads as a second, contradictory date:
  // "Yesterday … on the day". It is the *due* day that was hit.
  const when =
    proposal.daysApart === 0
      ? "on the day it was due"
      : `${proposal.daysApart} day${proposal.daysApart === 1 ? "" : "s"} ${
          proposal.actualOn > proposal.occurredOn ? "late" : "early"
        }`;

  if (Math.abs(proposal.difference) < 0.005) {
    return `The same to the cent, ${when}`;
  }

  const more = proposal.difference > 0;
  return `${formatMoney(Math.abs(proposal.difference))} ${
    more ? "more" : "less"
  } than expected, ${when}`;
}

/* ------------------------------------------------------- why not, though */

/**
 * Why an occurrence was not offered a movement.
 *
 * The thresholds here are deliberately narrow, and a narrow matcher is a
 * silent one: the first report of this feature in use was "there are two
 * identical charges in my ledger and neither was proposed", with no way to
 * find out whether that was the amount, the date, the category or a template
 * with no occurrence this month at all.
 *
 * So the near misses are computed too. Not to loosen the rules — a wrong
 * match hides real spending, which is the failure this design exists to avoid
 * — but so the user can see the rule that excluded a pairing and fix the
 * template, rather than concluding the feature does not work.
 */
export type MissReason =
  /** Nothing in the same category anywhere near it. */
  | "nothing-alike"
  /** Same category and close in time, but the amount is too far off. */
  | "amount"
  /** Same category and amount, but too many days apart. */
  | "date"
  /** A match in every respect except that it has not happened yet. */
  | "not-arrived"
  /** The user said this pairing was wrong. */
  | "refused";

export interface FulfilmentMiss {
  key: string;
  label: string;
  occurredOn: string;
  expectedAmount: number;
  categoryType: CategoryType;
  reason: MissReason;
  /** The closest candidate found, when one was found at all. */
  nearest: {
    amount: number;
    occurredOn: string;
    note: string | null;
    daysApart: number;
  } | null;
}

/**
 * What stopped each unmatched occurrence from being offered.
 *
 * Only occurrences with no proposal are considered, so this and
 * `proposeFulfilments` together account for every occurrence exactly once.
 * The reason reported is the *first* rule the nearest candidate broke, in the
 * order a person would ask about them: is there anything like it, has it
 * happened, is it the right size, is it near enough.
 */
export function explainFulfilmentMisses(
  occurrences: readonly FulfilmentOccurrence[],
  movements: readonly FulfilmentMovement[],
  proposals: readonly FulfilmentProposal[],
  {
    today,
    fulfilledKeys = new Set(),
    refusedPairs = new Set(),
  }: ProposeOptions,
): FulfilmentMiss[] {
  const offered = new Set(proposals.map((proposal) => proposal.key));
  const misses: FulfilmentMiss[] = [];

  for (const occurrence of occurrences) {
    const key = recurringOccurrenceKey(
      occurrence.templateId,
      occurrence.occurredOn,
    );
    if (offered.has(key) || fulfilledKeys.has(key)) {
      continue;
    }

    // Only the same category is worth reporting on. A €90.80 transport charge
    // is not "nearly" a €90.80 grocery bill, and saying so would be noise.
    const alike = movements.filter(
      (movement) => movement.categoryId === occurrence.categoryId,
    );

    if (alike.length === 0) {
      misses.push({
        key,
        label: occurrence.label,
        occurredOn: occurrence.occurredOn,
        expectedAmount: occurrence.amount,
        categoryType: occurrence.categoryType,
        reason: "nothing-alike",
        nearest: null,
      });
      continue;
    }

    // Nearest by the same measure the matcher ranks candidates with, so the
    // row explained is the row that would have been offered.
    const nearest = alike.reduce((best, movement) =>
      cost(occurrence, movement) < cost(occurrence, best) ? movement : best,
    );
    const daysApart = daysBetween(occurrence.occurredOn, nearest.occurredOn);

    const reason: MissReason = refusedPairs.has(
      refusalKey(
        occurrence.templateId,
        occurrence.occurredOn,
        nearest.transactionId,
      ),
    )
      ? "refused"
      : nearest.occurredOn > today
        ? "not-arrived"
        : !amountsMatch(occurrence.amount, nearest.amount)
          ? "amount"
          : daysApart > MAX_DAYS_APART
            ? "date"
            : // Every rule passed, so the only thing left is that some other
              // occurrence claimed this movement first.
              "nothing-alike";

    misses.push({
      key,
      label: occurrence.label,
      occurredOn: occurrence.occurredOn,
      expectedAmount: occurrence.amount,
      categoryType: occurrence.categoryType,
      reason,
      nearest: {
        amount: nearest.amount,
        occurredOn: nearest.occurredOn,
        note: nearest.note,
        daysApart,
      },
    });
  }

  return misses.sort((left, right) =>
    left.occurredOn.localeCompare(right.occurredOn),
  );
}

/** The reason in one line, for a screen that has room for it. */
export function describeMiss(
  miss: FulfilmentMiss,
  formatMoney: (amount: number) => string,
): string {
  switch (miss.reason) {
    case "nothing-alike":
      return "nothing in its category to match";
    case "refused":
      return "you said the nearest movement was not it";
    case "not-arrived":
      return "the nearest movement has not happened yet";
    case "amount":
      return miss.nearest
        ? `nearest was ${formatMoney(miss.nearest.amount)}, too far from ${formatMoney(
            miss.expectedAmount,
          )}`
        : "no movement of the right size";
    case "date":
      return miss.nearest
        ? `nearest was ${miss.nearest.daysApart} days away, beyond the ${MAX_DAYS_APART}-day window`
        : "no movement near enough in time";
  }
}
