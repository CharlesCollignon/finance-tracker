/**
 * Closing a month against the bank.
 *
 * Everywhere else this app reasons about flows: a transaction is money having
 * moved, and every total is a sum of movements it was told about. That is
 * honest but incomplete, because the spending nobody wants to type in — the
 * restaurant, the round of drinks, the thing bought on the way home — never
 * becomes a transaction. No amount of arithmetic over the ledger can find it.
 *
 * One balance a month can. If the account held X at the last close and holds
 * Y now, and the recorded movements only account for part of the difference,
 * the remainder is spending the app never heard about. That single figure is
 * worth more than a hundred entered receipts: it is measured rather than
 * remembered, it costs one number a month, and it turns "I think I did all
 * right" into an amount.
 *
 * Kept free of database concerns so the arithmetic is testable on its own.
 */

import { formatMonthLabel } from "./constants";
import type { CategoryType, TransactionWithCategory } from "./types/database";

/* ------------------------------------------------------- the cash view */

/**
 * What actually entered and left the account in a month, as recorded.
 *
 * Deliberately not `computeMonthlyBudget`, which answers a different and
 * equally correct question. Three differences matter, and getting any of them
 * wrong makes every close nonsense:
 *
 *   Yearly expenses count at face value, in the month they were paid. The
 *   budget view amortises them — a €1,200 property tax reads as €100 every
 *   month — because that is the fair way to judge a month's spending. The
 *   bank disagrees: it moved €1,200 in October and nothing in the other
 *   eleven months.
 *
 *   Deployments do not count. A DCA inside a wallet spends money that already
 *   left the current account when it was transferred in, so counting it again
 *   would invent an outflow the bank never saw.
 *
 *   Wallet transfers do count, and they live in their own table rather than
 *   among the transactions. They are the moment cash actually leaves for a
 *   broker.
 */
export interface RecordedCashFlows {
  income: number;
  /** Expenses at face value, including yearly ones in full. */
  expenses: number;
  savings: number;
  /** Cash that left for a broker, by either route. */
  transfers: number;
}

export interface WalletTransferAmount {
  amount: number;
}

export function buildRecordedCashFlows(
  transactions: readonly TransactionWithCategory[],
  walletTransfers: readonly WalletTransferAmount[] = [],
): RecordedCashFlows {
  const flows: RecordedCashFlows = {
    income: 0,
    expenses: 0,
    savings: 0,
    transfers: 0,
  };

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const type = tx.categories.type as CategoryType;

    if (type === "income") {
      flows.income += amount;
      continue;
    }

    if (type === "investment") {
      // A deployment is movement inside a wallet, not out of the account.
      if (tx.categories.counts_toward_summary === false) {
        continue;
      }
      flows.transfers += amount;
      continue;
    }

    if (type === "savings") {
      // A withdrawal is money arriving in the account, so it reduces what
      // left it. Without this the close would report the balance as
      // unexplainably high by exactly the amount moved back.
      flows.savings +=
        tx.categories.counts_toward_summary === false ? -amount : amount;
      continue;
    }

    flows.expenses += amount;
  }

  for (const transfer of walletTransfers) {
    flows.transfers += Number(transfer.amount);
  }

  return flows;
}

/** Everything the recorded movements say left the account. */
export function recordedOutflow(flows: RecordedCashFlows): number {
  return flows.expenses + flows.savings + flows.transfers;
}

/* ---------------------------------------------------- the reconciliation */

export type MonthCloseStatus =
  /** No previous close, so there is nothing to measure against yet. */
  | "baseline"
  /** The normal outcome: the balance explains itself and then some. */
  | "reconciled"
  /**
   * The account holds more than the recorded movements allow. Not a win —
   * income was missed, an expense was entered twice, or a transfer was
   * recorded by both routes.
   */
  | "over-recorded";

export interface MonthCloseInput {
  /** The previous month's closing balance, or null on the first close. */
  openingBalance: number | null;
  closingBalance: number;
  flows: RecordedCashFlows;
}

export interface MonthCloseResult {
  status: MonthCloseStatus;
  openingBalance: number | null;
  closingBalance: number;
  flows: RecordedCashFlows;
  /**
   * What the month added to the user's wealth: the cash it left behind plus
   * everything deliberately set aside. Null on a baseline close.
   */
  kept: number | null;
  /** `kept` as a percentage of income, to one decimal. Null without income. */
  keptRate: number | null;
  /**
   * Spending the balance proves happened that no transaction accounts for.
   * Null on a baseline close; never negative — a negative reconciliation is
   * reported through `status` instead, because calling it "unrecorded
   * spending of minus eighty euros" would be nonsense.
   */
  unrecorded: number | null;
  /** How far the balance overshot, when the status says it did. */
  unexplainedCredit: number | null;
}

