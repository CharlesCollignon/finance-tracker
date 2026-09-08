import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
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
  locale: Locale = DEFAULT_LOCALE,
): BudgetProgress[] {
  const t = translator(locale);

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
          ? t("allocation.allExpenses")
          : (categoryNames.get(budget.category_id) ??
            t("allocation.uncategorised")),
      limit,
      spent,
      remaining,
      ratio,
      over: spent > limit,
    };
  });
}
