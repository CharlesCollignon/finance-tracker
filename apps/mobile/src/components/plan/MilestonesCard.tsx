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
  ZoomIn,
} from "react-native-reanimated";

import { EASE_STANDARD } from "@finance/core/motion";
import { MILESTONE_TIERS, type Milestone } from "@finance/core/future-plan";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { monthAheadLabel, usePlanMoney } from "./format";
import { Glow } from "./Glow";
import { PlanCard, PlanCardHeader } from "./PlanCard";

const EASING = Easing.bezier(...EASE_STANDARD);

/**
 * The round amounts on the way: the last two passed, as badges that pop in
 * with the orb's light behind them, and the next three, with when the
 * projection crosses each and how far along the way there is.
 *
 * A milestone passed since the last visit says so — the one moment on the
 * screen that celebrates, and the reason to come back and look.
 */
export function MilestonesCard({
  milestones,
  current,
  freshAmount,
  year,
  month,
  horizonYears,
}: {
  milestones: Milestone[];
  /** What the accounts hold today. */
  current: number;
  /** A milestone passed since the last visit, if one was. */
  freshAmount: number | null;
  year: number;
  month: number;
  /** How far ahead the projection looks, for "beyond N years". */
  horizonYears: number;
}) {
  const t = useT();
  const locale = useLocale();
  const reached = milestones.filter((milestone) => milestone.reached);
  const ahead = milestones.filter((milestone) => !milestone.reached);

  return (
    <PlanCard>
      <PlanCardHeader
        title={t("futurePlan.milestonesTitle")}
        subtitle={t("futurePlan.milestonesBasis")}
      />

      {reached.length > 0 ? (
        <View className="flex-row gap-3">
          {reached.map((milestone, index) => (
            <Badge
              key={milestone.amount}
              amount={milestone.amount}
              index={index}
              fresh={milestone.amount === freshAmount}
            />
          ))}
        </View>
      ) : null}

      <View className="gap-4">
        {ahead.map((milestone, index) => {
          const tier = MILESTONE_TIERS.indexOf(milestone.amount);
          const previous = tier > 0 ? MILESTONE_TIERS[tier - 1]! : 0;
          const progress = Math.min(
            1,
            Math.max(0, (current - previous) / (milestone.amount - previous)),
          );
          const away = milestone.monthsAway;
          const when =
            away === null
              ? t("futurePlan.milestoneBeyond", { count: horizonYears })
              : away < 24
                ? t("futurePlan.milestoneIn", { count: away })
                : t("futurePlan.inYears", { count: Math.round(away / 12) });
          return (
            <AheadRow
              key={milestone.amount}
              amount={milestone.amount}
              when={when}
              on={
                away === null
                  ? null
                  : t("futurePlan.milestoneOn", {
                      month: monthAheadLabel(year, month, away, locale),
                    })
              }
              progress={progress}
              index={index}
            />
          );
        })}
      </View>
    </PlanCard>
  );
}

function Badge({
  amount,
  index,
  fresh,
}: {
  amount: number;
  index: number;
  fresh: boolean;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const { whole } = usePlanMoney();

  return (
    <Animated.View
      entering={
        reduce
          ? undefined
          : ZoomIn.springify()
              .damping(11)
              .stiffness(160)
              .delay(120 + index * 110)
      }
      className="relative min-h-24 flex-1 items-center justify-center gap-1 overflow-hidden rounded-card border border-primary/30 bg-accent/60 px-3 py-3"
    >
      <Glow size={150} strength={fresh ? 1 : 0.6} />
      <Ionicons name="trophy" size={ICON.xl} color={colors.primary} />
      <PrivateAmount className="text-base font-semibold">
        {whole(amount)}
      </PrivateAmount>
      <Text
        className={
          fresh
            ? "text-xs font-semibold text-primary"
            : "text-xs text-muted-foreground"
        }
      >
        {fresh
          ? t("futurePlan.milestoneNew")
          : t("futurePlan.milestoneReached")}
      </Text>
    </Animated.View>
  );
}

function AheadRow({
  amount,
  when,
  on,
  progress,
  index,
}: {
  amount: number;
  when: string;
  on: string | null;
  progress: number;
  index: number;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const { whole } = usePlanMoney();
  const fill = useSharedValue(reduce ? progress : 0);

  useEffect(() => {
    fill.value = reduce
      ? progress
      : withDelay(
          200 + index * 90,
          withTiming(progress, { duration: 700, easing: EASING }),
        );
  }, [progress, index, reduce, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(2, fill.value * 100)}%`,
  }));

  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline justify-between gap-3">
        <PrivateAmount className="text-base font-semibold">
          {whole(amount)}
        </PrivateAmount>
        <View className="shrink items-end">
          <Text className="text-sm font-medium">{when}</Text>
          {on ? (
            <Text variant="muted" className="text-xs">
              {on}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        className="h-1.5 overflow-hidden rounded-full"
        style={{ backgroundColor: colors.muted }}
      >
        <Animated.View
          className="h-1.5 rounded-full"
          style={[
            { backgroundColor: colors.foreground, opacity: 0.7 },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}
