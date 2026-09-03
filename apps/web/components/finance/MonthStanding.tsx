"use client";

import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import type { BudgetViewMode } from "@finance/core/constants";
import {
  formatMonthComparison,
  type MonthComparison,
} from "@finance/core/month-comparison";

interface MonthStandingProps {
  monthLabel: string;
  income: number;
  expenses: number;
  remaining: number;
  budgetView: BudgetViewMode;
  /** How far through the month today is, 0–1. Null for a month not running. */
  elapsed: number | null;
  /**
   * Actual spend against the same window last month. Worded here rather than
   * on the server, because the wording carries an amount and only the client
   * knows which currency the reader has chosen.
   */
  comparison: MonthComparison | null;
  savingsRate: number | null;
}

/**
 * One figure, and the two that explain it.
 *
 * The screen used to lead with a hero number flanked by two progress rings and
 * an allocation chart, all competing for the same glance. A month has one
 * headline — what is left — and everything else is either the arithmetic
 * behind it or a decision, which now lives above this.
 *
 * The bar underneath is time, not money: it says how much of the month has
 * run, which is the only honest way to read "left" halfway through.
 */
export function MonthStanding({
  monthLabel,
  income,
  expenses,
  remaining,
  budgetView,
  elapsed,
  comparison,
  savingsRate,
}: MonthStandingProps) {
  const formatMoney = useFormatCurrency();
  const short = remaining < 0;
  const comparisonLine = comparison
    ? formatMonthComparison(comparison, formatMoney)
    : null;
  // Spending less than last month is good news; spending more is not an error.
  const comparisonGood = comparison?.direction === "down";

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {short ? "Over" : "Left"} in {monthLabel}
          {budgetView === "month_end" ? ", counting what is still to come" : ""}
        </p>
        <PrivateAmount
          className={cn(
            "font-head text-4xl leading-none tabular-nums md:text-5xl",
            short && "text-destructive",
          )}
        >
          {formatMoney(Math.abs(remaining))}
        </PrivateAmount>
      </div>

      {elapsed !== null ? (
        <div className="flex flex-col gap-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${Math.round(elapsed * 100)}% of the month elapsed`}
          >
            <div
              className="h-full rounded-full bg-primary-rim"
              style={{ width: `${Math.min(100, elapsed * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.round(elapsed * 100)}% of the month gone
          </p>
        </div>
      ) : null}

      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Came in
          </dt>
          <PrivateAmount className="tabular-nums">
            {formatMoney(income)}
          </PrivateAmount>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Went out
          </dt>
          <PrivateAmount className="tabular-nums">
            {formatMoney(expenses)}
          </PrivateAmount>
        </div>
        {savingsRate !== null ? (
          <div className="flex flex-col gap-0.5">
            {/* Not "kept": a month close already uses that word for cash
                left plus what was set aside, which is a different figure. */}
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Savings rate
            </dt>
            <dd className="tabular-nums">{savingsRate}%</dd>
          </div>
        ) : null}
      </dl>

      {comparisonLine ? (
        <p
          className={cn(
            "text-sm",
            comparisonGood ? "text-success" : "text-muted-foreground",
          )}
        >
          {comparisonLine}
        </p>
      ) : null}
    </section>
  );
}
