/**
 * What an arrangement costs, and when it has aged.
 *
 * Deliberately thin. The ceiling logic — reserve before the call, refuse
 * while one is in flight, forgive an abandoned reservation, cool down between
 * presses — is already written and tested in `month-read-budget.ts`, and a
 * second copy of it would be a second place for the one bug that matters
 * here to hide. So this module supplies the numbers that differ, the wording
 * that differs, and nothing else.
 *
 * Two things genuinely differ from a month read. The allowance is per
 * calendar month but the thing it buys is not about a month, so the tally is
 * keyed by user and month-of-asking rather than by the month written about.
 * And an arrangement is never "provisional": a month read of a running month
 * is expected to drift and saying so would be noise, whereas a Bearing is a
 * position taken on a day and figures moving under it is exactly the news
 * worth reporting.
 */

import { describePullAge } from "./bank-pull";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { BearingFacts } from "./bearing-facts";
import {
  movedFacts,
  type FactMove,
  type MonthReadTally,
  type WriteRefusal,
} from "./month-read-budget";

/**
 * Higher than a month read's five, and for a plain reason: this is the
 * landing surface. Somebody who reorganises their tiles on a Monday and again
 * after payday has not done anything unreasonable, and a ceiling that makes
 * the app's front page feel rationed is the wrong trade for a few cents.
 */
export const BEARING_ARRANGEMENTS_PER_MONTH = 8;

/** A double press is one call, not two. */
export const BEARING_COOLDOWN_SECONDS = 60;

/** Longer than any answer takes, short enough not to strand a retry. */
export const BEARING_RESERVATION_SECONDS = 120;

/** What is left of this month's allowance. */
export function arrangementsRemaining(
  tally: MonthReadTally | null,
  allowance: number = BEARING_ARRANGEMENTS_PER_MONTH,
): number {
  return Math.max(0, allowance - (tally?.writes ?? 0));
}

/** A refusal in words, for a button's label or a route's answer. */
export function explainArrangementRefusal(
  refusal: WriteRefusal,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = translator(locale);
  switch (refusal.reason) {
    case "allowance-spent":
      return t("bearing.allowanceSpent", { allowance: refusal.allowance });
    case "cooling-down":
      return t("bearing.coolingDown", { seconds: refusal.retryAfterSeconds });
    case "in-flight":
      return t("bearing.inFlight");
    case "nothing-to-say":
      return t("bearing.nothingToSay");
    case "untracked":
      return t("bearing.untracked");
  }
}

/* ---------------------------------------------------------- freshness */

export interface ArrangementFreshness {
  /** Whether the figures it was chosen against are where they were. */
  standing: "current" | "moved";
  /** "20 min ago", "yesterday". */
  age: string;
  moved: FactMove[];
}

export interface ArrangementFreshnessQuestion {
  storedFacts: BearingFacts;
  currentFacts: BearingFacts;
  /** From `arrangementFooting` — the tiles chosen and what their captions cite. */
  footing: readonly string[];
  arrangedAt: string;
  now: string;
}

/**
 * Whether an arrangement still rests on the figures it was chosen for.
 *
 * Only the cited datums count, which is the same rule a month read uses: a
 * figure nobody chose moving is not staleness, it is Tuesday. What makes this
 * worth saying at all is that the *choice* is the product here — if the
 * numbers that made a tile worth leading with have moved, the ordering below
 * is an opinion about a position that no longer exists.
 */
export function describeArrangementFreshness({
  storedFacts,
  currentFacts,
  footing,
  arrangedAt,
  now,
}: ArrangementFreshnessQuestion): ArrangementFreshness {
  const moved = movedFacts(storedFacts, currentFacts, footing);

  return {
    standing: moved.length > 0 ? "moved" : "current",
    age: describePullAge(arrangedAt, now),
    moved,
  };
}
