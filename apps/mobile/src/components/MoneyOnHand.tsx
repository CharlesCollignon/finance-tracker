import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  budgetViewOptionLabel,
  type BudgetViewMode,
} from "@finance/core/constants";
import type { MonthComparison } from "@finance/core/month-comparison";
import {
  pulseExplanation,
  pulseHeadline,
  type MonthPulse,
} from "@finance/core/month-pulse";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Sparkline } from "@/components/charts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON, TYPE } from "@/theme/tokens";

interface MoneyOnHandProps {
  pulse: MonthPulse;
  monthLabel: string;
  income: number;
  expenses: number;
  /** What the month's arithmetic leaves, for the no-bank case. */
  remaining: number;
  budgetView: BudgetViewMode;
  /** Switching the view is the label's job now, so the setter comes with it. */
  onBudgetViewChange: (next: BudgetViewMode) => void;
  year: number;
  month: number;
  /** How far through the month today is, 0–1. Null for a month not running. */
  elapsed: number | null;
  comparison: MonthComparison | null;
  savingsRate: number | null;
  /** Named accounts whose balance could not be read, so the gap is visible. */
  unreadable: string[];
  /** Net per month, oldest first, for the mark beside the figure. */
  trend: number[];
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
  onBudgetViewChange,
  year,
  month,
  elapsed,
  comparison,
  savingsRate,
  unreadable,
  trend,
}: MoneyOnHandProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const banked = pulse.onHand !== null && pulse.free !== null;
  const headlineAmount = banked ? Math.abs(pulse.free!) : Math.abs(remaining);
  const short = banked ? pulse.free! < 0 : remaining < 0;

  return (
    <Card bezel innerClassName="gap-5 p-5">
      <View className="gap-2">
        {/* The qualifier that used to trail the sentence — "counting what is
            still to come" — is this control instead. It sits beside the label
            it modifies rather than in a row of its own above the figures. */}
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="label">
            {banked ? pulseHeadline(pulse) : short ? "Over by" : "Left"}
          </Text>
          <BudgetViewControl
            view={budgetView}
            year={year}
            month={month}
            onChange={onBudgetViewChange}
          />
        </View>

        <View className="flex-row items-center gap-3">
          <View className="flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-2">
            <AnimatedAmount
              value={headlineAmount}
              format={formatEuro}
              style={TYPE.hero}
              className={cn(short && "text-destructive")}
            />
            <SpendDelta comparison={comparison} />
          </View>
          {/* Which way it has been going, at the size that answer deserves. */}
          <Sparkline values={trend} />
        </View>
      </View>

      {/* The arithmetic, in figures: what is there, what leaves, what arrives.
          It says what the explanatory line under the figure used to say, so
          that line is gone rather than repeating this in words. */}
      {banked ? (
        <View className="-mt-3 flex-row flex-wrap items-baseline gap-x-1.5 gap-y-1">
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
      ) : (
        <Text variant="micro" className="-mt-3">
          {pulseExplanation(pulse)}
        </Text>
      )}

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
          <Text variant="micro">
            {`${Math.round(elapsed * 100)}% of ${monthLabel} gone`}
          </Text>
        </View>
      ) : null}

      <View className="border-t border-border">
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

/**
 * Today's figure or the month's, as one pill.
 *
 * Two states, so it toggles rather than opening a menu — a chevron would
 * promise a list that does not exist. The full wording, with the cutoff date
 * the short label drops, is what a screen reader is given.
 */
function BudgetViewControl({
  view,
  year,
  month,
  onChange,
}: {
  view: BudgetViewMode;
  year: number;
  month: number;
  onChange: (next: BudgetViewMode) => void;
}) {
  const colors = useThemeColors();
  const next: BudgetViewMode = view === "current" ? "month_end" : "current";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={budgetViewOptionLabel(view, year, month)}
      accessibilityHint={`Switches to ${budgetViewOptionLabel(next, year, month)}`}
      hitSlop={8}
      onPress={() => {
        void hapticSelection();
        onChange(next);
      }}
      className="flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5"
    >
      <Text variant="micro" className="text-foreground">
        {view === "current" ? "Today" : "Month end"}
      </Text>
      <Ionicons
        name="swap-horizontal"
        size={ICON.xs}
        color={colors.mutedForeground}
      />
    </Pressable>
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
          "text-xs",
          tone === "in" && "text-success",
          tone === "out" && "text-destructive",
        )}
      >
        {amount}
      </PrivateAmount>
      <Text className="text-xs text-muted-foreground">{label}</Text>
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
        size={ICON.xs}
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
        !last && "border-b border-border",
      )}
    >
      <View className="flex-row items-center gap-1.5">
        {icon ? (
          <Ionicons name={icon} size={ICON.sm} color={iconColor} />
        ) : null}
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      {plain ? <Text>{value}</Text> : <PrivateAmount>{value}</PrivateAmount>}
    </View>
  );
}
