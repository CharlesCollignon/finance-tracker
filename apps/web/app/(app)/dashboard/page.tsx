import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  ArrowsLeftRight,
  ChartLine,
  PiggyBank,
  Repeat,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlySummary } from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals } from "@/lib/queries/phase4";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import {
  parseMonthParams,
  parseBudgetViewMode,
  budgetViewHint,
  formatEuro,
  formatMonthLabel,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { BudgetViewToggle } from "@/components/finance/BudgetViewToggle";
import { DashboardAllocationChart } from "@/components/finance/DashboardAllocationChart";
import { SummaryCard } from "@/components/finance/SummaryCards";
import { Badge } from "@/components/retroui/Badge";
import { Card } from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";

interface DashboardPageProps {
  searchParams: Promise<{ y?: string; m?: string; view?: string }>;
}

const NAV_LINKS = [
  {
    href: "/transactions",
    label: "See all transactions",
    description: "Add, edit, or export money movements",
    icon: ArrowsLeftRight,
  },
  {
    href: "/investments",
    label: "Manage wallets",
    description: "PEA, CTO & crypto positions",
    icon: ChartLine,
  },
  {
    href: "/budgets",
    label: "Budgets & goals",
    description: "Caps, savings targets, and tags",
    icon: PiggyBank,
  },
  {
    href: "/recurring",
    label: "Recurring",
    description: "Templates and monthly apply",
    icon: Repeat,
  },
] as const;

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { year, month } = parseMonthParams(params.y, params.m);
  const budgetView = parseBudgetViewMode(params.view);
  const [summary, walletPortfolio, budgets, goals, categories] =
    await Promise.all([
      getMonthlySummary(user.id, year, month, budgetView),
      getWalletPortfolio(user.id),
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

  const outflowItems = [
    ...summary.expenseBreakdown.map((item) => ({
      ...item,
      kind: "expense" as const,
    })),
    ...summary.savingsBreakdown.map((item) => ({
      ...item,
      kind: "savings" as const,
    })),
    ...summary.investmentBreakdown.map((item) => ({
      ...item,
      kind: "investment" as const,
    })),
  ]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <>
      <PageHeader title="Home">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Suspense fallback={<span className="text-sm">…</span>}>
            <BudgetViewToggle basePath="/dashboard" />
          </Suspense>
          <Suspense fallback={<span className="text-sm">…</span>}>
            <MonthPicker basePath="/dashboard" />
          </Suspense>
        </div>
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer>
        <div className="flex flex-col gap-4">
          <Card className="w-full space-y-2 p-4 md:p-5">
            <p className="text-base leading-relaxed md:text-lg">
              In <span className="font-semibold">{monthLabel}</span> you earned{" "}
              <span className="privacy-amount font-semibold text-success tabular-nums">
                {formatEuro(summary.income)}
              </span>
              , spent{" "}
              <span className="privacy-amount font-semibold text-destructive tabular-nums">
                {formatEuro(summary.expenses)}
              </span>
              , and have{" "}
              <span
                className={cn(
                  "privacy-amount font-semibold tabular-nums",
                  overBudget ? "text-destructive" : "text-primary",
                )}
              >
                {formatEuro(summary.remaining)}
              </span>{" "}
              left.
            </p>
            <p className="text-sm text-muted-foreground">
              {budgetViewHint(summary.budgetView)}
            </p>
            <Badge
              variant="solid"
              className={cn(
                statusTone === "danger"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-success/15 text-success",
              )}
            >
              {statusLabel}
            </Badge>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <SummaryCard label="Income" amount={summary.income} />
            <SummaryCard
              label="Remaining"
              amount={summary.remaining}
              highlight
              warning={overBudget}
              hint={budgetViewHint(summary.budgetView)}
            />
          </div>

          {(budgetProgress.length > 0 || goalProgress.length > 0) && (
            <Card className="w-full space-y-3 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-head text-base">Budgets & goals</h2>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/budgets">Manage</Link>}
                />
              </div>
              {budgetProgress.map((row) => (
                <div key={row.budgetId}>
                  <div className="flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span
                      className={
                        row.over
                          ? "privacy-amount text-destructive"
                          : "privacy-amount"
                      }
                    >
                      {formatEuro(row.spent)} / {formatEuro(row.limit)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden bg-muted">
                    <div
                      className={cn(
                        "h-full",
                        row.over ? "bg-destructive" : "bg-primary",
                      )}
                      style={{
                        width: `${Math.min(100, row.ratio * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {goalProgress.map((row) => (
                <div key={row.goal.id}>
                  <div className="flex justify-between text-sm">
                    <span>{row.goal.name}</span>
                    <span className="privacy-amount">
                      {formatEuro(row.saved)} /{" "}
                      {formatEuro(Number(row.goal.target_amount))}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden bg-muted">
                    <div
                      className="h-full bg-[var(--chart-4)]"
                      style={{
                        width: `${Math.min(100, row.ratio * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </Card>
          )}

          <Card className="w-full p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-head text-base">Wallets</h2>
                <p className="mt-1 font-head text-2xl tabular-nums font-semibold">
                  {formatEuro(walletPortfolio.totalMarketValue)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invested {formatEuro(walletPortfolio.totalInvested)}
                  {walletPortfolio.hasMarketSnapshot &&
                  walletPortfolio.totalGainLoss !== 0
                    ? ` · P/L ${formatEuro(walletPortfolio.totalGainLoss)}`
                    : ""}
                </p>
              </div>
              <Link
                href="/investments"
                className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                Open
                <ArrowRight size={14} />
              </Link>
            </div>
          </Card>

          <DashboardAllocationChart summary={summary} />

          <Card className="w-full p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-head text-base">Where it went</h2>
              <Link
                href="/transactions"
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Full list
              </Link>
            </div>
            {outflowItems.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No spending recorded this month yet.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {outflowItems.map((item) => (
                  <li
                    key={`${item.kind}-${item.categoryId}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {formatEuro(item.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <section className="grid gap-3 sm:grid-cols-2">
            {NAV_LINKS.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border bg-card p-4",
                  "transition hover:bg-muted",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-primary text-primary-foreground">
                  <Icon size={20} weight="bold" />
                </span>
                <span className="min-w-0">
                  <span className="block font-head text-sm">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
              </Link>
            ))}
          </section>
        </div>
      </PageContainer>
    </>
  );
}
