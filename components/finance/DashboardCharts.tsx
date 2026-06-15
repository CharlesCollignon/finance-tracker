"use client";

import { PieChart } from "@/components/retroui/charts/PieChart";
import { BarChart } from "@/components/retroui/charts/BarChart";
import { Card } from "@/components/retroui/Card";
import { formatEuro } from "@/lib/constants";
import { ALLOCATION_COLORS, CHART_COLORS } from "@/lib/category-styles";
import type { MonthlySummary } from "@/lib/types/database";

interface DashboardChartsProps {
  summary: MonthlySummary;
}

export function DashboardCharts({ summary }: DashboardChartsProps) {
  const allocation = [
    {
      name: "Expenses",
      value: summary.expenses,
      fill: ALLOCATION_COLORS.expenses,
    },
    {
      name: "Savings",
      value: summary.savings,
      fill: ALLOCATION_COLORS.savings,
    },
    {
      name: "Investments",
      value: summary.investments,
      fill: ALLOCATION_COLORS.investments,
    },
    ...(summary.remaining > 0
      ? [
          {
            name: "Remaining",
            value: summary.remaining,
            fill: ALLOCATION_COLORS.remaining,
          },
        ]
      : []),
  ].filter((item) => item.value > 0);

  const expenseBarData = summary.expenseBreakdown.map((item) => ({
    category: item.name,
    amount: item.total,
  }));

  const hasAllocation = allocation.length > 0 && summary.income > 0;
  const hasExpenses = expenseBarData.length > 0;

  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
      <Card className="flex flex-col">
        <div className="p-4 md:p-5">
          <h2 className="font-head text-base">Income allocation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Where your income goes this month
          </p>
        </div>
        {hasAllocation ? (
          <>
            <PieChart
              data={allocation}
              dataKey="value"
              nameKey="name"
              colors={allocation.map((item) => item.fill)}
              valueFormatter={(value) => formatEuro(value)}
              innerRadius={48}
              outerRadius={88}
              className="h-56 sm:h-64"
            />
            <ul className="flex flex-col gap-2 px-4 pb-4">
              {allocation.map((item) => {
                const pct =
                  summary.income > 0
                    ? Math.round((item.value / summary.income) * 100)
                    : 0;

                return (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 border border-border"
                        style={{ backgroundColor: item.fill }}
                        aria-hidden
                      />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {formatEuro(item.value)}
                      <span className="ml-1 text-muted-foreground">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Add income transactions to see how your money is allocated.
          </p>
        )}
      </Card>

      <Card className="flex flex-col">
        <div className="p-4 md:p-5">
          <h2 className="font-head text-base">Expense breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spending by category
          </p>
        </div>
        {hasExpenses ? (
          <BarChart
            data={expenseBarData}
            index="category"
            categories={["amount"]}
            alignment="horizontal"
            fillColors={[CHART_COLORS[1]]}
            strokeColors={["var(--foreground)"]}
            valueFormatter={(value) => formatEuro(value)}
            showGrid={false}
            className="h-56 sm:h-64"
          />
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No expenses recorded for this month yet.
          </p>
        )}
      </Card>
    </div>
  );
}
