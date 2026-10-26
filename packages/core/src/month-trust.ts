import { CLOSE_HREF } from "./attention";
import type { Key, Vars } from "./i18n/t";

/**
 * « Fiabilité du mois »: what backs the month's figures, said as facts.
 *
 * The app's promise is that a month's figures survive being checked
 * against the bank. Whether they have been is spread over four things the
 * reader could not see together: how far the bank's or a statement's lines
 * reach into the month, whether the charges it expected have arrived, what
 * still waits in « À vérifier », and whether the month was closed and what
 * the close found. This module puts the four on one card, each as a
 * measurement with an i18n key — never a verdict, never a score.
 *
 * Like `attention`, it carries no rendered text: an amount is handed on as a
 * number and a day as an ISO date, for the client to format in the reader's
 * currency and language.
 */

export type TrustTone = "ok" | "waiting" | "none";

export type TrustId = "coverage" | "charges" | "inbox" | "close";

export interface TrustSignal {
  id: TrustId;
  /**
   * `ok`: the thing is there. `waiting`: it is expected and not there yet.
   * `none`: it does not apply, or never will for this month.
   */
  tone: TrustTone;
  messageKey: Key;
  params?: Vars;
  /** An amount the message names, for the client to format. */
  amount?: number;
  /** A day the message names, ISO, for the client to format. */
  date?: string;
  /** Where the thing is done, when it can be. */
  href?: string;
}

export interface MonthTrustInput {
  period: "past" | "current" | "future";
  /** Today, ISO, in the app's time zone. */
  today: string;
  /** This month's close, when it has one. */
  close: { unrecorded: number | null; kept: number | null } | null;
  /** The day the close can be made, ISO, for the month in progress. */
  closeDue: string | null;
  /** Whether this month is the one a close waits on now. */
  closable: boolean;
  /** Any line, the bank's or a statement's, has ever come in. */
  feeds: boolean;
  /** The lines dated in the month, and the last day one reached. */
  coverage: { lines: number; lastDay: string | null; pending: number };
  /** Of the charges due so far: arrived, and still awaited. */
  charges: { arrived: number; awaited: number };
}

/**
 * How many days behind today the last line may be before the month in
 * progress is said to be waiting for its bank: a weekend and a bank's
 * settlement delay, not a missed statement.
 */
export const COVERAGE_STALE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((to - from) / DAY_MS);
}

/**
 * The month's signals, in a fixed order — from the raw material to the
 * verdict: the lines, the charges, the inbox, the close. A month ahead has
 * nothing to say yet, and says nothing.
 */
export function buildMonthTrust(input: MonthTrustInput): TrustSignal[] {
  if (input.period === "future") {
    return [];
  }
  const signals: TrustSignal[] = [];

  /* --------------------------------------------------------- the lines */

  if (!input.feeds) {
    signals.push({
      id: "coverage",
      tone: "none",
      messageKey: "bearingMonth.trust.typedByHand",
    });
  } else if (input.coverage.lines === 0 || !input.coverage.lastDay) {
    signals.push({
      id: "coverage",
      tone: input.period === "current" ? "waiting" : "none",
      messageKey: "bearingMonth.trust.noLines",
    });
  } else {
    const stale =
      input.period === "current" &&
      daysBetween(input.coverage.lastDay, input.today) > COVERAGE_STALE_DAYS;
    signals.push({
      id: "coverage",
      tone: stale ? "waiting" : "ok",
      messageKey: "bearingMonth.trust.coveredUntil",
      date: input.coverage.lastDay,
    });
  }

  /* ------------------------------------------------------- the charges */

  // Only where something outside the app records them: without a bank or a
  // statement, a charge is written on its day and there is nothing to await.
  if (input.feeds) {
    if (input.charges.awaited > 0) {
      signals.push({
        id: "charges",
        tone: "waiting",
        messageKey: "bearingMonth.trust.chargesAwaited",
        params: { count: input.charges.awaited },
        href: "/transactions",
      });
    } else if (input.charges.arrived > 0) {
      signals.push({
        id: "charges",
        tone: "ok",
        messageKey: "bearingMonth.trust.chargesArrived",
        params: { count: input.charges.arrived },
      });
    }
  }

  /* --------------------------------------------------------- the inbox */

  if (input.coverage.pending > 0) {
    signals.push({
      id: "inbox",
      tone: "waiting",
      messageKey: "bearingMonth.trust.inboxPending",
      params: { count: input.coverage.pending },
      href: "/transactions?review=inbox",
    });
  } else if (input.feeds && input.coverage.lines > 0) {
    signals.push({
      id: "inbox",
      tone: "ok",
      messageKey: "bearingMonth.trust.inboxClear",
    });
  }

  /* --------------------------------------------------------- the close */

  if (input.close) {
    if (input.close.unrecorded !== null) {
      signals.push({
        id: "close",
        tone: "ok",
        messageKey: "bearingMonth.trust.closed",
        amount: input.close.unrecorded,
      });
    } else if (input.close.kept !== null) {
      signals.push({
        id: "close",
        tone: "ok",
        messageKey: "bearingMonth.trust.closedClear",
      });
    } else {
      signals.push({
        id: "close",
        tone: "ok",
        messageKey: "bearingMonth.trust.closedBaseline",
      });
    }
  } else if (input.closable) {
    signals.push({
      id: "close",
      tone: "waiting",
      messageKey: "bearingMonth.trust.closeReady",
      href: CLOSE_HREF,
    });
  } else if (input.period === "current" && input.closeDue) {
    signals.push({
      id: "close",
      tone: "waiting",
      messageKey: "bearingMonth.trust.closeDue",
      date: input.closeDue,
    });
  } else {
    signals.push({
      id: "close",
      tone: "none",
      messageKey: "bearingMonth.trust.notClosed",
    });
  }

  return signals;
}
