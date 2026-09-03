import { View } from "react-native";

import type { BudgetViewMode } from "@finance/core/constants";
import {
  formatMonthComparison,
  type MonthComparison,
} from "@finance/core/month-comparison";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";

interface MonthStandingProps {
  monthLabel: string;
  income: number;
  expenses: number;
  remaining: number;
  budgetView: BudgetViewMode;
  /** How far through the month today is, 0–1. Null for a month not running. */
  elapsed: number | null;
  comparison: MonthComparison | null;
  savingsRate: number | null;
}

/**
 * One figure, and the two that explain it.
 *
 * The screen used to lead with a hero number, a status line, a comparison, a
 * savings rate and a row of progress rings, all inside one card and all
 * competing for the same glance. A month has one headline — what is left —
 * and everything else is either the arithmetic behind it or a decision, which
 * now lives above this.
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
  const formatEuro = useFormatCurrency();
  const short = remaining < 0;
  const comparisonLine = comparison
    ? formatMonthComparison(comparison, formatEuro)
    : null;
  // Spending less than last month is good news; spending more is not an error.
  const comparisonGood = comparison?.direction === "down";

  return (
    <Card bezel innerClassName="gap-5 p-5">
      <View className="gap-1">
        <Text className="text-sm text-muted-foreground">
          {`${short ? "Over" : "Left"} in ${monthLabel}${
            budgetView === "month_end" ? ", counting what is still to come" : ""
          }`}
        </Text>
        <AnimatedAmount
          value={Math.abs(remaining)}
          format={formatEuro}
          className={cn(
            "text-4xl font-semibold",
            short && "text-destructive",
          )}
        />
      </View>

      {elapsed !== null ? (
        <View className="gap-1.5">
          <View
            accessibilityRole="image"
            accessibilityLabel={`${Math.round(elapsed * 100)}% of the month elapsed`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, elapsed * 100)}%` }}
            />
          </View>
          <Text className="text-xs text-muted-foreground">
            {`${Math.round(elapsed * 100)}% of the month gone`}
          </Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-x-8 gap-y-3">
        <View className="gap-0.5">
          <Text className="text-xs uppercase tracking-wider text-muted-foreground">
            Came in
          </Text>
          <PrivateAmount>{formatEuro(income)}</PrivateAmount>
        </View>
        <View className="gap-0.5">
          <Text className="text-xs uppercase tracking-wider text-muted-foreground">
            Went out
          </Text>
          <PrivateAmount>{formatEuro(expenses)}</PrivateAmount>
        </View>
        {savingsRate !== null ? (
          <View className="gap-0.5">
            {/* Not "kept": a month close already uses that word for cash left
                plus what was set aside, which is a different figure. */}
            <Text className="text-xs uppercase tracking-wider text-muted-foreground">
              Savings rate
            </Text>
            <Text>{`${savingsRate}%`}</Text>
          </View>
        ) : null}
      </View>

      {comparisonLine ? (
        <Text
          className={cn(
            "text-sm",
            comparisonGood ? "text-success" : "text-muted-foreground",
          )}
        >
          {comparisonLine}
        </Text>
      ) : null}
    </Card>
  );
}
