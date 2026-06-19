"use client";

import { PieChart } from "@/components/retroui/charts/PieChart";
import { Treemap } from "@/components/retroui/charts/Treemap";
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
      name: "Broker transfers",
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

  const expenseTreemapData = summary.expenseBreakdown.map((item) => ({
    name: item.name,
    size: item.total,
  }));

  const expenseTotal = expenseTreemapData.reduce(
    (sum, item) => sum + item.size,
    0,
  );

  const hasAllocation = allocation.length > 0 && summary.income > 0;
  const hasExpenses = expenseTreemapData.length > 0;

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
          <>
            <Treemap
              data={expenseTreemapData}
              valueFormatter={(value) => formatEuro(value)}
              colors={[
                CHART_COLORS[1],
                CHART_COLORS[0],
                CHART_COLORS[2],
                CHART_COLORS[3],
                CHART_COLORS[4],
              ]}
              className="h-56 sm:h-64"
            />
            <ul className="flex flex-col gap-2 px-4 pb-4">
              {expenseTreemapData.map((item, index) => {
                const pct =
                  expenseTotal > 0
                    ? Math.round((item.size / expenseTotal) * 100)
                    : 0;
                const fill =
                  [
                    CHART_COLORS[1],
                    CHART_COLORS[0],
                    CHART_COLORS[2],
                    CHART_COLORS[3],
                    CHART_COLORS[4],
                  ][index % 5];

                return (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 border border-border"
                        style={{ backgroundColor: fill }}
                        aria-hidden
                      />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {formatEuro(item.size)}
                      <span className="ml-1 text-muted-foreground">
                        ({pct}%)
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No expenses recorded for this month yet.
          </p>
        )}
      </Card>
    </div>
  );
}
