/**
 * The figures a month read is allowed to refer to.
 *
 * A language model writes the prose of a month read; it never writes a
 * number. Instead it is handed this pack — every figure it may mention, each
 * with a stable id — and it refers to them by id. The app substitutes its own
 * formatted value at render time.
 *
 * That indirection is usually justified by hallucination, and it does prevent
 * it, but two more mundane reasons make it the only workable design here:
 *
 *   The display currency is a client-side preference, in localStorage, which
 *   a server has no way of knowing. A model that wrote "1 240 €" would be
 *   wrong forever for a reader who has chosen dollars.
 *
 *   Amounts are blurred when privacy mode is on, one element at a time.
 *   Prose cannot be blurred selectively; a figure in its own element can.
 *
 * An absent figure becomes a named `MissingFact` with a reason, never a zero.
 * "You have 0 € on hand" from a user who simply has no bank connected is the
 * exact failure this avoids, and telling the model what it does *not* know is
 * the cheapest way to stop it inventing an answer.
 *
 * Pure, and deliberately so: everything here is testable without a database,
 * a network or a model.
 */

import type { BudgetProgress } from "./budget-limits";
import type { MonthComparison } from "./month-comparison";
import type { CloseHistorySummary, ClosedMonthOutcome } from "./month-close";
import type { MonthPulse } from "./month-pulse";
import type { SavingsGoalProgress } from "./savings-goals";
import type { CategoryBreakdown, MonthlySummary } from "./types/database";
import { formatMonthLabel } from "./constants";

/**
 * What it means when a figure rises.
 *
 * Carried because advice that points the wrong way is worse than no advice.
 * A model congratulating a rise in unrecorded spending would be reading the
 * app's most important number backwards.
 */
export type FactSense = "up-is-good" | "up-is-bad" | "neutral";

export type FactUnit = "money" | "percent" | "count";

export interface MonthFact {
  /** Stable and referenceable. Per-entity facts carry the entity's id. */
  id: string;
  /** What a person would call it, in the app's own words. */
  label: string;
  unit: FactUnit;
  /** The app's arithmetic. Never the model's. */
  value: number;
  sense: FactSense;
  /** One clause the model may lean on — "measured, not estimated". */
  note?: string;
}

/** Why a figure is not available. Said in words, never as a zero. */
export type MissingReason =
  "no-bank" | "no-close" | "no-cap" | "month-unfinished" | "not-recorded";

export interface MissingFact {
  id: string;
  label: string;
  why: MissingReason;
}

/** Where the month stands, which changes what may honestly be said about it. */
export type MonthState = "in-progress" | "closed" | "past-open";

export interface MonthFacts {
  /** YYYY-MM. */
  monthKey: string;
  /** "March 2026". */
  monthLabel: string;
  state: MonthState;
  /**
   * Whether the month's spending picture is complete. Partial when entries
   * are still waiting for a category, or when nothing has been closed and so
   * unrecorded spending cannot be measured at all.
   */
  coverage: "full" | "partial";
  facts: MonthFact[];
  missing: MissingFact[];
  /**
   * Nothing worth writing about. The model is not asked at all — a confident
   * read of an empty month is the single worst thing this feature could
   * produce.
   */
  thin: boolean;
}

/**
 * How many of each per-entity family to include.
 *
 * Without a cap the prompt grows with the user's category list and the cost
 * grows with it, for figures nobody would mention in four sentences anyway.
 */
export const MAX_TOP_EXPENSES = 5;
export const MAX_BUDGETS = 4;
export const MAX_GOALS = 3;

