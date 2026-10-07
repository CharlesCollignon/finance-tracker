import { useEffect } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type {
  CloseableMonth,
  CloseHistorySummary,
} from "@finance/core/month-close";

import { CLOSE_WAIT_REASON_KEYS } from "@finance/core/bank-balance";
import {
  formatShortDate,
  lastDayIsoOfMonth,
} from "@finance/core/constants";
import type { CloseWaitAccount } from "@finance/data/bank-balance";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { Glow } from "./Glow";
import { PlanCard } from "./PlanCard";

/**
 * The run of month-ends kept inside the allowance, as a flame that flickers
 * while it is alive — and the close that keeps it going, one press away.
 */
export function RunCard({
  summary,
  next,
  closeWait = [],
  onOpen,
}: {
  summary: CloseHistorySummary;
  /** The month waiting to be closed, if one is. */
  next: CloseableMonth | null;
  /** The accounts it waits on, when the bank should close it. */
  closeWait?: CloseWaitAccount[];
  onOpen: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const alive = summary.streak > 0;

  const prompt = next
    ? next.isBaseline
      ? t("monthClose.setStartingBalance")
      : alive
        ? t("futurePlan.runKeep", { month: next.label })
        : t("month.attentionReadyToClose", { month: next.label })
    : null;

  return (
    <PlanCard>
      <View className="flex-row items-center gap-4">
        <View className="relative h-16 w-16 items-center justify-center">
          {alive ? <Glow size={150} /> : null}
          <View
            className="h-14 w-14 items-center justify-center rounded-full border"
            style={{
              borderColor: alive ? colors.primary : colors.hairlineStrong,
              backgroundColor: alive ? colors.accent : colors.muted,
            }}
          >
            <Flame alive={alive} />
          </View>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="muted" className="text-xs">
            {t("futurePlan.runTitle")}
          </Text>
          {alive ? (
            <Text
              accessibilityRole="header"
              className="font-semibold"
              style={{ fontSize: 20 }}
            >
              {t("futurePlan.runCount", { count: summary.streak })}
            </Text>
          ) : (
            <Text className="text-sm">{t("futurePlan.runStart")}</Text>
          )}
          {summary.bestStreak > 0 ? (
            <Text variant="muted" className="text-sm">
              {t("futurePlan.runRecord", { count: summary.bestStreak })}
            </Text>
          ) : null}
        </View>
      </View>

      {prompt ? (
        <View className="gap-3 rounded-control border border-border p-3">
          <Text className="text-sm">{prompt}</Text>
          {/* Why the bank has not closed it: named, so the fix — renewing
              one bank's consent, as a rule — is obvious. */}
          {next && closeWait.length > 0 ? (
            <View className="gap-1">
              <Text variant="muted" className="text-sm">
                {t("monthClose.waitBody", {
                  month: next.label,
                  date: formatShortDate(
                    lastDayIsoOfMonth(next.year, next.month),
                    locale,
                  ),
                })}
              </Text>
              {closeWait.map((account) => (
                <Text key={account.name} variant="muted" className="text-sm">
                  <Text className="text-sm">{account.name}</Text>
                  {" · "}
                  {t(CLOSE_WAIT_REASON_KEYS[account.reason])}
                </Text>
              ))}
            </View>
          ) : null}
          <Button
            label={t("monthClose.closeTheMonth")}
            variant="pill"
            icon="arrow-forward"
            className="self-start"
            onPress={onOpen}
          />
        </View>
      ) : null}
    </PlanCard>
  );
}

/** A flame that flickers: an uneven swell and a slow sway, never in step. */
function Flame({ alive }: { alive: boolean }) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const flicker = useSharedValue(1);
  const sway = useSharedValue(0.5);

  useEffect(() => {
    if (reduce || !alive) {
      flicker.value = 1;
      sway.value = 0.5;
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    flicker.value = withRepeat(
      withSequence(
        withTiming(1.09, { duration: 360, easing: ease }),
        withTiming(0.95, { duration: 290, easing: ease }),
        withTiming(1.05, { duration: 430, easing: ease }),
        withTiming(0.98, { duration: 260, easing: ease }),
        withTiming(1, { duration: 380, easing: ease }),
      ),
      -1,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: 1_700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [alive, reduce, flicker, sway]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - flicker.value) * 6 },
      { scale: flicker.value },
      { rotate: `${(sway.value - 0.5) * 7}deg` },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons
        name="flame"
        size={ICON.hero}
        color={alive ? colors.primary : colors.mutedForeground}
      />
    </Animated.View>
  );
}
