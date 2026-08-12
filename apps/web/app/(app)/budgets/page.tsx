import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlySummary } from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals, getTags } from "@/lib/queries/phase4";
import { getCurrentMonth } from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import { BudgetsView } from "./BudgetsView";

export default async function BudgetsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();

  const [budgets, categories, tags, goals, summary] = await Promise.all([
    getBudgets(user.id),
    getCategories(user.id),
    getTags(user.id),
    getSavingsGoals(user.id),
    getMonthlySummary(user.id, current.year, current.month),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name] as const));

  const budgetProgress = buildBudgetProgress(
    budgets,
    summary.expenseBreakdown,
    summary.expenses,
    categoryNames,
  );

  const goalProgress = buildSavingsGoalProgress(
    goals,
    summary.savingsBreakdown,
    summary.savings,
  ).map((row) => ({
    goalId: row.goal.id,
    name: row.goal.name,
    target: Number(row.goal.target_amount),
    saved: row.saved,
    remaining: row.remaining,
    ratio: row.ratio,
  }));

  return (
    <BudgetsView
      budgets={budgets}
      categories={categories.filter((c) => !c.archived)}
      tags={tags}
      goals={goals}
      budgetProgress={budgetProgress}
      goalProgress={goalProgress}
    />
  );
}
