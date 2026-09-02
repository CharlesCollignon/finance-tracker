import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import {
  getMonthComparison,
  getMonthlySummary,
} from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals } from "@/lib/queries/phase4";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { previewApplyRecurringForMonth } from "@/lib/actions/finance";
import {
  parseMonthParams,
  parseBudgetViewMode,
  formatMonthLabel,
  getCurrentMonth,
  todayIsoLocal,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { BudgetViewToggle } from "@/components/finance/BudgetViewToggle";
import { DashboardHome } from "@/components/finance/DashboardHome";
import { MonthReadyCard } from "@/components/finance/MonthReadyCard";
import { MonthCloseCard } from "@/components/finance/MonthCloseCard";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { buildRunway } from "@finance/core/projection";
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

/**
 * Streamed separately because pricing share-based templates calls out to a
 * quote source, and the month's headline figures should not wait on it. A
 * failed preview simply means no card rather than a failed page.
 */
async function MonthReadySlot({
  monthLabel,
  year,
  month,
}: {
  monthLabel: string;
  year: number;
  month: number;
}) {
  const preview = await previewApplyRecurringForMonth(year, month);

  if (!preview.plan) {
    return null;
  }

  return (
    <MonthReadyCard
      monthLabel={monthLabel}
      year={year}
      month={month}
      plan={preview.plan}
    />
  );
}

/**
 * Streamed for the same reason as the apply preview: it replays every close
 * the user has ever recorded, and the month's headline figures should not
 * wait on that. Nothing to close means no card.
 */
async function MonthCloseSlot({ userId }: { userId: string }) {
  const today = todayIsoLocal();
  const [overview, templates] = await Promise.all([
    getMonthCloseOverview(userId, today),
    getRecurringTemplates(userId),
  ]);

  if (!overview.next) {
    return null;
  }

  const current = getCurrentMonth();
  const runway = buildRunway(0, templates, current.year, current.month);

  return (
    <MonthCloseCard
      year={overview.next.year}
      month={overview.next.month}
      monthLabel={overview.next.label}
      observeOn={overview.next.observeOn}
      isBaseline={overview.next.isBaseline}
      monthlyCommitted={runway.monthlyCommitted}
      unrecordedCap={overview.settings.unrecordedCap}
      baseline={overview.summary.baseline}
      streak={overview.summary.streak}
    />
  );
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
  const [summary, budgets, goals, categories, comparison] = await Promise.all([
    getMonthlySummary(user.id, year, month, budgetView),
    getBudgets(user.id),
    getSavingsGoals(user.id),
    getCategories(user.id),
    getMonthComparison(user.id, year, month),
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
        {/* The current / month-end distinction is a real one, but it is not
            the first decision to put in front of someone opening the app, so
            it sits beside the month rather than above the figures. */}
        <Suspense fallback={null}>
          <BudgetViewToggle basePath="/dashboard" className="hidden sm:flex" />
        </Suspense>
        <Suspense fallback={<span className="text-sm">…</span>}>
          <MonthPicker basePath="/dashboard" />
        </Suspense>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <MonthReadySlot
            monthLabel={monthLabel}
            year={year}
            month={month}
          />
        </Suspense>

        <Suspense fallback={null}>
          <MonthCloseSlot userId={user.id} />
        </Suspense>

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
          walletsSlot={
            <Suspense fallback={<WalletsFallback />}>
              <DashboardWalletsSlot userId={user.id} />
            </Suspense>
          }
          summary={summary}
          comparison={comparison}
        />
      </PageContainer>
    </>
  );
}
