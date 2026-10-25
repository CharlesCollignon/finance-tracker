import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import Animated, { useReducedMotion, ZoomIn } from "react-native-reanimated";

import {
  CUSHION_TARGETS,
  type Cushion,
  type Milestone,
} from "@finance/core/future-plan";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import { DURATION } from "@finance/core/motion";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { monthAheadLabel, usePlanMoney } from "./format";
import { PlanCard, PlanCardHeader } from "./PlanCard";

/**
 * « Progression », as on the web: the milestones, the cushion and the run in
 * one card — what the reader has done, said back, never a score.
 *
 * The next milestone has a date, from the middle start of the replay on the
 * reader's own figures, and « Et si… » moves it. A milestone crossed since
 * the last visit pops once, on whichever device sees it first. The run is
 * told here and kept on Le point, where the month is closed.
 */
export function ProgressionCard({
  milestones,
  withExtra,
  wealth,
  cushion,
  run,
  fresh,
  year,
  month,
}: {
  milestones: readonly Milestone[];
  /** Months away with « Et si… », by amount; null without it. */
  withExtra: Map<number, number | null> | null;
  /** Savings and investments today. */
  wealth: number;
  cushion: Cushion;
  run: { streak: number; best: number } | null;
  /** A milestone passed since the last visit, if one was. */
  fresh: number | null;
  year: number;
  month: number;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const router = useRouter();
  const { whole, shown } = usePlanMoney();

  const reached = milestones.filter((each) => each.reached);
  const next = milestones.find((each) => !each.reached) ?? null;
  const progress = next ? Math.min(1, wealth / next.amount) : 0;

  const sooner = (() => {
    if (!next || !withExtra) {
      return null;
    }
    const after = withExtra.get(next.amount) ?? null;
    if (after === null) {
      return null;
    }
    if (next.monthsAway === null) {
      return t("futurePlan.whatIfNowReached", {
        milestone: shown(next.amount),
        month: monthAheadLabel(year, month, after, locale),
      });
    }
    return after < next.monthsAway
      ? t("futurePlan.whatIfSooner", {
          milestone: shown(next.amount),
          count: next.monthsAway - after,
        })
      : null;
  })();

  const months = (count: number) => t("futurePlan.cushionMonths", { count });
  const last = CUSHION_TARGETS[CUSHION_TARGETS.length - 1]!;
  const lit = run !== null && run.streak > 0;

  return (
    <PlanCard>
      <PlanCardHeader title={t("trajectory.progressionTitle")} />

      {reached.length > 0 ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="muted" className="text-xs">
            {t("trajectory.milestonesReached")}
          </Text>
          {reached.map((each) => (
            <Animated.View
              key={each.amount}
              entering={
                each.amount === fresh && !reduce
                  ? ZoomIn.duration(DURATION.enter)
                  : undefined
              }
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: colors.primary }}
            >
              <PrivateAmount
                className="text-xs font-semibold"
                style={{ color: colors.primaryForeground }}
              >
                {whole(each.amount)}
              </PrivateAmount>
            </Animated.View>
          ))}
          {fresh !== null ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="sparkles" size={ICON.sm} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary">
                {t("futurePlan.milestoneNew")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {next ? (
        <View className="gap-2">
          <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
            <Text className="text-sm font-medium">
              {t("trajectory.nextMilestone", { amount: shown(next.amount) })}
            </Text>
            <Text variant="muted" className="text-xs">
              {next.monthsAway === null
                ? t("futurePlan.milestoneBeyond", { count: 30 })
                : t("trajectory.milestoneWhen", {
                    month: monthAheadLabel(
                      year,
                      month,
                      next.monthsAway,
                      locale,
                    ),
                  })}
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t("trajectory.nextMilestone", {
              amount: shown(next.amount),
            })}
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(progress * 100),
            }}
            className="h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: colors.muted }}
          >
            <View
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(2, progress * 100)}%`,
                backgroundColor: colors.foreground,
                opacity: 0.6,
              }}
            />
          </View>
          {sooner ? (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="sparkles" size={ICON.sm} color={colors.primary} />
              <Text className="shrink text-sm font-medium text-primary">
                {sooner}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="gap-2 border-t border-border pt-3">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="text-sm font-medium">
            {t("trajectory.cushionLabel")}
          </Text>
          {cushion.months !== null ? (
            <PrivateAmount className="text-sm">
              {`${new Intl.NumberFormat(INTL_LOCALES[locale], {
                maximumFractionDigits: 1,
              }).format(Math.floor(cushion.months * 10) / 10)} / ${months(last)}`}
            </PrivateAmount>
          ) : null}
        </View>
        {cushion.months === null ? (
          <Text variant="muted" className="text-xs">
            {t("futurePlan.cushionNoFixed")}
          </Text>
        ) : (
          <>
            <View className="flex-row gap-1.5">
              {CUSHION_TARGETS.map((target, index) => (
                <View
                  key={target}
                  className="h-1.5 flex-1 rounded-full"
                  style={{
                    backgroundColor:
                      cushion.level > index ? colors.primary : colors.muted,
                  }}
                />
              ))}
            </View>
            <Text variant="muted" className="text-xs">
              {cushion.nextTarget === null
                ? t("futurePlan.cushionFull")
                : t("futurePlan.cushionNext", {
                    months: months(cushion.nextTarget),
                  })}
            </Text>
          </>
        )}
      </View>

      <View className="gap-1 border-t border-border pt-3">
        <View className="flex-row items-center gap-2">
          <Ionicons
            name={lit ? "flame" : "flame-outline"}
            size={ICON.md}
            color={lit ? colors.primary : colors.mutedForeground}
          />
          <Text className="shrink text-sm">
            {lit
              ? t("bearingMonth.run", { count: run.streak })
              : t("bearingMonth.noRunYet")}
            {run && run.best > run.streak ? (
              <Text variant="muted" className="text-sm">
                {" · "}
                {t("bearingMonth.bestRun", { count: run.best })}
              </Text>
            ) : null}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/" as Href)}
          className="min-h-11 flex-row items-center gap-1 self-start"
        >
          <Text className="text-sm font-medium text-primary">
            {t("trajectory.runLink")}
          </Text>
          <Ionicons name="arrow-forward" size={ICON.sm} color={colors.primary} />
        </Pressable>
      </View>
    </PlanCard>
  );
}
