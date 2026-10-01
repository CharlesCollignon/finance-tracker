import { useEffect, useMemo, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

import type { EnvelopeYear } from "@finance/core/future-plan";
import { EASE_STANDARD } from "@finance/core/motion";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { CHART_COLORS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const HEIGHT = 168;
const PAD_TOP = 10;
const PAD_X = 4;
const GROW_MS = 900;
const EASING = Easing.bezier(...EASE_STANDARD);

/** Bottom to top: what is there, what goes in, what it earns after tax. */
export const LAYER_COLORS = {
  initial: CHART_COLORS[4],
  contributions: CHART_COLORS[3],
  gains: CHART_COLORS[0],
} as const;

/** "Aujourd'hui" or "dans 12 ans". */
export function yearLabel(year: number, t: ReturnType<typeof useT>): string {
  return year === 0
    ? t("futurePlan.today")
    : t("futurePlan.inYears", { count: year });
}

/**
 * The long view as three stacked layers, a year at a time — the shape a
 * compound-interest calculator draws, so the gains taking over from the
 * payments is the thing the eye lands on. It grows up out of its baseline
 * on arrival, and a finger along it reads each year out above it.
 */
export function YearsChart({
  years,
  money,
  label,
  onActiveChange,
}: {
  years: EnvelopeYear[];
  /** Already masked when amounts are hidden. */
  money: (value: number) => string;
  label: string;
  /** The year under the finger, or null once it lifts. */
  onActiveChange?: (index: number | null) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const lastTick = useRef<number | null>(null);

  const geometry = useMemo(() => {
    if (years.length < 2 || width === 0) {
      return null;
    }
    const top = (row: EnvelopeYear) =>
      row.initial + row.contributions + Math.max(0, row.netGains);
    const max = Math.max(1, ...years.map(top));
    const last = years.length - 1;
    const x = (index: number) => PAD_X + (index / last) * (width - PAD_X * 2);
    const y = (value: number) =>
      PAD_TOP + (1 - value / max) * (HEIGHT - PAD_TOP);

    const band = (
      lower: (row: EnvelopeYear) => number,
      upper: (row: EnvelopeYear) => number,
    ) => {
      const up = years
        .map(
          (row, index) =>
            `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(upper(row)).toFixed(1)}`,
        )
        .join(" ");
      const down = years
        .map((row, index) => ({ row, index }))
        .reverse()
        .map(
          ({ row, index }) =>
            `L${x(index).toFixed(1)},${y(lower(row)).toFixed(1)}`,
        )
        .join(" ");
      return `${up} ${down} Z`;
    };

    return {
      x,
      y,
      top,
      initial: band(
        () => 0,
        (row) => row.initial,
      ),
      contributions: band(
        (row) => row.initial,
        (row) => row.initial + row.contributions,
      ),
      gains: band(
        (row) => row.initial + row.contributions,
        (row) => top(row),
      ),
    };
  }, [years, width]);

  const grow = useSharedValue(reduce ? 1 : 0);
  const ready = width > 0;
  useEffect(() => {
    if (!ready) {
      return;
    }
    grow.value = reduce
      ? 1
      : withTiming(1, { duration: GROW_MS, easing: EASING });
  }, [ready, reduce, grow]);

  // Scaled from the baseline rather than the middle.
  const growStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: ((1 - grow.value) * HEIGHT) / 2 },
      { scaleY: Math.max(0.001, grow.value) },
    ],
  }));

  function scrub(event: GestureResponderEvent) {
    const ratio = (event.nativeEvent.locationX - PAD_X) / (width - PAD_X * 2);
    const index = Math.min(
      years.length - 1,
      Math.max(0, Math.round(ratio * (years.length - 1))),
    );
    if (lastTick.current !== index) {
      lastTick.current = index;
      void hapticSelection();
      onActiveChange?.(index);
    }
    setActive(index);
  }

  function release() {
    lastTick.current = null;
    setActive(null);
    onActiveChange?.(null);
  }

  const shown = active !== null ? years[active] : null;
  const end = years[years.length - 1];

  return (
    <View className="gap-2">
      <Text
        variant={shown ? "body" : "muted"}
        numberOfLines={1}
        className={shown ? "text-sm font-medium tabular-nums" : "text-xs"}
      >
        {shown
          ? t("futurePlan.scrubPoint", {
              month: yearLabel(shown.year, t),
              amount: money(shown.netValue),
            })
          : t("planPhone.scrubYears")}
      </Text>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          end
            ? `${label}. ${t("futurePlan.scrubPoint", {
                month: yearLabel(end.year, t),
                amount: money(end.netValue),
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
          <Animated.View pointerEvents="none" style={growStyle}>
            <Svg width={width} height={HEIGHT}>
              <Path
                d={geometry.initial}
                fill={LAYER_COLORS.initial}
                fillOpacity={0.55}
              />
              <Path
                d={geometry.contributions}
                fill={LAYER_COLORS.contributions}
                fillOpacity={0.6}
              />
              <Path
                d={geometry.gains}
                fill={LAYER_COLORS.gains}
                fillOpacity={0.75}
              />
              <Line
                x1={0}
                x2={width}
                y1={HEIGHT - 0.5}
                y2={HEIGHT - 0.5}
                stroke={colors.hairlineStrong}
                strokeWidth={1}
              />
              {active !== null && shown ? (
                <>
                  <Line
                    x1={geometry.x(active)}
                    x2={geometry.x(active)}
                    y1={0}
                    y2={HEIGHT}
                    stroke={colors.foreground}
                    strokeOpacity={0.5}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={geometry.x(active)}
                    cy={geometry.y(geometry.top(shown))}
                    r={5}
                    fill={colors.foreground}
                    stroke={colors.card}
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </Svg>
          </Animated.View>
        ) : null}
      </View>

      <View className="flex-row justify-between">
        <Text variant="micro">{t("futurePlan.today")}</Text>
        <Text variant="micro">{end ? yearLabel(end.year, t) : ""}</Text>
      </View>
    </View>
  );
}
