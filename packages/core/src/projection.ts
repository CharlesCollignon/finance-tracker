/**
 * Looking forward.
 *
 * Because standing instructions are modelled properly, twelve months ahead is
 * not a forecast in the guessy sense — it is arithmetic on what the user has
 * already told the app repeats. The only unknown is discretionary spending,
 * which is deliberately left out rather than estimated: a projection the user
 * can reconcile line by line is worth more than one that quietly invents a
 * grocery bill.
 *
 * Each month is computed with the same engine the dashboard uses, so a
 * projected month and a lived month are produced by the same rules and cannot
 * drift apart.
 */

import { computeMonthlyBudgetWithProjection } from "./budget";
import { formatMonthLabel } from "./constants";
import type { RecurringTemplateWithCategory } from "./types/database";

export interface ProjectionPoint {
  /** YYYY-MM. */
  monthKey: string;
  /** "October 2026". */
  label: string;
  year: number;
  month: number;
  income: number;
  /** Everything leaving: expenses, savings, investment, deployments. */
  outflow: number;
  /** What is set aside and invested in the month. */
  setAside: number;
  net: number;
  /** Running total of `net`, including the opening balance. */
  cumulative: number;
}

function shift(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export interface ForwardProjectionOptions {
  /** Where the running total starts. Defaults to zero. */
  startingBalance?: number;
  /** How many months to project, including the starting one. */
  months?: number;
}

/**
 * A month-by-month projection from the active recurring templates.
 *
 * Transactions are deliberately not passed in: this answers "what will the
 * months ahead contain if nothing changes", and a month that has already had
 * one-off spending in it is not that question.
 */
export function buildForwardProjection(
  templates: RecurringTemplateWithCategory[],
  fromYear: number,
  fromMonth: number,
  options: ForwardProjectionOptions = {},
): ProjectionPoint[] {
  const { startingBalance = 0, months = 12 } = options;

  const points: ProjectionPoint[] = [];
  let cumulative = startingBalance;

  for (let index = 0; index < months; index += 1) {
    const { year, month } = shift(fromYear, fromMonth, index);

    // month_end so a partially-elapsed starting month still projects whole.
    const totals = computeMonthlyBudgetWithProjection(
      [],
      templates,
      year,
      month,
      "month_end",
    );

    cumulative += totals.net;

    points.push({
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      label: formatMonthLabel(year, month),
      year,
      month,
      income: totals.income,
      outflow: totals.outflow,
      setAside: totals.savings + totals.investment + totals.deployed,
      net: totals.net,
      cumulative,
    });
  }

  return points;
}

export interface ProjectionSummary {
  /** The final running total. */
  endingBalance: number;
  /** Total added across the whole window. */
  totalAdded: number;
  /** Average net per month. */
  monthlyAverage: number;
  /** Label of the last month in the window. */
  endLabel: string;
  /** True when the projection trends downward — worth saying plainly. */
  shrinking: boolean;
}

export function summarizeProjection(
  points: ProjectionPoint[],
  startingBalance = 0,
): ProjectionSummary | null {
  if (points.length === 0) {
    return null;
  }

  const last = points[points.length - 1]!;
  const totalAdded = last.cumulative - startingBalance;

  return {
    endingBalance: last.cumulative,
    totalAdded,
    monthlyAverage: totalAdded / points.length,
    endLabel: last.label,
    shrinking: totalAdded < 0,
  };
}

/* ---------------------------------------------------------------- runway */

export interface Runway {
  /** What one month of committed outgoings costs. */
  monthlyCommitted: number;
  /** What the user has set aside, as supplied by the caller. */
  reserve: number;
  /** Months the reserve covers, or null when nothing is committed. */
  months: number | null;
}

/**
 * How long what has been set aside would cover the committed outgoings.
 *
 * "Committed" means the recurring expenses only — not savings or investment
 * contributions, which a person under pressure would stop making. The reserve
 * is the caller's to define, because the app tracks flows rather than balances
 * and only the caller knows which of them it wants to count.
 */
export function buildRunway(
  reserve: number,
  templates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
): Runway {
  const totals = computeMonthlyBudgetWithProjection(
    [],
    templates,
    year,
    month,
    "month_end",
  );

  const monthlyCommitted = totals.expense;

  return {
    monthlyCommitted,
    reserve,
    months:
      monthlyCommitted > 0
        ? Math.round((reserve / monthlyCommitted) * 10) / 10
        : null,
  };
}

/** "4.2 months of committed costs", or null when there is nothing to say. */
export function formatRunway(runway: Runway): string | null {
  if (runway.months === null || runway.reserve <= 0) {
    return null;
  }
  if (runway.months < 1) {
    return "Under a month of committed costs.";
  }
  return `${runway.months} months of committed costs.`;
}
