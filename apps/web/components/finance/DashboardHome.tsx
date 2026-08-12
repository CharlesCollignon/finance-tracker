"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  formatEuro,
  type BudgetViewMode,
} from "@finance/core/constants";
import type { BudgetProgress } from "@finance/core/budget-limits";
import type { SavingsGoalProgress } from "@finance/core/savings-goals";
import type { MonthlySummary } from "@finance/core/types/database";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Button } from "@/components/retroui/Button";
import { StatHero } from "@/components/finance/StatHero";
import {
  ProgressRing,
  DashboardAllocationChart,
} from "@/components/finance/lazy-charts";
import { cn } from "@/lib/utils";

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
}: DashboardHomeProps) {
  const showRings = budgetProgress.length > 0 || goalProgress.length > 0;

  return (
    <Stagger className="flex flex-col items-center gap-10 md:gap-12" stagger={0.06}>
      <StaggerItem className="flex w-full justify-center">
        {viewToggle}
      </StaggerItem>

      <StaggerItem className="w-full">
        <StatHero
          label={remainingLabel(budgetView, monthLabel)}
          amount={formatEuro(remaining)}
          amountClassName={overBudget ? "text-destructive" : "text-primary"}
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
                statusTone === "danger" ? "text-destructive" : "text-success",
              )}
            >
              {statusLabel}
            </span>
          }
        />
      </StaggerItem>

      {showRings ? (
        <StaggerItem className="w-full">
          <section className="flex w-full flex-col items-center text-center">
            <h2 className="text-sm font-medium text-muted-foreground">
              Budgets & goals
            </h2>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              render={<Link href="/budgets">Manage</Link>}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-6 md:gap-8">
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
                  colorFallback="#2563eb"
                />
              ))}
            </div>
          </section>
        </StaggerItem>
      ) : null}

      <StaggerItem className="w-full">{walletsSlot}</StaggerItem>

      <StaggerItem className="w-full">
        <DashboardAllocationChart summary={summary} />
      </StaggerItem>
    </Stagger>
  );
}