export interface BuildMonthFactsInput {
  year: number;
  month: number;
  state: MonthState;
  summary: MonthlySummary;
  comparison: MonthComparison | null;
  /** This month's close, replayed, when it has been closed. */
  close:
    | (ClosedMonthOutcome & {
        cashChange: number | null;
        keptRate: number | null;
      })
    | null;
  /** Live standing, for the month in progress only. */
  pulse: MonthPulse | null;
  closeSummary: CloseHistorySummary | null;
  /** The user's cap on unrecorded spending, when they have set one. */
  unrecordedCap: number | null;
  budgets: readonly BudgetProgress[];
  goals: readonly SavingsGoalProgress[];
  /** Total market value across wallets, when there is any. */
  investedValue: number | null;
  /** Bank rows still waiting for a category. */
  inboxPending: number;
  /** Recurring charges the bank looks to have paid, not yet confirmed. */
  chargesUnconfirmed: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMonthFacts(input: BuildMonthFactsInput): MonthFacts {
  const {
    year,
    month,
    state,
    summary,
    comparison,
    close,
    pulse,
    closeSummary,
    unrecordedCap,
    budgets,
    goals,
    investedValue,
    inboxPending,
    chargesUnconfirmed,
  } = input;

  const facts: MonthFact[] = [];
  const missing: MissingFact[] = [];

  const money = (
    id: string,
    label: string,
    value: number,
    sense: FactSense,
    note?: string,
  ) =>
    facts.push({ id, label, unit: "money", value: round(value), sense, note });

  /* ---------------------------------------------------------- the month */

  money("income", "Money in", summary.income, "up-is-good");
  money("expenses", "Money out", summary.expenses, "up-is-bad");
  money("savings", "Set aside", summary.savings, "up-is-good");
  money("remaining", "Left over", summary.remaining, "up-is-good");

  if (summary.investments > 0) {
    money("investments", "Invested", summary.investments, "up-is-good");
  }

  if (summary.income > 0) {
    facts.push({
      id: "savings-rate",
      label: "Savings rate",
      unit: "percent",
      // Not "kept": a month close already uses that word for a different
      // figure, and CONTEXT.md forbids the overlap.
      value: round(
        ((summary.savings + summary.investments) / summary.income) * 100,
      ),
      sense: "up-is-good",
    });
  }

  /* ------------------------------------------------- against last month */

  if (comparison && comparison.comparable) {
    money(
      "expenses-previous",
      `Money out over the same days of ${comparison.previousLabel}`,
      comparison.previous,
      "up-is-bad",
    );
    money(
      "expenses-vs-previous",
      `Change against ${comparison.previousLabel}`,
      comparison.delta,
      "up-is-bad",
      comparison.partial
        ? "the same stretch of both months, not a whole month against a part"
        : undefined,
    );
  } else {
    missing.push({
      id: "expenses-vs-previous",
      label: "Change against last month",
      why: "not-recorded",
    });
  }

  /* ------------------------------------------------- what was unrecorded */

  if (close) {
    if (close.kept !== null) {
      money("kept", "Kept", close.kept, "up-is-good");
    }
    if (close.keptRate !== null) {
      facts.push({
        id: "kept-rate",
        label: "Kept, as a share of what came in",
        unit: "percent",
        value: round(close.keptRate),
        sense: "up-is-good",
      });
    }
    if (close.unrecorded !== null) {
      money(
        "unrecorded",
        "Unrecorded spending",
        close.unrecorded,
        "up-is-bad",
        "measured against the account balance, not estimated",
      );
    }
    if (close.cashChange !== null) {
      money(
        "cash-change",
        "What the account moved",
        close.cashChange,
        "neutral",
      );
    }
  } else if (pulse && pulse.unrecordedSoFar !== null) {
    money(
      "unrecorded-so-far",
      "Unrecorded spending so far",
      pulse.unrecordedSoFar,
      "up-is-bad",
      "measured, and not final until the month is closed",
    );
  } else {
    missing.push({
      id: "unrecorded",
      label: "Unrecorded spending",
      why: state === "in-progress" ? "month-unfinished" : "no-close",
    });
  }

  if (pulse) {
    if (pulse.onHand !== null) {
      money("on-hand", "What the accounts hold", pulse.onHand, "up-is-good");
    } else {
      missing.push({
        id: "on-hand",
        label: "What the accounts hold",
        why: "no-bank",
      });
    }
    if (pulse.committed > 0) {
      money("committed", "Still to leave", pulse.committed, "neutral");
    }
    if (pulse.arriving > 0) {
      money("arriving", "Still to arrive", pulse.arriving, "up-is-good");
    }
    if (pulse.free !== null) {
      money("free", "Yours to spend", pulse.free, "up-is-good");
    }
  }

  /* ------------------------------------------------------- the allowance */

  if (unrecordedCap !== null) {
    money(
      "unrecorded-allowance",
      "Unrecorded allowance",
      unrecordedCap,
      "neutral",
      "a cap set from this person's own history",
    );
  } else {
    missing.push({
      id: "unrecorded-allowance",
      label: "Unrecorded allowance",
      why: "no-cap",
    });
  }

  if (closeSummary) {
    if (closeSummary.baseline !== null) {
      money(
        "unrecorded-baseline",
        "Usual unrecorded spending",
        closeSummary.baseline,
        "up-is-bad",
        "the median across closed months, so one holiday does not move it",
      );
    }
    if (closeSummary.streak > 0) {
      facts.push({
        id: "streak",
        label: "Months in a row inside the allowance",
        unit: "count",
        value: closeSummary.streak,
        sense: "up-is-good",
      });
    }
    if (closeSummary.bestStreak > 0) {
      facts.push({
        id: "best-streak",
        label: "Best run so far",
        unit: "count",
        value: closeSummary.bestStreak,
        sense: "up-is-good",
      });
    }
  }

  /* ---------------------------------------------------- where it went */

  const top = [...summary.expenseBreakdown]
    .sort((left, right) => right.total - left.total)
    .slice(0, MAX_TOP_EXPENSES);

  for (const row of top as CategoryBreakdown[]) {
    money(`top-expense:${row.categoryId}`, row.name, row.total, "up-is-bad");
  }

  for (const row of budgets.slice(0, MAX_BUDGETS)) {
    money(
      `budget:${row.budgetId}`,
      `${row.label} cap, spent`,
      row.spent,
      "up-is-bad",
    );
    // `remaining` from `buildBudgetProgress` is deliberately unclamped, so it
    // goes negative when the cap is breached. That sign is the whole point: a
    // model reading "left" as a floor of zero would miss the breach entirely.
    money(
      `budget-left:${row.budgetId}`,
      `${row.label} cap, left`,
      row.remaining,
      "up-is-good",
    );
  }

  for (const row of goals.slice(0, MAX_GOALS)) {
    money(
      `goal:${row.goal.id}`,
      `${row.goal.name}, saved`,
      row.saved,
      "up-is-good",
    );
  }

  if (investedValue !== null && investedValue > 0) {
    money("invested-value", "Invested value", investedValue, "up-is-good");
  }

  /* ------------------------------------------------- what is unfinished */

  // Included on purpose, and the reason is worth stating: this feature ships
  // before the model helps categorise anything, so a month with rows still
  // waiting for a category has a genuinely partial picture of where money
  // went. Handing the model the count lets it say so instead of writing
  // confident advice about the wrong categories.
  if (inboxPending > 0) {
    facts.push({
      id: "inbox-pending",
      label: "Entries still waiting for a category",
      unit: "count",
      value: inboxPending,
      sense: "up-is-bad",
    });
  }
  if (chargesUnconfirmed > 0) {
    facts.push({
      id: "charges-unconfirmed",
      label: "Recurring charges not yet confirmed",
      unit: "count",
      value: chargesUnconfirmed,
      sense: "up-is-bad",
    });
  }

  const nothingRecorded =
    summary.income === 0 &&
    summary.expenses === 0 &&
    summary.savings === 0 &&
    (pulse === null || pulse.onHand === null) &&
    close === null;

  return {
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    monthLabel: formatMonthLabel(year, month),
    state,
    coverage: inboxPending > 0 || close === null ? "partial" : "full",
    facts,
    missing,
    thin: nothingRecorded,
  };
}

/** Every id in the pack, for verifying what a model claims to rest on. */
export function factIds(facts: MonthFacts): Set<string> {
  return new Set(facts.facts.map((fact) => fact.id));
}

export function findFact(facts: MonthFacts, id: string): MonthFact | null {
  return facts.facts.find((fact) => fact.id === id) ?? null;
}

/**
 * How a figure is written for a reader.
 *
 * The money formatter is injected because the currency is the reader's
 * choice and only the client knows it — which is the same reason the model is
 * never allowed to format one itself.
 */
export function formatFact(
  fact: MonthFact,
  formatMoney: (amount: number) => string,
): string {
  switch (fact.unit) {
    case "money":
      return formatMoney(fact.value);
    case "percent":
      // One decimal at most: a savings rate of 11.4% is a real distinction,
      // 11.42% is noise.
      return `${Math.round(fact.value * 10) / 10}%`;
    case "count":
      return String(Math.round(fact.value));
  }
}

/**
 * A fingerprint of the figures, for noticing that they have moved.
 *
 * FNV-1a rather than a hash from `node:crypto`, because this module runs
 * inside Hermes on the phone where that does not exist. Collision resistance
 * is irrelevant here: the question is "did these values change", and the
 * values themselves are stored alongside for the answer that matters.
 */
export function factsDigest(facts: MonthFacts): string {
  const canonical = [...facts.facts]
    .map((fact) => `${fact.id}:${fact.value.toFixed(2)}`)
    .sort()
    .join("|");

  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    // >>> 0 keeps it an unsigned 32-bit value; without it the multiply
    // overflows into a float and the digest stops being reproducible.
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
