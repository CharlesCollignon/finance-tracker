import { useMemo, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { niceTicks } from "@finance/core/year-ahead";

import { FADE_IN } from "@/components/motion/fade";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

const HEIGHT = 184;
const PAD_Y = 10;

/**
 * The trajectory: the middle start as one line inside the band eight starts
 * in ten end in, today at the left — the web's chart. Two to four round
 * amounts as gridlines keep the scale honest; a finger along it reads a
 * month out, handed up as an index (0 is today), with a tick each year it
 * crosses.
 *
 * It fades in when it arrives — the parent keys it by horizon, so a new
 * horizon fades the new chart in rather than morphing — and otherwise holds
 * still.
 */
export function TrajectoryChart({
  low,
  middle,
  high,
  active,
  onActive,
  label,
  format,
}: {
  /** Month by month from today, the same length each. */
  low: readonly number[];
  middle: readonly number[];
  high: readonly number[];
  active: number | null;
  onActive: (index: number | null) => void;
  /** What the chart is, with where it ends, for a screen reader. */
  label: string;
  /** An amount as a gridline says it; masked when amounts are hidden. */
  format: (value: number) => string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const lastYear = useRef<number | null>(null);
  const last = middle.length - 1;

  const geometry = useMemo(() => {
    if (width === 0 || last < 1) {
      return null;
    }
    const lowest = Math.min(...low, ...middle);
    const highest = Math.max(...high, ...middle);
    const span = highest - lowest || 1;
    const floor = lowest - span * 0.05;
    const ceiling = highest + span * 0.05;
    const x = (index: number) => (index / last) * width;
    const y = (value: number) =>
      PAD_Y + (1 - (value - floor) / (ceiling - floor)) * (HEIGHT - 2 * PAD_Y);
    const line = (values: readonly number[]) =>
      values
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
        )
        .join(" ");
    const band = `${line(high)} ${[...low]
      .reverse()
      .map(
        (value, index) =>
          `L${x(last - index).toFixed(1)},${y(value).toFixed(1)}`,
      )
      .join(" ")} Z`;
    return {
      x,
      y,
      band,
      middle: line(middle),
      ticks: niceTicks(lowest, highest),
    };
  }, [width, last, low, middle, high]);

  function scrub(event: GestureResponderEvent) {
    if (width === 0) {
      return;
    }
    const share = Math.min(
      1,
      Math.max(0, event.nativeEvent.locationX / width),
    );
    const index = Math.round(share * last);
    const year = Math.floor(index / 12);
    if (lastYear.current !== year) {
      lastYear.current = year;
      void hapticSelection();
    }
    onActive(index);
  }

  function release() {
    lastYear.current = null;
    onActive(null);
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={scrub}
      onResponderMove={scrub}
      onResponderRelease={release}
      onResponderTerminate={release}
      style={{ height: HEIGHT }}
    >
      {geometry ? (
        <Animated.View
          pointerEvents="none"
          entering={reduce ? undefined : FADE_IN}
          style={{ height: HEIGHT }}
        >
          {geometry.ticks.map((tick) => (
            <View
              key={tick}
              className="absolute inset-x-0 flex-row items-center gap-2"
              style={{ top: geometry.y(tick) - 7 }}
            >
              <Text variant="micro" className="tabular-nums">
                {format(tick)}
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: colors.hairlineStrong }}
              />
            </View>
          ))}
          <Svg
            width={width}
            height={HEIGHT}
            style={{ position: "absolute", left: 0, top: 0 }}
          >
            <Path d={geometry.band} fill={colors.primary} fillOpacity={0.16} />
            <Path
              d={geometry.middle}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {active !== null ? (
              <>
                <Line
                  x1={geometry.x(active)}
                  x2={geometry.x(active)}
                  y1={0}
                  y2={HEIGHT}
                  stroke={colors.foreground}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
                <Circle
                  cx={geometry.x(active)}
                  cy={geometry.y(middle[active] ?? 0)}
                  r={5}
                  fill={colors.primary}
                  stroke={colors.card}
                  strokeWidth={2}
                />
              </>
            ) : null}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
