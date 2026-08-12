import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlySummary } from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals } from "@/lib/queries/phase4";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import {
  parseMonthParams,
  parseBudgetViewMode,
  formatMonthLabel,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { BudgetViewToggle } from "@/components/finance/BudgetViewToggle";
import { DashboardHome } from "@/components/finance/DashboardHome";
import { DashboardWalletsCard } from "@/components/finance/lazy-charts";

interface DashboardPageProps {
  searchParams: Promise<{ y?: string; m?: string; view?: string }>;
}

async function DashboardWalletsSlot({ userId }: { userId: string }) {
  const portfolio = await getWalletPortfolio(userId, {
    includeHistory: false,
  });
  return <DashboardWalletsCard portfolio={portfolio} />;
}

function WalletsFallback() {
  return (
    <div
      className="mx-auto h-56 w-full max-w-md animate-pulse rounded-md bg-muted/40"
      aria-hidden
    />
  );
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { year, month } = parseMonthParams(params.y, params.m);
  const budgetView = parseBudgetViewMode(params.view);
  const [summary, budgets, goals, categories] = await Promise.all([
    getMonthlySummary(user.id, year, month, budgetView),
    getBudgets(user.id),
    getSavingsGoals(user.id),
    getCategories(user.id),
  ]);

  const overBudget = summary.remaining < 0;
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
  );
  const anyCapOver = budgetProgress.some((row) => row.over);

  const monthLabel = formatMonthLabel(year, month);
  const statusLabel = anyCapOver
    ? "A budget cap was exceeded"
    : overBudget
      ? "You are over budget"
      : "You are on track";
  const statusTone = anyCapOver || overBudget ? "danger" : "ok";

  return (
    <>
      <PageHeader title="Home">
        <Suspense fallback={<span className="text-sm">…</span>}>
          <MonthPicker basePath="/dashboard" />
        </Suspense>
      </PageHeader>

      <PageContainer>
        <DashboardHome
          monthLabel={monthLabel}
          income={summary.income}
          expenses={summary.expenses}
          remaining={summary.remaining}
          overBudget={overBudget}
          budgetView={budgetView}
          statusLabel={statusLabel}
          statusTone={statusTone}
          budgetProgress={budgetProgress}
          goalProgress={goalProgress}
          viewToggle={
            <Suspense
              fallback={
                <div
                  className="h-9 w-64 animate-pulse rounded-md bg-muted/40"
                  aria-hidden
                />
              }
            >
              <BudgetViewToggle basePath="/dashboard" />
            </Suspense>
          }
          walletsSlot={
            <Suspense fallback={<WalletsFallback />}>
              <DashboardWalletsSlot userId={user.id} />
            </Suspense>
          }
          summary={summary}
        />
      </PageContainer>
    </>
  );
}
