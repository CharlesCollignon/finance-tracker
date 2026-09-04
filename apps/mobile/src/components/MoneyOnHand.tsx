import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { BudgetViewMode } from "@finance/core/constants";
import type { MonthComparison } from "@finance/core/month-comparison";
import {
  pulseExplanation,
  pulseHeadline,
  type MonthPulse,
} from "@finance/core/month-pulse";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface MoneyOnHandProps {
  pulse: MonthPulse;
  monthLabel: string;
  income: number;
  expenses: number;
  /** What the month's arithmetic leaves, for the no-bank case. */
  remaining: number;
  budgetView: BudgetViewMode;
  /** How far through the month today is, 0–1. Null for a month not running. */
  elapsed: number | null;
  comparison: MonthComparison | null;
  savingsRate: number | null;
  /** Named accounts whose balance could not be read, so the gap is visible. */
  unreadable: string[];
}

/**
 * The one figure the screen leads with. The web twin carries the reasoning:
 * a month can be comfortably in surplus on paper while the rent leaves
 * tomorrow and the salary lands in a week, and the figure that says so is
 * what the account holds now less what the month has already promised.
 *
 * The arithmetic is shown under the number rather than hidden, because a big
 * figure nobody can check is a big figure nobody believes.
 */
export function MoneyOnHand({
  pulse,
  monthLabel,
  income,
  expenses,
  remaining,
  budgetView,
  elapsed,
  comparison,
  savingsRate,
  unreadable,
}: MoneyOnHandProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const banked = pulse.onHand !== null && pulse.free !== null;
  const headlineAmount = banked ? Math.abs(pulse.free!) : Math.abs(remaining);
  const short = banked ? pulse.free! < 0 : remaining < 0;

  return (
    <Card bezel innerClassName="gap-5 p-5">
      <View className="gap-1">
        <Text className="text-sm text-muted-foreground">
          {banked
            ? pulseHeadline(pulse)
            : `${short ? "Over" : "Left"} in ${monthLabel}${
                budgetView === "month_end"
                  ? ", counting what is still to come"
                  : ""
              }`}
        </Text>
        <View className="flex-row flex-wrap items-end gap-x-3 gap-y-2">
          <AnimatedAmount
            value={headlineAmount}
            format={formatEuro}
            className={cn(
              "text-4xl font-semibold",
              short && "text-destructive",
            )}
          />
          <SpendDelta comparison={comparison} />
        </View>
        <Text className="text-sm text-muted-foreground">
          {banked
            ? pulseExplanation(pulse)
            : "Connect a bank to lead with what is actually in your account."}
        </Text>
      </View>

      {/* The sum, spelled out: what is there, what leaves, what arrives. */}
      {banked ? (
        <View className="flex-row flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <Term label="in the account" amount={formatEuro(pulse.onHand!)} />
          {pulse.committed > 0 ? (
            <>
              <Text className="text-sm text-muted-foreground">−</Text>
              <Term
                label="still to leave"
                amount={formatEuro(pulse.committed)}
                tone="out"
              />
            </>
          ) : null}
          {pulse.arriving > 0 ? (
            <>
              <Text className="text-sm text-muted-foreground">+</Text>
              <Term
                label="still to arrive"
                amount={formatEuro(pulse.arriving)}
                tone="in"
              />
            </>
          ) : null}
        </View>
      ) : null}

      {elapsed !== null ? (
        <View className="gap-1.5">
          <View
            accessibilityRole="image"
            accessibilityLabel={`${Math.round(elapsed * 100)}% of the month elapsed`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
          >
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, elapsed * 100)}%` }}
            />
          </View>
          <Text className="text-xs text-muted-foreground">
            {`${Math.round(elapsed * 100)}% of ${monthLabel} gone`}
          </Text>
        </View>
      ) : null}

      <View className="border-t border-foreground/10">
        <Row
          label="Came in"
          value={formatEuro(income)}
          icon="trending-up"
          iconColor={colors.success}
        />
        <Row
          label="Went out"
          value={formatEuro(expenses)}
          icon="trending-down"
          iconColor={colors.destructive}
        />
        {savingsRate !== null ? (
          /* Not "kept": a month close already uses that word for cash left
             plus what was set aside, which is a different figure. */
          <Row label="Savings rate" value={`${savingsRate}%`} plain last />
        ) : null}
      </View>

      {/* A balance that could not be read must never be silent: the figures
          above would simply be short by whatever that account holds. */}
      {unreadable.length > 0 ? (
        <Text className="text-sm text-destructive">
          {`Could not read ${unreadable.join(", ")} — ${
            unreadable.length === 1 ? "its balance is" : "their balances are"
          } not counted above.`}
        </Text>
      ) : null}
    </Card>
  );
}

function Term({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: string;
  tone?: "in" | "out";
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <PrivateAmount
        className={cn(
          "text-sm",
          tone === "in" && "text-success",
          tone === "out" && "text-destructive",
        )}
      >
        {amount}
      </PrivateAmount>
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </View>
  );
}

/**
 * Spending against the same stretch of last month, as a pill.
 *
 * The reference wears its change as a badge beside the figure, and the shape
 * is worth borrowing — but not the reading. That badge is a gain, where this
 * is spending, so the sign reads the other way round: less than last month is
 * the good news, and it is the one that gets the colour.
 *
 * Absent when there is nothing fair to compare with. A first month has no
 * previous one, and an unqualified "+100%" against a month with two
 * transactions in it would be technically true and useless.
 */
function SpendDelta({ comparison }: { comparison: MonthComparison | null }) {
  const colors = useThemeColors();

  if (
    !comparison ||
    !comparison.comparable ||
    comparison.ratio === null ||
    comparison.direction === "flat"
  ) {
    return null;
  }

  const down = comparison.direction === "down";
  const percent = Math.abs(Math.round(comparison.ratio * 100));

  return (
    <View
      className={cn(
        "mb-1 flex-row items-center gap-1 rounded-full px-2.5 py-1",
        down ? "bg-success/15" : "bg-primary/20",
      )}
    >
      <Ionicons
        name={down ? "trending-down" : "trending-up"}
        size={11}
        color={down ? colors.success : colors.primary}
      />
      <Text
        className={cn(
          "text-xs font-semibold",
          down ? "text-success" : "text-primary",
        )}
      >
        {`${down ? "\u2212" : "+"}${percent}%`}
      </Text>
    </View>
  );
}

/** Label left, value right, hairline between — the reference's stat rows. */
function Row({
  label,
  value,
  icon,
  iconColor,
  plain = false,
  last = false,
}: {
  label: string;
  value: string;
  icon?: "trending-up" | "trending-down";
  iconColor?: string;
  plain?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between gap-3 py-2.5",
        !last && "border-b border-foreground/10",
      )}
    >
      <View className="flex-row items-center gap-1.5">
        {icon ? <Ionicons name={icon} size={13} color={iconColor} /> : null}
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      {plain ? <Text>{value}</Text> : <PrivateAmount>{value}</PrivateAmount>}
    </View>
  );
}
