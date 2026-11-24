import { useMemo, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { niceTicks } from "@finance/core/year-ahead";

import { FADE_IN } from "@/components/motion/fade";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

const HEIGHT = 168;
const PAD_Y = 10;
/** The scale's own gutter, so no amount sits on the line. */
const GUTTER = 62;
/** Room for the dot at the right edge. */
const EDGE = 7;

/**
 * A dated run with its scale — the web's `HistoryLine`: one line over a
 * faint wash, two to four round amounts as gridlines, and a point read out
 * under a finger, handed up as an index so the parent says what that point
 * is in its own words.
 *
 * An optional mark stands at the right edge for a figure that belongs
 * beside the line without being on it. It is hollow, so it is never read as
 * the line's own end.
 */
export function HistoryLine({
  values,
  mark = null,
  active,
  onActive,
  label,
  format,
}: {
  /** Oldest first. Fewer than two draws nothing. */
  values: readonly number[];
  /** A figure to stand at the right edge, apart from the line. */
  mark?: number | null;
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
  const lastIndex = useRef<number | null>(null);
  const last = values.length - 1;
  const plot = Math.max(0, width - GUTTER - EDGE);

  const geometry = useMemo(() => {
    if (plot === 0 || last < 1) {
      return null;
    }
    const all = mark === null ? values : [...values, mark];
    const lowest = Math.min(...all);
    const highest = Math.max(...all);
    const span = highest - lowest || Math.max(1, highest * 0.02);
    const floor = lowest - span * 0.12;
    const ceiling = highest + span * 0.12;
    const x = (index: number) => GUTTER + (index / last) * plot;
    const y = (value: number) =>
      PAD_Y + (1 - (value - floor) / (ceiling - floor)) * (HEIGHT - 2 * PAD_Y);
    const line = values
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
      )
      .join(" ");
    return {
      x,
      y,
      line,
      wash: `${line} L${x(last).toFixed(1)},${HEIGHT} L${GUTTER},${HEIGHT} Z`,
      ticks: niceTicks(floor, ceiling),
    };
  }, [plot, last, values, mark]);

  function scrub(event: GestureResponderEvent) {
    if (plot === 0 || last < 1) {
      return;
    }
    const share = Math.min(
      1,
      Math.max(0, (event.nativeEvent.locationX - GUTTER) / plot),
    );
    const index = Math.round(share * last);
    if (lastIndex.current !== index) {
      lastIndex.current = index;
      void hapticSelection();
    }
    onActive(index);
  }

  function release() {
    lastIndex.current = null;
    onActive(null);
  }

  const shown = active ?? last;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // A vertical swipe that starts on the chart still scrolls the screen:
      // the scroll view may take the finger back.
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
              className="absolute inset-x-0 flex-row items-center"
              style={{ top: geometry.y(tick) - 7 }}
            >
              <Text variant="micro" className="tabular-nums" style={{ width: GUTTER }}>
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
            <Defs>
              <LinearGradient id="history-wash" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.18} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geometry.wash} fill="url(#history-wash)" />
            <Path
              d={geometry.line}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {active !== null ? (
              <Line
                x1={geometry.x(active)}
                x2={geometry.x(active)}
                y1={0}
                y2={HEIGHT}
                stroke={colors.foreground}
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            ) : null}
            {/* The line's own end, so the eye lands on today rather than the peak. */}
            <Circle
              cx={geometry.x(shown)}
              cy={geometry.y(values[shown] ?? 0)}
              r={5}
              fill={colors.primary}
              stroke={colors.card}
              strokeWidth={2}
            />
            {mark !== null ? (
              <Circle
                cx={geometry.x(last)}
                cy={geometry.y(mark)}
                r={5}
                fill={colors.card}
                stroke={colors.primary}
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
