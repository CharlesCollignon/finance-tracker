import { useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { withExtraSaving } from "@finance/core/future-plan";
import type { ForwardProjection } from "@finance/core/projection";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { ExtraSlider } from "./ExtraSlider";
import { monthAheadLabel, usePlanMoney } from "./format";
import { PlanCard } from "./PlanCard";
import { YearCurve } from "./YearCurve";

export const EXTRA_MAX = 500;
const EXTRA_STEP = 25;
const EXTRA_CHIPS = [50, 100, 200] as const;

/** When the next milestone comes, with and without the extra. */
export interface MilestoneSooner {
  amount: number;
  /** Months away as things stand, or null when not inside the horizon. */
  without: number | null;
  /** Months away with the extra, or null. */
  with: number | null;
}

/**
 * The hero: what is kept a year from now, counting up over the curve that
 * gets there, and the "what if" under it — slide, or tap a chip, and a
 * dashed line shows the same year with that much more put aside each month,
 * and how much sooner the next milestone comes.
 */
export function YearAheadCard({
  projection,
  year,
  month,
  extra,
  onExtraChange,
  sooner,
}: {
  projection: ForwardProjection;
  year: number;
  month: number;
  extra: number;
  onExtraChange: (value: number) => void;
  sooner: MilestoneSooner | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const { whole, shown } = usePlanMoney();

  const summary = projection.summary;
  const points = useMemo(
    () => withExtraSaving(projection.points, extra),
    [projection.points, extra],
  );

  // How many months sooner the next milestone comes. A tick each time
  // sliding brings it closer, so the finger feels the moment it pays off.
  const gained =
    sooner && sooner.with !== null
      ? sooner.without === null
        ? Infinity
        : sooner.without - sooner.with
      : 0;
  const lastGained = useRef(gained);
  useEffect(() => {
    if (gained > lastGained.current) {
      void hapticSelection();
    }
    lastGained.current = gained;
  }, [gained]);

  if (!summary) {
    return null;
  }

  const figure = summary.grounded
    ? summary.endingKept
    : summary.addedAltogether;

  let soonerLine: string | null = null;
  if (extra > 0 && sooner && sooner.with !== null) {
    if (sooner.without === null) {
      soonerLine = t("futurePlan.whatIfNowReached", {
        milestone: shown(sooner.amount),
        month: monthAheadLabel(year, month, sooner.with, locale),
      });
    } else if (sooner.without > sooner.with) {
      soonerLine = t("futurePlan.whatIfSooner", {
        milestone: shown(sooner.amount),
        count: sooner.without - sooner.with,
      });
    }
  }

  return (
    <PlanCard bezel>
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-sm font-medium">
          {t("futurePlan.yearTitle")}
        </Text>
        <AnimatedAmount
          value={figure}
          format={whole}
          startFrom={0}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text variant="muted" className="text-sm">
          {t(
            summary.grounded
              ? "futurePlan.yearGrounded"
              : "futurePlan.yearAdded",
            { month: summary.endLabel },
          )}
        </Text>
      </View>

      {projection.makeup.noIncomeScheduled ? (
        <Pressable
          onPress={() => router.push("/(tabs)/recurring" as never)}
          className="rounded-card border border-destructive/40 bg-destructive/10 p-row"
          accessibilityRole="button"
          accessibilityLabel={t("projection.noIncomeCta")}
        >
          <Text className="text-sm">{t("projection.noIncomeCharge")}</Text>
        </Pressable>
      ) : null}

      <YearCurve
        points={points}
        extra={extra}
        money={shown}
        label={t("futurePlan.yearTitle")}
      />

      <View className="gap-3 border-t border-border pt-4">
        <View className="flex-row items-baseline justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text accessibilityRole="header" className="font-semibold">
              {t("futurePlan.whatIfTitle")}
            </Text>
            <Text variant="muted" className="text-xs">
              {t("futurePlan.whatIfLabel")}
            </Text>
          </View>
          <Text
            className={cn(
              "font-semibold tabular-nums",
              extra > 0 ? "text-primary" : "text-muted-foreground",
            )}
            style={{ fontSize: 17 }}
          >
            {t("futurePlan.whatIfPerMonth", { amount: whole(extra) })}
          </Text>
        </View>

        <ExtraSlider
          value={extra}
          max={EXTRA_MAX}
          step={EXTRA_STEP}
          onChange={onExtraChange}
          label={t("futurePlan.whatIfLabel")}
          valueText={t("futurePlan.whatIfPerMonth", { amount: whole(extra) })}
        />

        <View className="flex-row gap-2">
          {EXTRA_CHIPS.map((amount) => {
            const selected = extra === amount;
            return (
              <Pressable
                key={amount}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t("futurePlan.whatIfPerMonth", {
                  amount: whole(amount),
                })}
                onPress={() => {
                  void hapticSelection();
                  onExtraChange(selected ? 0 : amount);
                }}
                className={cn(
                  "min-h-12 flex-1 items-center justify-center rounded-full border",
                  selected
                    ? "border-foreground bg-foreground"
                    : "border-border",
                )}
              >
                <Text
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    selected ? "text-background" : "text-foreground",
                  )}
                >
                  {t("planPhone.chipExtra", { amount: whole(amount) })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-1">
          <Text variant="muted" className="text-sm">
            {extra > 0
              ? t("futurePlan.whatIfResult", { amount: whole(extra * 12) })
              : t("futurePlan.whatIfNone")}
          </Text>
          {soonerLine ? (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="sparkles" size={ICON.sm} color={colors.primary} />
              <Text className="shrink text-sm font-medium text-primary">
                {soonerLine}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PlanCard>
  );
}
