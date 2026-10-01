import { useEffect, useMemo, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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

import { formatShortDate } from "@finance/core/constants";
import { EASE_STANDARD } from "@finance/core/motion";
import type { MonthBalancePoint } from "@finance/core/month-balance";

import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASING = Easing.bezier(...EASE_STANDARD);

/** The plot's height; its width is whatever the card gives it. */
const HEIGHT = 156;
/** Room above and below the line, so the end dot and a low point are not cut. */
const PAD_Y = 14;
/** Room at either side, so the dots at the month's edges stay round. */
const PAD_X = 6;

/*
 * The web's timings (`.balance-curve-*` in `apps/web/app/globals.css`), so
 * the same month arrives the same way on either client: the line draws in,
 * the wash rises behind it, the forecast and the end dot fade in after, and
 * today's dot breathes once everything has landed.
 */
const DRAW_MS = 900;
const WASH_DELAY_MS = 200;
const FADE_DELAY_MS = 700;
const FADE_MS = 500;
const TODAY_DELAY_MS = 800;
const TODAY_FADE_MS = 300;
const BREATHE_HALF_MS = 1200;

interface BalanceCurveProps {
  points: MonthBalancePoint[];
  /** Today, when it falls in the month: where the line stops being recorded. */
  today: string | null;
  format: (value: number) => string;
  /** What the line is, for the chart's accessible name. */
  label: string;
}

/**
 * The month's balance, one point a day: solid where it has happened, dashed
 * where it is only the charges' arithmetic — the web's `BalanceCurve`, drawn
 * with react-native-svg.
 *
 * A single series in the accent, because this is the figure the screen is
 * opened for, with two dots at most: today and the month's end. Everything
 * else is under the finger — a touch or a drag along the line reads the
 * nearest day out above it, and the chart's accessible name carries the
 * month's two ends for anyone not seeing it.
 */
export function BalanceCurve({
  points,
  today,
  format,
  label,
}: BalanceCurveProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const { hidden } = usePrivacy();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0 || width === 0) {
      return null;
    }
    const values = points.map((point) => point.value);
    let min = Math.min(...values, 0);
    let max = Math.max(...values, 0);
    // A flat month still needs a height to draw in.
    if (max - min < 1) {
      max += 1;
      min -= 1;
    }
    const last = Math.max(1, points.length - 1);
    const x = (index: number) => PAD_X + (index / last) * (width - PAD_X * 2);
    const y = (value: number) =>
      PAD_Y + ((max - value) / (max - min)) * (HEIGHT - PAD_Y * 2);

    const todayIndex = today
      ? points.findIndex((point) => point.date === today)
      : -1;
    const lastRecorded =
      todayIndex >= 0
        ? todayIndex
        : points.every((point) => point.planned)
          ? -1
          : points.length - 1;

    const path = (from: number, to: number) =>
      points
        .slice(from, to + 1)
        .map(
          (point, offset) =>
            `${offset === 0 ? "M" : "L"}${x(from + offset).toFixed(1)},${y(point.value).toFixed(1)}`,
        )
        .join(" ");

    // Straight segments only, so the length is exact — what the draw-in
    // dashes the line by, and more dependable than an animated clip.
    const lengthOf = (from: number, to: number) => {
      let total = 0;
      for (let index = from + 1; index <= to; index += 1) {
        total += Math.hypot(
          x(index) - x(index - 1),
          y(points[index]!.value) - y(points[index - 1]!.value),
        );
      }
      return total;
    };

    return {
      x,
      y,
      solid: lastRecorded >= 0 ? path(0, lastRecorded) : "",
      solidLength: lastRecorded > 0 ? lengthOf(0, lastRecorded) : 0,
      dashed:
        lastRecorded < points.length - 1
          ? path(Math.max(0, lastRecorded), points.length - 1)
          : "",
      area: `${path(0, points.length - 1)} L${x(points.length - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(1)},${y(min).toFixed(1)} Z`,
      zeroY: min < 0 && max > 0 ? y(0) : null,
      todayIndex,
    };
  }, [points, today, width]);

  /* ------------------------------------------------------------ motion */

  const draw = useSharedValue(reduce ? 1 : 0);
  const wash = useSharedValue(reduce ? 1 : 0);
  const fade = useSharedValue(reduce ? 1 : 0);
  const pulse = useSharedValue(reduce ? 1 : 0);

  // Once a measured width exists: before that there is nothing to draw in.
  const ready = width > 0;
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (reduce) {
      draw.value = 1;
      wash.value = 1;
      fade.value = 1;
      pulse.value = 1;
      return;
    }
    const timing = (duration: number) => ({ duration, easing: EASING });
    draw.value = withTiming(1, timing(DRAW_MS));
    wash.value = withDelay(WASH_DELAY_MS, withTiming(1, timing(DRAW_MS)));
    fade.value = withDelay(FADE_DELAY_MS, withTiming(1, timing(FADE_MS)));
    pulse.value = withSequence(
      withDelay(TODAY_DELAY_MS, withTiming(1, { duration: TODAY_FADE_MS })),
      withRepeat(
        withSequence(
          withTiming(0.55, {
            duration: BREATHE_HALF_MS,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: BREATHE_HALF_MS,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
      ),
    );
  }, [ready, reduce, draw, wash, fade, pulse]);

  const solidLength = geometry?.solidLength ?? 0;
  const drawProps = useAnimatedProps(() => ({
    strokeDashoffset: solidLength * (1 - draw.value),
  }));
  const washProps = useAnimatedProps(() => ({ opacity: wash.value }));
  const fadeProps = useAnimatedProps(() => ({ opacity: fade.value }));
  const todayProps = useAnimatedProps(() => ({ opacity: pulse.value }));

  /* ------------------------------------------------------------ touch */

  function nearest(event: GestureResponderEvent): number {
    const ratio = (event.nativeEvent.locationX - PAD_X) / (width - PAD_X * 2);
    return Math.min(
      points.length - 1,
      Math.max(0, Math.round(ratio * (points.length - 1))),
    );
  }

  const lastIndex = points.length - 1;
  const endPoint = points[lastIndex];
  const firstPoint = points[0];
  const shown = active !== null ? points[active] : null;

  const summary =
    !hidden && firstPoint && endPoint
      ? `${label}. ${formatShortDate(firstPoint.date, locale)} ${format(firstPoint.value)}, ${formatShortDate(endPoint.date, locale)} ${format(endPoint.value)}`
      : label;

  return (
    <View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => setActive(nearest(event))}
        onResponderMove={(event) => setActive(nearest(event))}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
        style={{ height: HEIGHT }}
      >
        {geometry ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="balance-wash" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={colors.primary}
                  stopOpacity={0.16}
                />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {geometry.zeroY !== null ? (
              <Line
                x1={0}
                x2={width}
                y1={geometry.zeroY}
                y2={geometry.zeroY}
                stroke={colors.hairlineStrong}
                strokeWidth={1}
              />
            ) : null}

            <AnimatedG animatedProps={washProps}>
              <Path d={geometry.area} fill="url(#balance-wash)" />
            </AnimatedG>

            {geometry.solid ? (
              <AnimatedPath
                d={geometry.solid}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                // A dash as long as the line, slid along it: the line draws
                // itself from the first of the month to today.
                strokeDasharray={
                  solidLength > 0 ? [solidLength, solidLength] : undefined
                }
                animatedProps={drawProps}
              />
            ) : null}

            <AnimatedG animatedProps={fadeProps}>
              {geometry.dashed ? (
                <Path
                  d={geometry.dashed}
                  fill="none"
                  stroke={colors.primary}
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                />
              ) : null}
              {endPoint && lastIndex !== geometry.todayIndex ? (
                <Circle
                  cx={geometry.x(lastIndex)}
                  cy={geometry.y(endPoint.value)}
                  r={5}
                  fill={endPoint.planned ? colors.card : colors.primary}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              ) : null}
            </AnimatedG>

            {/* Today: a ring of the card behind it, so it reads over the line. */}
            {geometry.todayIndex >= 0 ? (
              <AnimatedCircle
                cx={geometry.x(geometry.todayIndex)}
                cy={geometry.y(points[geometry.todayIndex]!.value)}
                r={6}
                fill={colors.primary}
                stroke={colors.card}
                strokeWidth={2}
                animatedProps={todayProps}
              />
            ) : null}

            {active !== null && shown ? (
              <G>
                <Line
                  x1={geometry.x(active)}
                  x2={geometry.x(active)}
                  y1={4}
                  y2={HEIGHT - 4}
                  stroke={colors.hairlineStrong}
                  strokeWidth={1}
                />
                <Circle
                  cx={geometry.x(active)}
                  cy={geometry.y(shown.value)}
                  r={6}
                  fill={colors.foreground}
                  stroke={colors.card}
                  strokeWidth={2}
                />
              </G>
            ) : null}
          </Svg>
        ) : null}

        {geometry && active !== null && shown ? (
          <Readout
            left={geometry.x(active)}
            width={width}
            value={hidden ? "••••••" : format(shown.value)}
            date={`${formatShortDate(shown.date, locale)}${
              shown.planned ? ` · ${t("ledger.planned")}` : ""
            }`}
          />
        ) : null}
      </View>

      <View className="mt-2 flex-row items-center justify-between gap-3">
        <Text variant="muted" className="text-xs">
          {firstPoint ? formatShortDate(firstPoint.date, locale) : ""}
        </Text>
        <View className="flex-row items-center gap-3">
          {points.some((point) => !point.planned) ? (
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />
              <Text variant="muted" className="text-xs">
                {t("bearingMonth.recorded")}
              </Text>
            </View>
          ) : null}
          {points.some((point) => point.planned) ? (
            <View className="flex-row items-center gap-1.5">
              <View className="w-4 flex-row justify-between">
                <View
                  className="h-0.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colors.primary, opacity: 0.7 }}
                />
                <View
                  className="h-0.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colors.primary, opacity: 0.7 }}
                />
              </View>
              <Text variant="muted" className="text-xs">
                {t("ledger.planned")}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="muted" className="text-xs">
          {endPoint ? formatShortDate(endPoint.date, locale) : ""}
        </Text>
      </View>
    </View>
  );
}

/** The day under the finger, kept inside the card at either edge. */
function Readout({
  left,
  width,
  value,
  date,
}: {
  left: number;
  width: number;
  value: string;
  date: string;
}) {
  const BOX = 132;
  const x = Math.min(Math.max(0, left - BOX / 2), Math.max(0, width - BOX));
  return (
    <View
      pointerEvents="none"
      className="absolute top-0 rounded-control border border-border bg-secondary px-2.5 py-1.5"
      style={{ left: x, width: BOX }}
    >
      <Text numberOfLines={1} className="text-sm font-semibold tabular-nums">
        {value}
      </Text>
      <Text variant="muted" numberOfLines={1} className="text-xs">
        {date}
      </Text>
    </View>
  );
}
