import type { CategoryBreakdown, SavingsGoal } from "./types/database";
import { formatMonthLabel } from "./constants";

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  ratio: number;
  complete: boolean;
}

/** Progress for savings goals using lifetime/month savings by category. */
export function buildSavingsGoalProgress(
  goals: SavingsGoal[],
  savingsBreakdown: CategoryBreakdown[],
  totalSavings: number,
): SavingsGoalProgress[] {
  return goals.map((goal) => {
    const saved =
      goal.category_id === null
        ? totalSavings
        : (savingsBreakdown.find((item) => item.categoryId === goal.category_id)
            ?.total ?? 0);
    const target = Number(goal.target_amount);
    const remaining = Math.max(0, target - saved);
    const ratio = target > 0 ? Math.min(1, saved / target) : 0;

    return {
      goal,
      saved,
      remaining,
      ratio,
      complete: saved >= target,
    };
  });
}

export type GoalPacingStatus = "reached" | "overdue" | "on-schedule" | "no-date";

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
