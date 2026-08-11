import type { Budget, CategoryBreakdown } from "./types/database";

export interface BudgetProgress {
  budgetId: string;
  categoryId: string | null;
  label: string;
  limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  over: boolean;
}

/** Build progress rows for configured budget caps against this month's spend. */
export function buildBudgetProgress(
  budgets: Budget[],
  expenseBreakdown: CategoryBreakdown[],
  totalExpenses: number,
  categoryNames: Map<string, string>,
): BudgetProgress[] {
  return budgets.map((budget) => {
    const spent =
      budget.category_id === null
        ? totalExpenses
        : (expenseBreakdown.find(
            (item) => item.categoryId === budget.category_id,
          )?.total ?? 0);
    const limit = Number(budget.amount);
    const remaining = limit - spent;
    const ratio = limit > 0 ? spent / limit : 0;

    return {
      budgetId: budget.id,
      categoryId: budget.category_id,
      label:
        budget.category_id === null
          ? "All expenses"
          : (categoryNames.get(budget.category_id) ?? "Category"),
      limit,
      spent,
      remaining,
      ratio,
      over: spent > limit,
    };
  });
}
