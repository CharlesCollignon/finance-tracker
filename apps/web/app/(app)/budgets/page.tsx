import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import {
  getMonthlySummary,
  getRecurringTemplates,
  getSavingsReserve,
} from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals, getTags } from "@/lib/queries/phase4";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  buildSavingsGoalProgress,
  computeGoalPacing,
} from "@finance/core/savings-goals";
import { buildForwardProjection, buildRunway } from "@finance/core/projection";
import { ProjectionCard } from "@/components/finance/ProjectionCard";
import { MonthCloseHistory } from "@/components/finance/MonthCloseHistory";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { BudgetsView } from "./BudgetsView";

export default async function BudgetsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();

  const [budgets, categories, tags, goals, summary, templates, reserve] =
    await Promise.all([
      getBudgets(user.id),
      getCategories(user.id),
      getTags(user.id),
      getSavingsGoals(user.id),
      getMonthlySummary(user.id, current.year, current.month),
      getRecurringTemplates(user.id),
      getSavingsReserve(user.id),
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
    pacing: computeGoalPacing(row),
  }));

  const projection = buildForwardProjection(
    templates,
    current.year,
    current.month,
    { months: 12 },
  );
  const runway = buildRunway(reserve, templates, current.year, current.month);
  const closes = await getMonthCloseOverview(user.id, todayIsoLocal());

  return (
    <BudgetsView
      budgets={budgets}
      categories={categories.filter((c) => !c.archived)}
      tags={tags}
      goals={goals}
      budgetProgress={budgetProgress}
      goalProgress={goalProgress}
      footer={
        <>
          <ProjectionCard points={projection} runway={runway} />

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: "/categories",
                title: "Categories",
                hint: "Where money is allowed to go",
              },
              {
                href: "/import",
                title: "Import a statement",
                hint: "A CSV, when there is no bank feed",
              },
            ].map(({ href, title, hint }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary-rim"
              >
                <span>
                  <span className="font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>

          <MonthCloseHistory
            history={closes.history}
            summary={closes.summary}
            unrecordedCap={closes.settings.unrecordedCap}
            closeDay={closes.settings.closeDay}
          />
        </>
      }
    />
  );
}
