import type { CategoryBreakdown, SavingsGoal } from "./types/database";

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