/** Sub-cent differences are rounding, not findings. */
const TOLERANCE = 0.01;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMonthClose({
  openingBalance,
  closingBalance,
  flows,
}: MonthCloseInput): MonthCloseResult {
  const base = {
    openingBalance,
    closingBalance,
    flows,
  };

  if (openingBalance === null) {
    // Nothing to compare against. The balance is still worth storing: it is
    // what next month will measure from.
    return {
      ...base,
      status: "baseline",
      kept: null,
      keptRate: null,
      unrecorded: null,
      unexplainedCredit: null,
    };
  }

  const cashChange = closingBalance - openingBalance;
  const kept = roundMoney(cashChange + flows.savings + flows.transfers);
  const gap = roundMoney(
    openingBalance + flows.income - recordedOutflow(flows) - closingBalance,
  );

  const keptRate =
    flows.income > 0 ? Math.round((kept / flows.income) * 1000) / 10 : null;

  if (gap < -TOLERANCE) {
    return {
      ...base,
      status: "over-recorded",
      kept,
      keptRate,
      unrecorded: null,
      unexplainedCredit: roundMoney(-gap),
    };
  }

  return {
    ...base,
    status: "reconciled",
    kept,
    keptRate,
    unrecorded: Math.max(0, gap),
    unexplainedCredit: null,
  };
}

/* ---------------------------------------------------------- the history */

export interface ClosedMonthOutcome {
  /** YYYY-MM. */
  monthKey: string;
  /** Null for a baseline or over-recorded close. */
  unrecorded: number | null;
  /** Null for a baseline close. */
  kept: number | null;
}

/**
 * Whether a closed month counts as a win.
 *
 * Before a cap exists the bar is simply that the month ended ahead, which is
 * something to be pleased about and available from the second close. Once a
 * cap is set the bar sharpens to staying inside it, because by then the user
 * knows what their own unrecorded spending looks like and "ahead" is too
 * easy a target to be worth hitting.
 */
export function monthWasWon(
  outcome: ClosedMonthOutcome,
  cap: number | null,
): boolean {
  if (cap === null) {
    return outcome.kept !== null && outcome.kept > 0;
  }
  return outcome.unrecorded !== null && outcome.unrecorded <= cap + TOLERANCE;
}

/** The month before this one, as a key. */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) {
    return monthKey;
  }
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export interface CloseHistorySummary {
  /**
   * Typical unrecorded spending. The median rather than the mean: one month
   * with a holiday in it should not move what the user considers normal.
   */
  baseline: number | null;
  /** How many reconciled closes the baseline rests on. */
  sample: number;
  /** Consecutive months up to the latest close that were won. */
  streak: number;
  /** The longest run ever managed, so breaking one does not erase it. */
  bestStreak: number;
}

/**
 * What a run of closes adds up to.
 *
 * A streak requires calendar-adjacent months. Skipping a close and picking up
 * again the month after is not a run of two, and quietly treating it as one
 * would make the only number the user is trying to protect a lie.
 */
export function summarizeCloseHistory(
  outcomes: readonly ClosedMonthOutcome[],
  cap: number | null,
): CloseHistorySummary {
  const reconciled = outcomes
    .filter((outcome) => outcome.unrecorded !== null)
    .map((outcome) => outcome.unrecorded!);

  const newestFirst = [...outcomes].sort((left, right) =>
    right.monthKey.localeCompare(left.monthKey),
  );

  let streak = 0;
  let expectedKey = newestFirst[0]?.monthKey;
  for (const outcome of newestFirst) {
    if (outcome.monthKey !== expectedKey || !monthWasWon(outcome, cap)) {
      break;
    }
    streak += 1;
    expectedKey = previousMonthKey(outcome.monthKey);
  }

  // Walk oldest to newest for the best run, so adjacency reads forwards.
  const oldestFirst = [...newestFirst].reverse();
  let bestStreak = 0;
  let run = 0;
  let previousKey: string | null = null;
  for (const outcome of oldestFirst) {
    const adjacent =
      previousKey !== null &&
      previousMonthKey(outcome.monthKey) === previousKey;
    if (monthWasWon(outcome, cap)) {
      run = adjacent ? run + 1 : 1;
    } else {
      run = 0;
    }
    bestStreak = Math.max(bestStreak, run);
    previousKey = outcome.monthKey;
  }

  return {
    baseline: reconciled.length > 0 ? roundMoney(median(reconciled)) : null,
    sample: reconciled.length,
    streak,
    bestStreak,
  };
}

