import { useEffect } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { formatSigned } from "@finance/core/amount-sign";
import { formatSignedPercentOf } from "@finance/core/constants";
import type { UpcomingInvestment } from "@finance/core/investment-upcoming";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const GROW = Easing.bezier(...EASE_STANDARD);

/**
 * Every placement at once, at the top of the screen: what it is worth
 * today, what that has made, and the run of months money has gone in.
 *
 * Gamified the app's way — moments and markers, never a score: the figure
 * counts up, the bar fills with what was put in and then with what it
 * earned, and the months-running line is there to be kept going. It
 * replaces the screen's old total and the charts under each account, which
 * drew the same numbers three times.
 */
export function PlacementsSummary({
  marketValue,
  invested,
  gainLoss,
  hasMarketValue,
  savingsTotal,
  streak,
  next,
  monthly,
}: {
  /** What the investment accounts are worth. */
  marketValue: number;
  /** What was put into them. */
  invested: number;
  gainLoss: number;
  /** Whether any price was read: without one, there is no gain to speak of. */
  hasMarketValue: boolean;
  /** The savings accounts beside them, said under the bar. */
  savingsTotal: number;
  /** Months running with a contribution. */
  streak: number;
  /** The next contribution the recurring entries call for. */
  next: UpcomingInvestment | null;
  /** What the recurring entries put in each month, every account together. */
  monthly: number;
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const fill = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    fill.set(
      reduce
        ? 1
        : withDelay(
            200,
            withTiming(1, { duration: DURATION.count, easing: GROW }),
          ),
    );
  }, [fill, reduce]);

  const showGain = hasMarketValue && gainLoss !== 0 && invested > 0;
  const up = gainLoss > 0;
  const returnShare = invested > 0 ? gainLoss / invested : 0;
  // The bar is the larger of the two, full: what was put in, then what it
  // earned on top — or, at a loss, what is left of what was put in.
  const whole = Math.max(marketValue, invested, 1);
  const base = Math.min(marketValue, invested) / whole;
  const extra = Math.abs(marketValue - invested) / whole;

  const baseStyle = useAnimatedStyle(() => ({
    width: `${base * 100 * fill.get()}%`,
  }));
  const extraStyle = useAnimatedStyle(() => ({
    width: `${extra * 100 * fill.get()}%`,
  }));

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="muted" className="text-sm">
            {t("wallets.summaryTitle")}
          </Text>
          <AnimatedAmount
            value={marketValue}
            startFrom={0}
            format={formatEuro}
            style={TYPE.figure}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        </View>
        {showGain ? (
          <View className="items-end gap-1">
            <View
              className={cn(
                "flex-row items-center gap-1 rounded-full px-2.5 py-1",
                up ? "bg-success/15" : "bg-destructive/15",
              )}
            >
              <Ionicons
                name={up ? "trending-up" : "trending-down"}
                size={ICON.sm}
                color={up ? colors.success : colors.destructive}
              />
              <PrivateAmount
                className={cn(
                  "text-sm font-semibold",
                  up ? "text-success" : "text-destructive",
                )}
              >
                {formatSigned(gainLoss, formatEuro)}
              </PrivateAmount>
            </View>
            <PrivateAmount
              className={cn(
                "text-xs font-medium",
                up ? "text-success" : "text-destructive",
              )}
            >
              {formatSignedPercentOf(returnShare, locale)}
            </PrivateAmount>
          </View>
        ) : null}
      </View>

      {invested > 0 ? (
        <View className="gap-2">
          <View className="h-2 flex-row overflow-hidden rounded-full bg-muted">
            <Animated.View style={baseStyle}>
              <View className="flex-1 bg-foreground/45" />
            </Animated.View>
            {showGain ? (
              <Animated.View style={extraStyle}>
                <View
                  className={cn(
                    "flex-1",
                    up ? "bg-success" : "bg-destructive/60",
                  )}
                />
              </Animated.View>
            ) : null}
          </View>
          <PrivateAmount className="text-xs text-muted-foreground">
            {`${formatEuro(invested)} ${t("wallets.investedSuffix")}`}
          </PrivateAmount>
        </View>
      ) : null}

      {savingsTotal > 0 ? (
        <PrivateAmount className="text-xs text-muted-foreground">
          {t("wallets.summarySavings", {
            amount: formatEuro(savingsTotal),
            total: formatEuro(savingsTotal + marketValue),
          })}
        </PrivateAmount>
      ) : null}

      {streak > 0 || next || monthly > 0 ? (
        <View className="gap-2.5 border-t border-border pt-4">
          {streak > 0 ? (
            <View className="flex-row items-center gap-2.5">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
                <Ionicons
                  name="flame"
                  size={ICON.sm}
                  color={colors.primaryForeground}
                />
              </View>
              <Text className="min-w-0 flex-1 text-sm font-medium">
                {t("wallets.contributionStreak", { count: streak })}
              </Text>
            </View>
          ) : null}
          {next ? (
            <View className="flex-row items-center gap-2.5">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
                <Ionicons
                  name="calendar-outline"
                  size={ICON.sm}
                  color={colors.foreground}
                />
              </View>
              <PrivateAmount className="min-w-0 flex-1 text-sm">
                {t("wallets.nextContributionOn", {
                  date: next.dateLabel,
                  amount: formatEuro(next.amount),
                })}
              </PrivateAmount>
            </View>
          ) : null}
          {monthly > 0 ? (
            <View className="flex-row items-center gap-2.5">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
                <Ionicons
                  name="repeat"
                  size={ICON.sm}
                  color={colors.foreground}
                />
              </View>
              <PrivateAmount className="min-w-0 flex-1 text-sm">
                {`${formatEuro(monthly)} ${t("wallets.perMonth")}`}
              </PrivateAmount>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
