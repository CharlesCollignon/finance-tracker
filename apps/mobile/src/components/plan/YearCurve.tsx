import { useEffect, useMemo, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { EASE_STANDARD } from "@finance/core/motion";
import type { WhatIfPoint } from "@finance/core/future-plan";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { compactMonthOfKey } from "./format";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const EASING = Easing.bezier(...EASE_STANDARD);

const HEIGHT = 140;
const PAD_Y = 12;
const PAD_X = 8;
/** The web's balance curve timings, so a line arrives the same way. */
const DRAW_MS = 900;
const WASH_DELAY_MS = 200;

/**
 * The twelve months ahead, kept, as a line that draws itself in — with the
 * "what if" beside it as a dashed line when there is an extra to show.
 *
 * Everything else is under the finger: a touch or a drag reads the month out
 * above the curve, with a tick for each month crossed. The readout sits in
 * its own line rather than over the plot, so it never covers the line it is
 * reading.
 */
export function YearCurve({
  points,
  extra,
  money,
  label,
}: {
  points: WhatIfPoint[];
  extra: number;
  /** Already masked when amounts are hidden. */
  money: (value: number) => string;
  label: string;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const lastTick = useRef<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0 || width === 0) {
      return null;
    }
    const values = points.flatMap((point) =>
      extra > 0 ? [point.value, point.withExtra] : [point.value],
    );
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      max += 1;
      min -= 1;
    }
    const last = Math.max(1, points.length - 1);
    const x = (index: number) => PAD_X + (index / last) * (width - PAD_X * 2);
    const y = (value: number) =>
      PAD_Y + ((max - value) / (max - min)) * (HEIGHT - PAD_Y * 2);
    const line = (pick: (point: WhatIfPoint) => number) =>
      points
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`,
        )
        .join(" ");
    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      length += Math.hypot(
        x(index) - x(index - 1),
        y(points[index]!.value) - y(points[index - 1]!.value),
      );
    }
    const base = line((point) => point.value);
    return {
      x,
      y,
      base,
      length,
      extra: extra > 0 ? line((point) => point.withExtra) : "",
      area: `${base} L${x(points.length - 1).toFixed(1)},${HEIGHT} L${x(0).toFixed(1)},${HEIGHT} Z`,
    };
  }, [points, width, extra]);

  const draw = useSharedValue(reduce ? 1 : 0);
  const wash = useSharedValue(reduce ? 1 : 0);
  const ready = width > 0;
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (reduce) {
      draw.value = 1;
      wash.value = 1;
      return;
    }
    draw.value = withTiming(1, { duration: DRAW_MS, easing: EASING });
    wash.value = withDelay(
      WASH_DELAY_MS,
      withTiming(1, { duration: DRAW_MS, easing: EASING }),
    );
  }, [ready, reduce, draw, wash]);

  const length = geometry?.length ?? 0;
  const drawProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - draw.value),
  }));
  const washProps = useAnimatedProps(() => ({ opacity: wash.value }));

  function nearest(event: GestureResponderEvent): number {
    const ratio = (event.nativeEvent.locationX - PAD_X) / (width - PAD_X * 2);
    return Math.min(
      points.length - 1,
      Math.max(0, Math.round(ratio * (points.length - 1))),
    );
  }

  function scrub(event: GestureResponderEvent) {
    const index = nearest(event);
    if (lastTick.current !== index) {
      lastTick.current = index;
      void hapticSelection();
    }
    setActive(index);
  }

  function release() {
    lastTick.current = null;
    setActive(null);
  }

  const shown = active !== null ? points[active] : null;
  const first = points[0];
  const end = points[points.length - 1];

  return (
    <View className="gap-2">
      <Text
        variant={shown ? "body" : "muted"}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        className={shown ? "text-sm font-medium tabular-nums" : "text-xs"}
      >
        {shown
          ? `${t("futurePlan.scrubPoint", {
              month: shown.label,
              amount: money(shown.value),
            })}${
              extra > 0
                ? ` · ${t("futurePlan.scrubWithExtra", {
                    amount: money(shown.withExtra),
                  })}`
                : ""
            }`
          : t("futurePlan.scrubHint")}
      </Text>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          first && end
            ? `${label}. ${t("futurePlan.scrubPoint", {
                month: first.label,
                amount: money(first.value),
              })}, ${t("futurePlan.scrubPoint", {
                month: end.label,
                amount: money(end.value),
              })}`
            : label
        }
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        onResponderRelease={release}
        onResponderTerminate={release}
        style={{ height: HEIGHT }}
      >
        {geometry ? (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            <Defs>
              <LinearGradient id="year-wash" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={colors.primary}
                  stopOpacity={0.18}
                />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            <AnimatedG animatedProps={washProps}>
              <Path d={geometry.area} fill="url(#year-wash)" />
            </AnimatedG>

            {geometry.extra ? (
              <Path
                d={geometry.extra}
                fill="none"
                stroke={colors.foreground}
                strokeOpacity={0.75}
                strokeWidth={2}
                strokeDasharray="4 5"
                strokeLinecap="round"
              />
            ) : null}

            <AnimatedPath
              d={geometry.base}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={length > 0 ? [length, length] : undefined}
              animatedProps={drawProps}
            />

            {active !== null && shown ? (
              <G>
                <Line
                  x1={geometry.x(active)}
                  x2={geometry.x(active)}
                  y1={2}
                  y2={HEIGHT - 2}
                  stroke={colors.hairlineStrong}
                  strokeWidth={1}
                />
                {extra > 0 ? (
                  <Circle
                    cx={geometry.x(active)}
                    cy={geometry.y(shown.withExtra)}
                    r={5}
                    fill={colors.card}
                    stroke={colors.foreground}
                    strokeWidth={2}
                  />
                ) : null}
                <Circle
                  cx={geometry.x(active)}
                  cy={geometry.y(shown.value)}
                  r={6}
                  fill={colors.primary}
                  stroke={colors.card}
                  strokeWidth={2}
                />
              </G>
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View className="flex-row justify-between">
        <Text variant="micro">
          {first ? compactMonthOfKey(first.monthKey, locale) : ""}
        </Text>
        <Text variant="micro">
          {end ? compactMonthOfKey(end.monthKey, locale) : ""}
        </Text>
      </View>
    </View>
  );
}
