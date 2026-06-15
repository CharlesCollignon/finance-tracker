import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { getMonthlySummary } from "@/lib/queries/finance";
import { parseMonthParams, formatEuro } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import {
  BreakdownList,
  SummaryCard,
} from "@/components/finance/SummaryCards";
import { Badge } from "@/components/retroui/Badge";
import { Card } from "@/components/retroui/Card";

interface DashboardPageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
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
  const summary = await getMonthlySummary(user.id, year, month);
  const overBudget = summary.remaining < 0;

  return (
    <>
      <PageHeader title="Dashboard">
        <Suspense fallback={<span className="text-sm">…</span>}>
          <MonthPicker basePath="/dashboard" />
        </Suspense>
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer>
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <SummaryCard label="Income" amount={summary.income} />

          <SummaryCard
            label="Remaining"
            amount={summary.remaining}
            highlight
            warning={overBudget}
          />

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
              <span className="font-head text-base">Investments</span>
              <span className="tabular-nums text-lg font-semibold md:text-xl">
                {formatEuro(summary.investments)}
              </span>
            </div>
            <BreakdownList
              items={summary.investmentBreakdown}
              incomeTotal={summary.income}
            />
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
