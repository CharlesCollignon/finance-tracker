"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { BudgetViewMode } from "@finance/core/constants";
import type { BudgetProgress } from "@finance/core/budget-limits";
import {
  formatMonthComparison,
  type MonthComparison,
} from "@finance/core/month-comparison";
import { savingsRatePercent } from "@finance/core/constants";
import type { SavingsGoalProgress } from "@finance/core/savings-goals";
import type { MonthlySummary } from "@finance/core/types/database";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { StatHero } from "@/components/finance/StatHero";
import {
  ProgressRing,
  DashboardAllocationChart,
} from "@/components/finance/lazy-charts";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

interface DashboardHomeProps {
  monthLabel: string;
  income: number;
  expenses: number;
  remaining: number;
  overBudget: boolean;
  budgetView: BudgetViewMode;
  statusLabel: string;
  statusTone: "ok" | "danger";
  budgetProgress: BudgetProgress[];
  goalProgress: SavingsGoalProgress[];
  viewToggle: ReactNode;
  walletsSlot: ReactNode;
  summary: MonthlySummary;
  /** Actual spend against the same window last month. */
  comparison: MonthComparison | null;
}

/**
 * The two lines that make a repeat visit worth something.
 *
 * The hero number alone reads identically on the 3rd and the 5th. A comparison
 * with the same window last month says whether the month is going well, and
 * the savings rate — until now buried inside the allocation chart's legend —
 * is the figure people actually track from month to month.
 */
function DashboardSignals({
  comparisonLine,
  comparisonDirection,
  savingsRate,
}: {
  comparisonLine: string | null;
  comparisonDirection: MonthComparison["direction"] | null;
  savingsRate: number | null;
}) {
  if (!comparisonLine && savingsRate === null) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
      {comparisonLine ? (
        <p
          className={cn(
            // Spending less is good news; spending more is not an error.
            comparisonDirection === "down"
              ? "text-success"
              : "text-muted-foreground",
          )}
        >
          {comparisonLine}
        </p>
      ) : null}

      {savingsRate !== null ? (
        <p className="text-muted-foreground">
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {savingsRate}%
          </span>{" "}
          saved
        </p>
      ) : null}
    </div>
  );
}

function remainingLabel(
  budgetView: BudgetViewMode,
  monthLabel: string,
): string {
  if (budgetView === "month_end") {
    return `At end of ${monthLabel}`;
  }
  return `Left in ${monthLabel}`;
}

export function DashboardHome({
  monthLabel,
  income,
  expenses,
  remaining,
  overBudget,
  budgetView,
  statusLabel,
  statusTone,
  budgetProgress,
  goalProgress,
  viewToggle,
  walletsSlot,
  summary,
  comparison,
}: DashboardHomeProps) {
  const formatEuro = useFormatCurrency();
  const showRings = budgetProgress.length > 0 || goalProgress.length > 0;
  const comparisonLine = comparison
    ? formatMonthComparison(comparison, formatEuro)
    : null;
  const savingsRate = savingsRatePercent(
    summary.savings,
    summary.investments,
    summary.investmentDeployments,
    summary.income,
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-6",
        "lg:h-[calc(100dvh-var(--shell-header-height)-3rem)]",
      )}
    >
      <div className="flex w-full shrink-0 justify-center">{viewToggle}</div>

      <Stagger
        className={cn(
          "grid w-full flex-1 grid-cols-1 gap-4 md:grid-cols-12",
          "lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_minmax(0,1.15fr)]",
        )}
        stagger={0.06}
      >
        <StaggerItem className="md:col-span-8 lg:h-full lg:min-h-0">
          <Card.Bezel
            className="h-full w-full"
            innerClassName="flex h-full flex-col overflow-y-auto p-6 md:p-8"
          >
            <div className="flex flex-1 flex-col items-center justify-center">
              <StatHero
                label={remainingLabel(budgetView, monthLabel)}
                amount={formatEuro(remaining)}
                amountClassName={
                  overBudget ? "text-destructive" : "text-primary-ink"
                }
                subtitle={
                  <p>
                    <span className="privacy-amount text-success tabular-nums">
                      {formatEuro(income)}
                    </span>
                    {" earned · "}
                    <span className="privacy-amount text-destructive tabular-nums">
                      {formatEuro(expenses)}
                    </span>
                    {" spent"}
                  </p>
                }
                status={
                  <span
                    className={cn(
                      statusTone === "danger"
                        ? "text-destructive"
                        : "text-success",
                    )}
                  >
                    {statusLabel}
                  </span>
                }
              />

              <DashboardSignals
                comparisonLine={comparisonLine}
                comparisonDirection={comparison?.direction ?? null}
                savingsRate={savingsRate}
              />

              {showRings ? (
                <div className="mt-6 flex w-full flex-col items-center border-t border-border pt-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Budgets & goals
                    </h2>
                    <Button
                      variant="link"
                      size="sm"
                      render={<Link href="/budgets">Manage</Link>}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
                    {budgetProgress.map((row) => (
                      <ProgressRing
                        key={row.budgetId}
                        ratio={row.ratio}
                        label={row.label}
                        detail={`${formatEuro(row.spent)} / ${formatEuro(row.limit)}`}
                        over={row.over}
                      />
                    ))}
                    {goalProgress.map((row) => (
                      <ProgressRing
                        key={row.goal.id}
                        ratio={row.ratio}
                        label={row.goal.name}
                        detail={`${formatEuro(row.saved)} / ${formatEuro(Number(row.goal.target_amount))}`}
                        colorVar="--info"
                        colorFallback="#60a5fa"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card.Bezel>
        </StaggerItem>

        <StaggerItem className="md:col-span-4 lg:h-full lg:min-h-0">
          <Card.Bezel
            className="h-full w-full"
            innerClassName="flex h-full flex-col overflow-y-auto p-5 md:p-6"
          >
            {walletsSlot}
          </Card.Bezel>
        </StaggerItem>

        <StaggerItem className="md:col-span-12 lg:h-full lg:min-h-0">
          <Card.Bezel
            className="h-full w-full"
            innerClassName="flex h-full flex-col overflow-y-auto p-5 md:p-6"
          >
            <DashboardAllocationChart summary={summary} />
          </Card.Bezel>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