/** Closes worth setting a cap from. Fewer than this and it is guesswork. */
export const MIN_CLOSES_FOR_CAP = 2;

/**
 * A cap to offer the user, from what their own months look like.
 *
 * The baseline rounded down to the nearest ten: near enough to be a fair
 * description of a normal month, and low enough that hitting it is a small
 * act of restraint rather than a foregone conclusion.
 */
export function suggestUnrecordedCap(
  summary: CloseHistorySummary,
): number | null {
  if (summary.baseline === null || summary.sample < MIN_CLOSES_FOR_CAP) {
    return null;
  }
  return Math.max(0, Math.floor(summary.baseline / 10) * 10);
}

/* ----------------------------------------------------------- the payoff */

/**
 * A month's saving, in days of runway.
 *
 * A euro figure is hard to feel and easy to shrug at. The same amount
 * expressed as time bought against the outgoings the user cannot avoid is
 * the thing they actually gained. A thirty-day month is used rather than the
 * real length: the figure is a translation, and one the user should be able
 * to check in their head.
 */
export function runwayDaysAdded(
  kept: number | null,
  monthlyCommitted: number,
): number | null {
  if (kept === null || kept <= 0 || monthlyCommitted <= 0) {
    return null;
  }
  return Math.round((kept / monthlyCommitted) * 30);
}

/* ----------------------------------------------------------- when to ask */

export interface CloseableMonth {
  year: number;
  month: number;
  /** YYYY-MM. */
  monthKey: string;
  /** "October 2026". */
  label: string;
  /** The date whose balance the user should look up. */
  observeOn: string;
  /** True when this close only sets the anchor and measures nothing. */
  isBaseline: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** The month after this one, as a key. */
export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) {
    return monthKey;
  }
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/**
 * The date whose balance closes a month.
 *
 * Not the last day of the month. With a deferred-debit card the month's card
 * spending has not reached the account by then, so the balance on the 31st
 * flatters the month and saddles the next one with the bill. Reading it a few
 * days into the following month instead catches the debit, and — because the
 * day is the same every month — makes the remaining distortion a constant
 * that cancels when one close is compared with the next.
 *
 * Deriving the date rather than storing "whenever the user got round to it"
 * is also what makes the window exactly one month, and what lets a forgotten
 * month be closed later from a statement.
 */
export function observationDateFor(
  year: number,
  month: number,
  closeDay: number,
): string {
  // `month` is 1-based, so this Date lands on the following month.
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(closeDay)}`;
}

function describeCloseable(
  monthKey: string,
  closeDay: number,
  isBaseline: boolean,
): CloseableMonth {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    year: year!,
    month: month!,
    monthKey,
    label: formatMonthLabel(year!, month!),
    observeOn: observationDateFor(year!, month!, closeDay),
    isBaseline,
  };
}

/**
 * The month the user should be asked to close, if any.
 *
 * Months are offered strictly in order, one at a time, because each close
 * measures from the one before it. Bridging a skipped month would compare a
 * balance against transactions from a different window and produce a figure
 * that looks authoritative and is nonsense — so a user who has fallen behind
 * is walked forwards through the gap instead, each month read from the same
 * day of the month as every other.
 *
 * With nothing closed yet there is nothing to measure from, so the first
 * close only drops an anchor: the newest month whose reading date has already
 * passed, so the user can look the figure up rather than wait for it.
 */
export function closableMonth(
  today: string,
  closeDay: number,
  lastClosedMonthKey: string | null,
): CloseableMonth | null {
  if (lastClosedMonthKey === null) {
    let candidate = previousMonthKey(monthKeyOf(today));
    const [year, month] = candidate.split("-").map(Number);
    if (today < observationDateFor(year!, month!, closeDay)) {
      candidate = previousMonthKey(candidate);
    }
    return describeCloseable(candidate, closeDay, true);
  }

  const candidate = nextMonthKey(lastClosedMonthKey);
  const [year, month] = candidate.split("-").map(Number);
  if (today < observationDateFor(year!, month!, closeDay)) {
    return null;
  }

  return describeCloseable(candidate, closeDay, false);
}

/** YYYY-MM for a stored close's `month` date. */
export function monthKeyOfClose(monthDate: string): string {
  return monthDate.slice(0, 7);
}

/** The first day of a month, as the `month_closes.month` column wants it. */
export function monthColumnValue(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}
