import { recurringOccurrenceKey } from "./apply-recurring";
import { templateOccurrenceDates } from "./budget";
import { formatMonthLabel, lastDayIsoOfMonth } from "./constants";
import type {
  RecurringTemplateWithCategory,
  SavingsGoal,
  TransactionWithCategory,
} from "./types/database";

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  ratio: number;
  complete: boolean;
}

/**
 * What a goal's running total is counted from.
 *
 * Fetched for the window from the earliest goal start to the as-of day. The
 * applied keys cover every applied occurrence in that window whatever its
 * category, so an occurrence applied and then re-filed elsewhere is not
 * counted a second time as still due.
 */
export interface GoalLedger {
  /** Savings transactions in the window, with their category. */
  transactions: TransactionWithCategory[];
  /** `templateId:date` of every applied occurrence in the window. */
  appliedKeys: ReadonlySet<string>;
  /** `templateId:date` of every skipped occurrence in the window. */
  skippedKeys: ReadonlySet<string>;
}

export const EMPTY_GOAL_LEDGER: GoalLedger = {
  transactions: [],
  appliedKeys: new Set(),
  skippedKeys: new Set(),
};

/** The first day any goal counts from, or null when there are no goals. */
export function earliestGoalStart(
  goals: Pick<SavingsGoal, "starts_on">[],
): string | null {
  let earliest: string | null = null;
  for (const goal of goals) {
    if (earliest === null || goal.starts_on < earliest) {
      earliest = goal.starts_on;
    }
  }
  return earliest;
}

/**
 * The day a goal's figures stop at when they are shown beside one month:
 * today for the month in progress, the month's last day for a past one.
 *
 * Both clients use this for the month read, whose stored text is checked
 * against a digest of its facts, so the two must stop on the same day.
 */
export function goalTotalsAsOf(
  year: number,
  month: number,
  today: string,
): string {
  const monthEnd = lastDayIsoOfMonth(year, month);
  return today < monthEnd ? today : monthEnd;
}

function monthsBetween(
  from: string,
  to: string,
): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const lastYear = Number(to.slice(0, 4));
  const lastMonth = Number(to.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function roundToCent(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How much each goal holds on `asOf`, by goal id.
 *
 * The monthly summary's `current` view, summed over every month from the
 * goal's start, with the first month counted from the start day:
 *
 * - a goal linked to a category counts that category's savings transactions,
 *   and the occurrences its active templates called for by `asOf` that were
 *   neither applied nor skipped;
 * - a goal with no category counts every savings transaction, withdrawal
 *   categories (savings marked as not counting) subtracting, and the due
 *   occurrences of active counting savings templates.
 *
 * Deliberately the same rule the monthly summary uses, so a month's goal
 * progress and that month's savings figure can be checked against each
 * other.
 */
export function buildGoalRunningTotals(
  goals: SavingsGoal[],
  ledger: GoalLedger,
  templates: RecurringTemplateWithCategory[],
  asOf: string,
): Map<string, number> {
  const savingsTemplates = templates.filter(
    (template) => template.active && template.categories.type === "savings",
  );
  const totals = new Map<string, number>();

  for (const goal of goals) {
    const from = goal.starts_on;
    if (from > asOf) {
      totals.set(goal.id, 0);
      continue;
    }

    let saved = 0;

    for (const row of ledger.transactions) {
      if (
        row.categories.type !== "savings" ||
        row.occurred_on < from ||
        row.occurred_on > asOf
      ) {
        continue;
      }
      const counts = row.categories.counts_toward_summary !== false;
      const amount = Number(row.amount);
      if (goal.category_id !== null) {
        saved += row.category_id === goal.category_id ? amount : 0;
      } else {
        saved += counts ? amount : -amount;
      }
    }

    const months = monthsBetween(from, asOf);
    for (const template of savingsTemplates) {
      const counts = template.categories.counts_toward_summary !== false;
      const applies =
        goal.category_id !== null
          ? template.category_id === goal.category_id
          : counts;
      if (!applies) {
        continue;
      }
      for (const { year, month } of months) {
        for (const date of templateOccurrenceDates(
          template,
          year,
          month,
          asOf,
        )) {
          const key = recurringOccurrenceKey(template.id, date);
          if (
            date < from ||
            ledger.appliedKeys.has(key) ||
            ledger.skippedKeys.has(key)
          ) {
            continue;
          }
          saved += Number(template.amount);
        }
      }
    }

    totals.set(goal.id, roundToCent(saved));
  }

  return totals;
}

/** Progress for each goal from its running total. */
export function buildSavingsGoalProgress(
  goals: SavingsGoal[],
  savedByGoal: ReadonlyMap<string, number>,
): SavingsGoalProgress[] {
  return goals.map((goal) => {
    const saved = savedByGoal.get(goal.id) ?? 0;
    const target = Number(goal.target_amount);
    const remaining = Math.max(0, target - saved);
    // Floored at zero: withdrawals can take an all-savings goal below
    // nothing, and a bar cannot be drawn backwards.
    const ratio = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;

    return {
      goal,
      saved,
      remaining,
      ratio,
      complete: saved >= target,
    };
  });
}

export type GoalPacingStatus =
  "reached" | "overdue" | "on-schedule" | "no-date";

export interface GoalPacing {
  status: GoalPacingStatus;
  /** Whole months between now and the target date. Only set when status is "on-schedule". */
  monthsRemaining: number | null;
  /** Amount to save each remaining month to hit the target on time. */
  monthlyAmount: number | null;
  /** "August 2026" — only set when status is "on-schedule" or "overdue". */
  targetLabel: string | null;
}

function wholeMonthsUntil(target: Date, now: Date): number {
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return target > now ? Math.max(months, 1) : months;
}

/**
 * A simple, always-correct pacing hint: how much to save each month to hit
 * a goal's target date. Deliberately does not infer a saving rate from
 * history — it only does arithmetic on numbers already on screen, so the
 * message is easy to explain: "save this much a month to get there on time."
 */
export function computeGoalPacing(
  progress: Pick<SavingsGoalProgress, "goal" | "remaining" | "complete">,
  now: Date = new Date(),
): GoalPacing {
  if (progress.complete) {
    return {
      status: "reached",
      monthsRemaining: null,
      monthlyAmount: null,
      targetLabel: null,
    };
  }

  if (!progress.goal.target_date) {
    return {
      status: "no-date",
      monthsRemaining: null,
      monthlyAmount: null,
      targetLabel: null,
    };
  }

  const target = new Date(`${progress.goal.target_date}T00:00:00`);
  const targetLabel = formatMonthLabel(
    target.getFullYear(),
    target.getMonth() + 1,
  );
  const months = wholeMonthsUntil(target, now);

  if (months <= 0) {
    return {
      status: "overdue",
      monthsRemaining: 0,
      monthlyAmount: progress.remaining,
      targetLabel,
    };
  }

  return {
    status: "on-schedule",
    monthsRemaining: months,
    monthlyAmount: Math.ceil((progress.remaining / months) * 100) / 100,
    targetLabel,
  };
}
