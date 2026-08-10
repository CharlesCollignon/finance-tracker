"use client";

import { PieChart } from "@/components/retroui/charts/PieChart";
import { Card } from "@/components/retroui/Card";
import { formatEuro } from "@finance/core/constants";
import { ALLOCATION_COLORS } from "@finance/core/category-styles";
import type { MonthlySummary } from "@finance/core/types/database";

interface DashboardAllocationChartProps {
  summary: MonthlySummary;
}

export function DashboardAllocationChart({
  summary,
}: DashboardAllocationChartProps) {
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

  const hasAllocation = allocation.length > 0 && summary.income > 0;

  return (
    <Card className="flex w-full flex-col">
      <div className="p-4 md:p-5">
        <h2 className="font-head text-base">Where your income goes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Split of this month&apos;s income
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
            className="h-52 sm:h-56"
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
          Add income to see how your money is allocated.
        </p>
      )}
    </Card>
  );
}
