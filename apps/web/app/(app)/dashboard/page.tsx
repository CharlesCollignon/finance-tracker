import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getMonthComparison, getMonthlySummary } from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals } from "@/lib/queries/phase4";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import {
  countSwallowedFeedItems,
  getPendingFeedItems,
  getRecurringProposals,
  hasBankFeed,
} from "@/lib/queries/bank";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { previewApplyRecurringForMonth } from "@/lib/actions/finance";
import {
  formatMonthLabel,
  getCurrentMonth,
  parseBudgetViewMode,
  parseMonthParams,
  savingsRatePercent,
  todayIsoLocal,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  buildSavingsGoalProgress,
  type SavingsGoalProgress,
} from "@finance/core/savings-goals";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { BudgetViewToggle } from "@/components/finance/BudgetViewToggle";
import {
  MonthAttention,
  type AttentionItem,
} from "@/components/finance/MonthAttention";
import { MonthStanding } from "@/components/finance/MonthStanding";
import { ProgressRing, SpendStrip } from "@/components/finance/charts";
import { MonthWallets } from "@/components/finance/MonthWallets";
import type { BudgetProgress } from "@finance/core/budget-limits";

interface DashboardPageProps {
  searchParams: Promise<{ y?: string; m?: string; view?: string }>;
}

/**
 * Everything outstanding, gathered from wherever it actually lives.
 *
 * Streamed on its own because it asks the bank, replays every month close and
 * runs pattern detection over the statement — none of which the month's
 * headline figures should wait behind. A slow or unreachable answer means no
 * block, not a slow page.
 */
async function AttentionSlot({
  userId,
  year,
  month,
}: {
  userId: string;
  year: number;
  month: number;
}) {
  const today = todayIsoLocal();
  const bankFed = await hasBankFeed(userId);

  const [pending, swallowed, closes, proposals, applyPlan] = await Promise.all([
    bankFed ? getPendingFeedItems(userId) : [],
    bankFed ? countSwallowedFeedItems(userId) : 0,
    getMonthCloseOverview(userId, today),
    bankFed ? getRecurringProposals(userId, today) : [],
    // Only meaningful without a feed: with one, templates never apply.
    bankFed ? null : previewApplyRecurringForMonth(year, month),
  ]);

  const items: AttentionItem[] = [];

  if (swallowed > 0) {
    items.push({
      id: "swallowed",
      tone: "wrong",
      text: `${swallowed} bank ${swallowed === 1 ? "entry was" : "entries were"} merged away by an earlier sync`,
      href: "/transactions",
      action: "Reopen",
    });
  }

  if (pending.length > 0) {
    items.push({
      id: "inbox",
      text: `${pending.length} ${pending.length === 1 ? "entry needs" : "entries need"} a category`,
      href: "/transactions",
      action: "Review",
    });
  }

  const creates = applyPlan?.plan?.toCreate.length ?? 0;
  if (creates > 0) {
    items.push({
      id: "apply",
      text: `${creates} recurring ${creates === 1 ? "item is" : "items are"} ready to add`,
      href: "/recurring",
      action: "Apply",
    });
  }

  if (closes.next) {
    items.push({
      id: "close",
      text: closes.next.isBaseline
        ? `Set a starting balance to begin closing months`
        : `${closes.next.label} is ready to close`,
      href: "/budgets",
      action: "Close",
    });
  }

  if (proposals.length > 0) {
    items.push({
      id: "proposals",
      text: `${proposals.length} ${proposals.length === 1 ? "charge looks" : "charges look"} like they repeat`,
      href: "/recurring",
      action: "Review",
    });
  }

  return <MonthAttention items={items} />;
}

function Caps({
  budgetProgress,
  goalProgress,
}: {
  budgetProgress: BudgetProgress[];
  goalProgress: SavingsGoalProgress[];
}) {
  const rings = [
    ...budgetProgress.slice(0, 2).map((row) => ({
      key: `b-${row.budgetId}`,
      label: row.label,
      detail: `${Math.round(row.ratio * 100)}% of cap`,
      ratio: row.ratio,
      over: row.over,
      meaning: "limit" as const,
      colorVar: "--chart-1",
    })),
    ...goalProgress.slice(0, 2).map((row) => ({
      key: `g-${row.goal.id}`,
      label: row.goal.name,
      detail: row.complete
        ? "reached"
        : `${Math.round(row.ratio * 100)}% saved`,
      ratio: row.ratio,
      over: false,
      // A goal is a target, not a limit: filling it is the point.
      meaning: "target" as const,
      colorVar: "--chart-3",
    })),
  ];

  if (rings.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Caps and goals</h2>
        <Link
          href="/budgets"
          className="flex items-center gap-1 text-sm text-primary-ink"
        >
          Plan
          <ArrowRight size={13} />
        </Link>
      </div>
      <div className="flex flex-wrap gap-6">
        {rings.map((ring) => (
          <ProgressRing
            key={ring.key}
            ratio={ring.ratio}
            label={ring.label}
            detail={ring.detail}
            over={ring.over}
            meaning={ring.meaning}
            colorVar={ring.colorVar}
          />
        ))}
      </div>
    </section>
  );
}

async function WalletsSlot({ userId }: { userId: string }) {
  const portfolio = await getWalletPortfolio(userId, { includeHistory: false });
  return <MonthWallets portfolio={portfolio} />;
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

  const monthLabel = formatMonthLabel(year, month);
  const current = getCurrentMonth();
  // Only a month in progress has an "of it gone" to report.
  const elapsed =
    year === current.year && month === current.month
      ? Number(todayIsoLocal().slice(8, 10)) /
        new Date(year, month, 0).getDate()
      : null;

  const savingsRate = savingsRatePercent(
    summary.savings,
    summary.investments,
    summary.investmentDeployments,
    summary.income,
  );

  return (
    <>
      <PageHeader title="Month">
        <Suspense fallback={null}>
          <BudgetViewToggle basePath="/dashboard" className="hidden sm:flex" />
        </Suspense>
        <Suspense fallback={<span className="text-sm">…</span>}>
          <MonthPicker basePath="/dashboard" />
        </Suspense>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <AttentionSlot userId={user.id} year={year} month={month} />
        </Suspense>

        <MonthStanding
          monthLabel={monthLabel}
          income={summary.income}
          expenses={summary.expenses}
          remaining={summary.remaining}
          budgetView={budgetView}
          elapsed={elapsed}
          comparison={comparison}
          savingsRate={savingsRate}
        />

        {summary.expenses > 0 ? (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium">Where it went</h2>
              <Link
                href="/transactions"
                className="flex items-center gap-1 text-sm text-primary-ink"
              >
                Ledger
                <ArrowRight size={13} />
              </Link>
            </div>
            <SpendStrip
              rows={summary.expenseBreakdown}
              total={summary.expenses}
            />
          </section>
        ) : null}

        <Caps budgetProgress={budgetProgress} goalProgress={goalProgress} />

        <Suspense fallback={null}>
          <WalletsSlot userId={user.id} />
        </Suspense>
      </PageContainer>
    </>
  );
}
