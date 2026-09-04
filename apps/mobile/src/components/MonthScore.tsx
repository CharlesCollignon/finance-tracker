import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { MonthPulse } from "@finance/core/month-pulse";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface MonthScoreProps {
  pulse: MonthPulse;
  streak: number;
  bestStreak: number;
  /** Typical unrecorded spending, for a cap that has not been set yet. */
  baseline: number | null;
}

/**
 * How the month is going against the only target the app can honestly set.
 *
 * The web twin carries the reasoning. In short: the app's one unusual claim
 * is that it can measure the spending nobody enters, that used to arrive once
 * a month as a verdict on a month already over, and given a live balance the
 * same arithmetic runs today — which turns it into something to play against.
 *
 * What is borrowed from games is only the parts that survive being checkable:
 * one clear target, live feedback against it, and a streak worth protecting.
 * No points, no levels, no score out of a hundred.
 */
export function MonthScore({
  pulse,
  streak,
  bestStreak,
  baseline,
}: MonthScoreProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const hasMeter = pulse.unrecordedSoFar !== null;
  const hasStreak = streak > 0 || bestStreak > 0;

  if (!hasMeter && !hasStreak && !pulse.overRecorded) {
    return null;
  }

  // The cap if the user set one; otherwise their own median, which is what a
  // cap would be suggested from anyway. Worded differently, because one is a
  // target they chose and the other only describes normal.
  const target = pulse.cap ?? baseline;
  const chosen = pulse.cap !== null;
  const spent = pulse.unrecordedSoFar ?? 0;
  const ratio =
    target !== null && target > 0 ? Math.min(1.5, spent / target) : null;
  const over = target !== null && spent > target;

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-sm font-medium">Untracked spending, so far</Text>
        <View className="flex-row items-center gap-2">
          {streak > 1 ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-0.5">
              <Ionicons name="flame" size={11} color={colors.primaryInk} />
              <Text className="text-xs font-medium text-accent-foreground">
                {`${streak} in a row`}
              </Text>
            </View>
          ) : null}
          {bestStreak > streak && bestStreak > 1 ? (
            <View className="flex-row items-center gap-1 rounded-full border border-border px-2 py-0.5">
              <Ionicons
                name="trophy-outline"
                size={11}
                color={colors.mutedForeground}
              />
              <Text className="text-xs text-muted-foreground">
                {`best ${bestStreak}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {pulse.overRecorded ? (
        <Text className="text-sm text-muted-foreground">
          Your account holds more than the ledger allows — income is missing, or
          something is recorded twice. Nothing to measure until that is sorted.
        </Text>
      ) : hasMeter ? (
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between gap-3">
            <PrivateAmount
              className={cn(
                "text-2xl font-semibold",
                over && "text-destructive",
              )}
            >
              {formatEuro(spent)}
            </PrivateAmount>
            {target !== null ? (
              <Text className="text-sm text-muted-foreground">
                {`${chosen ? "of your " : "against a usual "}${formatEuro(
                  target,
                )}${chosen ? " cap" : ""}`}
              </Text>
            ) : null}
          </View>

          {ratio !== null ? (
            <View
              accessibilityRole="image"
              accessibilityLabel={`${formatEuro(spent)} of ${formatEuro(target!)}`}
              className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
            >
              <View
                className={cn(
                  "h-full rounded-full",
                  over ? "bg-destructive" : "bg-success",
                )}
                // Capped at the full width: a bar drawn past its own track
                // reads as a rendering bug rather than as an overspend, and
                // the amount above already says by how much.
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </View>
          ) : null}

          <Text
            className={cn(
              "text-sm",
              over ? "text-muted-foreground" : "text-success",
            )}
          >
            {target === null
              ? "Close two months and the app will know what normal looks like for you."
              : over
                ? `${formatEuro(spent - target)} past it, with the month still running.`
                : `${formatEuro(target - spent)} of room left this month.`}
          </Text>

          <Text className="text-xs text-muted-foreground">
            Measured against your last close, not remembered — so it moves when
            the bank does, and it is not final until the month is closed.
          </Text>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground">
          Close a month against your bank balance and this fills in: the app
          works out what left the account that no entry explains.
        </Text>
      )}
    </Card>
  );
}
