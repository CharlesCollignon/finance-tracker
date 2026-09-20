/**
 * What a wallet read costs, and when it has aged.
 *
 * Deliberately thin, and for a reason worth stating rather than borrowing:
 * the ceiling logic — reserve before the call, refuse while one is in flight,
 * forgive an abandoned reservation, cool down between presses — is already
 * written and tested in `month-read-budget.ts`, and a second copy of it would
 * be a second place for the one bug that matters here to hide. So this module
 * supplies the numbers that differ, the wording that differs, one refusal
 * that does not exist elsewhere, and nothing else.
 *
 * ## The refusal that is new
 *
 * A wallet read is a verdict on a portfolio, and a portfolio mostly sits
 * still. Pressing the button twice over a month in which nothing was bought
 * and no price moved enough to matter would spend an allowance to be told the
 * same thing — so `unchanged` refuses before the call rather than after it.
 *
 * That is a real difference from the other two surfaces, not a local
 * preference. A month read of a running month is *expected* to drift, and a
 * Bearing is a position taken on a day where movement is the news. Here, the
 * absence of movement is itself the answer.
 */

import { describePullAge } from "./bank-pull";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { factsDigest } from "./month-facts";
import {
  decideMonthReadWrite,
  movedFacts,
  type FactMove,
  type MonthReadTally,
  type WriteRefusal,
} from "./month-read-budget";
import type { LookThroughFacts } from "./look-through-facts";

/**
 * Lower than a month read's five, and lower than the Bearing's eight.
 *
 * A portfolio changes on the scale of months, so four reads a year apart
 * would be generous and four in one month is already more than the data can
 * justify. The `unchanged` refusal below is what actually rations this in
 * practice; the ceiling is only there for the case where somebody really is
 * trading every week.
 */
export const WALLET_READS_PER_MONTH = 4;

/** A double press is one call, not two. */
export const WALLET_READ_COOLDOWN_SECONDS = 60;

/** Longer than any answer takes, short enough not to strand a retry. */
export const WALLET_READ_RESERVATION_SECONDS = 180;

/** What is left of this month's allowance. */
export function walletReadsRemaining(
  tally: MonthReadTally | null,
  allowance: number = WALLET_READS_PER_MONTH,
): number {
  return Math.max(0, allowance - (tally?.writes ?? 0));
}

export type WalletWriteRefusal = WriteRefusal | { reason: "unchanged" };

export type WalletWriteDecision =
  | { write: true }
  | ({ write: false } & WalletWriteRefusal);

export interface WalletWriteQuestion {
  tally: MonthReadTally | null;
  facts: LookThroughFacts;
  /** The digest stored beside the last read, or null if there is none. */
  storedDigest: string | null;
  now: string;
  /** False when migration 033 has not been run. */
  tracked: boolean;
  allowance?: number;
  cooldownSeconds?: number;
  reservationSeconds?: number;
}

/**
 * Whether to spend a call.
 *
 * The shared checks are delegated rather than reimplemented. Only the
 * `unchanged` test is local, and it runs after `nothing-to-say` — a portfolio
 * too thin to read about is a better thing to say than "nothing has moved",
 * which would be true but would imply there had once been something to move.
 */
export function decideWalletReadWrite({
  tally,
  facts,
  storedDigest,
  now,
  tracked,
  allowance = WALLET_READS_PER_MONTH,
  cooldownSeconds = WALLET_READ_COOLDOWN_SECONDS,
  reservationSeconds = WALLET_READ_RESERVATION_SECONDS,
}: WalletWriteQuestion): WalletWriteDecision {
  const shared = decideMonthReadWrite({
    tally,
    facts,
    now,
    tracked,
    allowance,
    cooldownSeconds,
    reservationSeconds,
  });

  if (!shared.write) {
    return shared;
  }

  if (storedDigest !== null && storedDigest === factsDigest(facts)) {
    return { write: false, reason: "unchanged" };
  }

  return { write: true };
}

/** A refusal in words, for a button's label or a route's answer. */
export function explainWalletReadRefusal(
  refusal: WalletWriteRefusal,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = translator(locale);
  switch (refusal.reason) {
    case "allowance-spent":
      return t("walletRead.allowanceSpent", { allowance: refusal.allowance });
    case "cooling-down":
      return t("walletRead.coolingDown", {
        seconds: refusal.retryAfterSeconds,
      });
    case "in-flight":
      return t("walletRead.inFlight");
    case "nothing-to-say":
      return t("walletRead.nothingToSay");
    case "unchanged":
      return t("walletRead.unchanged");
    case "untracked":
      return t("walletRead.untracked");
  }
}

/* ------------------------------------------------------------ freshness */

export interface WalletReadFreshness {
  /** Whether the figures it was written against are where they were. */
  standing: "current" | "moved";
  /** "20 min ago", "yesterday". */
  age: string;
  moved: FactMove[];
}

export interface WalletReadFreshnessQuestion {
  storedFacts: LookThroughFacts;
  currentFacts: LookThroughFacts;
  /** The datum ids the read declared it rests on. */
  cited: readonly string[];
  readAt: string;
  now: string;
}

/**
 * Whether a stored read still rests on the figures it was written against.
 *
 * Only the cited datums count, which is the rule both other surfaces use: a
 * figure nobody leaned on moving is not staleness, it is Tuesday. The read
 * itself is never re-rendered from stored numbers — the look-through on the
 * page is always computed fresh — so this only decides whether to say the
 * words have fallen behind the figures beside them.
 */
export function describeWalletReadFreshness({
  storedFacts,
  currentFacts,
  cited,
  readAt,
  now,
}: WalletReadFreshnessQuestion): WalletReadFreshness {
  const moved = movedFacts(storedFacts, currentFacts, cited);

  return {
    standing: moved.length > 0 ? "moved" : "current",
    age: describePullAge(readAt, now),
    moved,
  };
}

/** Every datum id a read leans on, for the freshness question above. */
export function citedDatums(read: {
  observations: readonly { basis: readonly string[] }[];
  suggestions: readonly { basis: readonly string[] }[];
}): string[] {
  return [
    ...new Set([
      ...read.observations.flatMap((row) => [...row.basis]),
      ...read.suggestions.flatMap((row) => [...row.basis]),
    ]),
  ];
}
