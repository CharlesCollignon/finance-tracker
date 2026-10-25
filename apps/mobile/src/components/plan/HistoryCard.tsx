import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Animated, { useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { formatPercentLabel } from "@finance/core/constants";
import {
  historyMonthLabel,
  trajectoryAccountKey,
} from "@finance/core/history/plan-figures";
import {
  CRASH_EPISODES,
  lossOdds,
  type CrashEpisodeId,
  type CrashTest,
} from "@finance/core/history/replay";
import type { Key } from "@finance/core/i18n/t";

import { FADE_IN } from "@/components/motion/fade";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { usePlanMoney } from "./format";
import { PlanCard, PlanCardHeader } from "./PlanCard";

const EPISODES = Object.keys(CRASH_EPISODES) as CrashEpisodeId[];
const FACT_KEYS: Record<CrashEpisodeId, Key> = {
  "2000": "trajectory.fact2000",
  "2008": "trajectory.fact2008",
  "2020": "trajectory.fact2020",
  "2022": "trajectory.fact2022",
};
/** Months shown after the peak: through the recovery, a year past it. */
const SHOWN_AFTER_RECOVERY = 12;
const SHOWN_MAX = 180;

/**
 * « Face à l'histoire », as the web tells it: today's investments put
 * through one of the great falls since 2000, from its peak, payments
 * carrying on — the worst month, in the euros of the day, and how long
 * until the money was worth what had gone in, with and without them.
 * Facts, said as such: nothing here says what to do about them.
 *
 * With nothing invested, it says what history does to savings instead: how
 * often the Livret A has paid less than prices rose.
 */
export function HistoryCard({
  crashes,
}: {
  /** One test per fall, or null with nothing invested. */
  crashes: Record<CrashEpisodeId, CrashTest> | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { shown } = usePlanMoney();
  const [episode, setEpisode] = useState<CrashEpisodeId>("2008");

  const livret = useMemo(
    () => (crashes ? null : lossOdds({ mix: { "livret-a": 1 } }, 1)),
    [crashes],
  );

  if (!crashes) {
    return (
      <PlanCard>
        <PlanCardHeader title={t("trajectory.historyTitle")} />
        <Text className="text-sm">
          {t("trajectory.noShares", {
            count: String(
              livret ? Math.round((livret.losses / livret.windows) * 100) : 0,
            ),
          })}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/investments" as Href)}
          className="min-h-11 justify-center self-start"
        >
          <Text className="text-sm font-medium text-primary">
            {t("trajectory.noSharesLink")}
          </Text>
        </Pressable>
      </PlanCard>
    );
  }

  const test = crashes[episode];
  const peak = CRASH_EPISODES[episode].peak;
  const shownMonths = Math.min(
    test.path.length,
    SHOWN_MAX,
    Math.max(
      24,
      (test.recoveredAfter ?? test.path.length) + SHOWN_AFTER_RECOVERY,
    ),
  );
  const fell = test.low.loss < 0;
  const alone =
    test.recoveredAfter !== null &&
    test.recoveredAfterAlone !== null &&
    test.recoveredAfterAlone !== test.recoveredAfter
      ? ` ${t("trajectory.recoveredAlone", { count: test.recoveredAfterAlone })}`
      : "";

  return (
    <PlanCard>
      <PlanCardHeader title={t("trajectory.historyTitle")} />
      <SegmentedControl
        label={t("trajectory.episodeLabel")}
        segments={EPISODES.map((id) => ({ value: id, label: id }))}
        value={episode}
        onChange={setEpisode}
      />

      <Text variant="muted" className="text-sm">
        {t(FACT_KEYS[episode])}
      </Text>

      <View className="gap-1">
        <Text variant="muted" className="text-xs">
          {t("trajectory.replayedFrom", {
            month: historyMonthLabel(peak, locale),
          })}
        </Text>
        {fell ? (
          <Text style={TYPE.figure}>
            {t("trajectory.lowLine", {
              loss: shown(test.low.loss),
              share: formatPercentLabel(
                Math.round(test.low.lossShare * 100),
                locale,
              ),
              month: historyMonthLabel(test.low.month, locale),
            })}
          </Text>
        ) : (
          <Text className="text-sm">{t("trajectory.neverBelow")}</Text>
        )}
        {fell ? (
          <Text className="text-sm">
            {test.recoveredAfter !== null
              ? t("trajectory.recovered", { count: test.recoveredAfter })
              : t("trajectory.notRecovered", {
                  month: historyMonthLabel(test.path.at(-1)!.month, locale),
                })}
            {alone}
          </Text>
        ) : null}
      </View>

      <CrashChart
        key={episode}
        test={test}
        months={shownMonths}
        valueLabel={t("trajectory.chartValue")}
        investedLabel={t("trajectory.chartInvested")}
      />

      {test.absent.length > 0 ? (
        <Text variant="muted" className="text-xs">
          {t("trajectory.absent", {
            names: test.absent
              .map((id) => t(trajectoryAccountKey(id)))
              .join(", "),
          })}
        </Text>
      ) : null}
    </PlanCard>
  );
}

const HEIGHT = 128;

/** What the accounts were worth against what had gone in, month by month. */
function CrashChart({
  test,
  months,
  valueLabel,
  investedLabel,
}: {
  test: CrashTest;
  months: number;
  valueLabel: string;
  investedLabel: string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);

  const start = test.path[0]!;
  const points = [
    { value: start.invested, invested: start.invested },
    ...test.path.slice(0, months),
  ];
  const all = points.flatMap((point) => [point.value, point.invested]);
  const low = Math.min(...all);
  const high = Math.max(...all);
  const span = high - low || 1;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => 8 + (1 - (value - low) / span) * (HEIGHT - 16);
  const line = (pick: (point: (typeof points)[number]) => number) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`,
      )
      .join(" ");

  return (
    <View className="gap-2">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${valueLabel}, ${investedLabel}`}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
      >
        {width > 0 ? (
          <Animated.View entering={reduce ? undefined : FADE_IN}>
            <Svg width={width} height={HEIGHT}>
              <Path
                d={line((point) => point.invested)}
                fill="none"
                stroke={colors.mutedForeground}
                strokeWidth={1.5}
                strokeDasharray="6 6"
              />
              <Path
                d={line((point) => point.value)}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-row items-center gap-1.5">
          <View
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
          <Text variant="micro">{valueLabel}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            className="w-4 border-t border-dashed"
            style={{ borderColor: colors.mutedForeground }}
          />
          <Text variant="micro">{investedLabel}</Text>
        </View>
      </View>
    </View>
  );
}
