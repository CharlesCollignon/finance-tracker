import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { getMonthlySummary } from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { parseMonthParams, parseBudgetViewMode, budgetViewHint, formatEuro } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { BudgetViewToggle } from "@/components/finance/BudgetViewToggle";
import { DashboardCharts } from "@/components/finance/DashboardCharts";
import { DashboardWalletsCard } from "@/components/finance/DashboardWalletsCard";
import {
  BreakdownList,
  SummaryCard,
} from "@/components/finance/SummaryCards";
import { Badge } from "@/components/retroui/Badge";
import { Card } from "@/components/retroui/Card";

interface DashboardPageProps {
  searchParams: Promise<{ y?: string; m?: string; view?: string }>;
}

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

  await seedDefaultCategories(user.id);

  const params = await searchParams;
  const { year, month } = parseMonthParams(params.y, params.m);
  const budgetView = parseBudgetViewMode(params.view);
  const [summary, walletPortfolio] = await Promise.all([
    getMonthlySummary(user.id, year, month, budgetView),
    getWalletPortfolio(user.id),
  ]);
  const overBudget = summary.remaining < 0;

  return (
    <>
      <PageHeader title="Dashboard">
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

          <DashboardCharts summary={summary} />

          <DashboardWalletsCard portfolio={walletPortfolio} />

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <Card className="w-full md:col-span-1">
            <div className="flex items-center justify-between p-4 md:p-5">
              <span className="font-head text-base">Expenses</span>
              <span className="tabular-nums text-lg font-semibold md:text-xl">
                {formatEuro(summary.expenses)}
              </span>
            </div>
            <BreakdownList
              items={summary.expenseBreakdown}
              incomeTotal={summary.income}
            />
          </Card>

          <Card className="w-full md:col-span-1">
            <div className="flex items-center justify-between p-4 md:p-5">
              <div>
                <span className="font-head text-base">Broker transfers</span>
                <p className="text-xs text-muted-foreground">
                  From main bank · counts in budget
                </p>
              </div>
              <span className="tabular-nums text-lg font-semibold md:text-xl">
                {formatEuro(summary.investments)}
              </span>
            </div>
            <BreakdownList
              items={summary.investmentBreakdown}
              incomeTotal={summary.income}
            />
            {summary.investmentDeploymentBreakdown.length > 0 && (
              <div className="border-t-2 border-border">
                <div className="flex items-center justify-between px-4 pt-4">
                  <div>
                    <p className="text-sm font-medium">Wallet DCA this month</p>
                    <p className="text-xs text-muted-foreground">
                      PEA, CTO, Bitstack · included in remaining
                    </p>
                  </div>
                  <span className="tabular-nums text-sm font-semibold">
                    {formatEuro(summary.investmentDeployments)}
                  </span>
                </div>
                <BreakdownList
                  items={summary.investmentDeploymentBreakdown}
                  incomeTotal={summary.income}
                />
              </div>
            )}
          </Card>

          <Card className="w-full md:col-span-2">
            <div className="flex items-center justify-between p-4 md:p-5">
              <span className="font-head text-base">Savings</span>
              <span className="tabular-nums text-lg font-semibold md:text-xl">
                {formatEuro(summary.savings)}
              </span>
            </div>
            <BreakdownList
              items={summary.savingsBreakdown}
              incomeTotal={summary.income}
            />
          </Card>
          </div>
        </div>

        {overBudget && (
          <div className="mt-4 text-center">
            <Badge
              variant="solid"
              className="bg-destructive text-destructive-foreground"
            >
              Over budget this month
            </Badge>
          </div>
        )}
      </PageContainer>
    </>
  );
}
