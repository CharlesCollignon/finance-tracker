import { useEffect, useMemo, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Path } from "react-native-svg";

import { EASE_STANDARD } from "@finance/core/motion";
import {
  niceTicks,
  resampleSeries,
  type YearAhead,
  type YearAheadEvent,
} from "@finance/core/year-ahead";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import {
  EVENT_ICONS,
  EVENT_LINE_KEYS,
  EVENT_NAME_KEYS,
  eventTone,
  FOLLOW,
  MORPH_MS,
} from "./year-ahead-parts";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASING = Easing.bezier(...EASE_STANDARD);

const HEIGHT = 200;
/**
 * Room above the plot: enough for a marker riding the line at its highest
 * when there is one, a sliver otherwise — the strip is not left blank for
 * markers that are not there.
 */
const PAD_TOP_MARKERS = 48;
const PAD_TOP = 14;
const PAD_BOTTOM = 8;
const PAD_X = 6;
/**
 * Every path is drawn from this many points whatever the window — one per
 * month at five years — so six months can morph into five years. The web
 * draws the same number.
 */
const SAMPLES = 61;
const MARKER = 32;
const STEM = 8;

/** One state of the chart, in pixels: what the morph goes from and to. */
interface Shape {
  total: number[];
  baseline: number[];
  /** The range 8 futures in 10 stay within; the total when there is none. */
  low: number[];
  high: number[];
  /** The chart's bottom: what a line rises from the first time. */
  floor: number;
}

const EMPTY: Shape = { total: [], baseline: [], low: [], high: [], floor: HEIGHT };

/** Two shapes `progress` of the way, a missing piece risen from the floor. */
function mixShape(from: Shape, to: Shape, progress: number): Shape {
  const flat = to.total.map(() => to.floor);
  const mix = (a: number[], b: number[]) => {
    const start = a.length === b.length ? a : flat;
    return b.map((value, index) => start[index]! + (value - start[index]!) * progress);
  };
  return {
    total: mix(from.total, to.total),
    baseline: mix(from.baseline, to.baseline),
    low: mix(from.low, to.low),
    high: mix(from.high, to.high),
    floor: to.floor,
  };
}

interface YearAheadChartProps {
  ahead: YearAhead;
  showBaseline: boolean;
  events: readonly YearAheadEvent[];
  onMoveEvent: (id: string, month: number) => void;
  /** The month under the finger, for the legend to read out. */
  onActiveChange: (step: number | null) => void;
  /** "Aujourd'hui", "mars 2027". */
  stepLabel: (step: number) => string;
  /** "mars 27", for the axis. */
  axisLabel: (step: number) => string;
  yearTicks: { step: number; label: string }[];
  /** Already masked when amounts are hidden. */
  money: (value: number) => string;
  label: string;
}

/**
 * The months ahead as one gold line — every visible account added up — in
 * the shaded range 8 futures in 10 stay within, zoomed on where the money
 * is with a few round amounts as labelled lines: the web's chart, drawn
 * with Reanimated. The accounts are read in their rows under it.
 *
 * Each state is a shape in pixels; a new one morphs from wherever the last
 * one had got to, on the UI thread, so a longer window stretches the line
 * and its range. A touch or a drag reads the month and its range out above
 * the chart, with a tick for each month crossed, and hands the month to the
 * rows; an event's marker rides the line and is dragged from month to
 * month, ticking as it goes.
 */
export function YearAheadChart({
  ahead,
  showBaseline,
  events,
  onMoveEvent,
  onActiveChange,
  stepLabel,
  axisLabel,
  yearTicks,
  money,
  label,
}: YearAheadChartProps) {
  const t = useT();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const frame = useRef<View>(null);
  const originX = useRef(0);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const lastTick = useRef<number | null>(null);
  const months = ahead.months;
  const padTop = events.some((event) => event.month <= months)
    ? PAD_TOP_MARKERS
    : PAD_TOP;

  const target = useMemo(() => {
    if (width === 0) {
      return null;
    }
    const total = resampleSeries(ahead.total, SAMPLES);
    const baseline = resampleSeries(ahead.baseline, SAMPLES);
    const low = ahead.range ? resampleSeries(ahead.range.low, SAMPLES) : total;
    const high = ahead.range ? resampleSeries(ahead.range.high, SAMPLES) : total;
    const values = [...total, ...low, ...high, ...(showBaseline ? baseline : [])];
    // Zoomed on where the money is, the labelled lines keeping the scale
    // honest — as on the web.
    let min = Math.min(...values);
    let max = Math.max(...values);
    const pad = Math.max((max - min) * 0.08, Math.abs(max) * 0.01, 1);
    min -= pad;
    max += pad;
    const y = (value: number) =>
      padTop + ((max - value) / (max - min)) * (HEIGHT - padTop - PAD_BOTTOM);
    const xOfSample = (index: number) =>
      PAD_X + (index / (SAMPLES - 1)) * (width - PAD_X * 2);
    const xOfStep = (step: number) =>
      PAD_X + (months > 0 ? step / months : 0) * (width - PAD_X * 2);
    const shape: Shape = {
      total: total.map(y),
      baseline: baseline.map(y),
      low: low.map(y),
      high: high.map(y),
      floor: HEIGHT - PAD_BOTTOM,
    };
    return {
      shape,
      xs: Array.from({ length: SAMPLES }, (_, index) => xOfSample(index)),
      y,
      xOfStep,
      ticks: niceTicks(min, max),
    };
  }, [ahead, showBaseline, width, months, padTop]);

  const geom = useSharedValue<{ from: Shape; to: Shape; xs: number[] }>({
    from: EMPTY,
    to: EMPTY,
    xs: [],
  });
  const progress = useSharedValue(1);

  // Each new shape starts from wherever the last morph had got to.
  useEffect(() => {
    if (!target) {
      return;
    }
    const was = geom.get();
    const now = mixShape(was.from, was.to, progress.get());
    geom.set({ from: now, to: target.shape, xs: target.xs });
    if (reduce) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, { duration: MORPH_MS, easing: EASING }));
  }, [target, reduce, geom, progress]);

  function stepAt(pageX: number, from = 0): number {
    if (width === 0 || months === 0) {
      return from;
    }
    const ratio = (pageX - originX.current - PAD_X) / (width - PAD_X * 2);
    return Math.min(months, Math.max(from, Math.round(ratio * months)));
  }

  function show(step: number | null) {
    if (step !== null && lastTick.current !== step) {
      lastTick.current = step;
      void hapticSelection();
    }
    if (step === null) {
      lastTick.current = null;
    }
    setActive(step);
    onActiveChange(step);
  }

  function scrub(event: GestureResponderEvent) {
    show(stepAt(event.nativeEvent.pageX));
  }

  const measure = () =>
    frame.current?.measureInWindow((x) => {
      originX.current = x;
    });

  const shown = active !== null ? Math.min(active, months) : null;
  const end = ahead.total[months] ?? 0;

  return (
    <View className="gap-2">
      <Text
        variant={shown !== null ? "body" : "muted"}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        className={
          shown !== null ? "text-sm font-medium tabular-nums" : "text-xs"
        }
      >
        {shown !== null
          ? `${t("futurePlan.scrubPoint", {
              month: stepLabel(shown),
              amount: money(ahead.total[shown] ?? 0),
            })}${
              ahead.range && shown > 0
                ? ` · ${t("futurePlan.scrubRange", {
                    low: money(ahead.range.low[shown] ?? 0),
                    high: money(ahead.range.high[shown] ?? 0),
                  })}`
                : ""
            }`
          : t("futurePlan.scrubHint")}
      </Text>

      <View
        ref={frame}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}. ${t("futurePlan.scrubPoint", {
          month: stepLabel(months),
          amount: money(end),
        })}`}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          measure();
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          measure();
          scrub(event);
        }}
        onResponderMove={scrub}
        onResponderRelease={() => show(null)}
        onResponderTerminate={() => show(null)}
        style={{ height: HEIGHT }}
      >
        {target ? (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            {target.ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                x2={width}
                y1={target.y(tick)}
                y2={target.y(tick)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}

            <Range geom={geom} progress={progress} color={colors.primary} />

            <Edge
              pick="baseline"
              geom={geom}
              progress={progress}
              stroke={colors.foreground}
              opacity={showBaseline ? 0.75 : 0}
              width={1.5}
              dashed
            />
            <Edge
              pick="total"
              geom={geom}
              progress={progress}
              stroke={colors.primary}
              opacity={1}
              width={2.5}
            />

            {shown !== null ? (
              <G>
                <Line
                  x1={target.xOfStep(shown)}
                  x2={target.xOfStep(shown)}
                  y1={Math.max(2, padTop - 8)}
                  y2={HEIGHT - 2}
                  stroke={colors.hairlineStrong}
                  strokeWidth={1}
                />
                <Circle
                  cx={target.xOfStep(shown)}
                  cy={target.y(ahead.total[shown] ?? 0)}
                  r={6}
                  fill={colors.primary}
                  stroke={colors.card}
                  strokeWidth={2}
                />
              </G>
            ) : null}
          </Svg>
        ) : null}

        {target
          ? target.ticks.map((tick) => (
              <Text
                key={tick}
                variant="micro"
                pointerEvents="none"
                className="tabular-nums"
                style={{ position: "absolute", left: 0, top: target.y(tick) - 15 }}
              >
                {money(tick)}
              </Text>
            ))
          : null}

        {target
          ? events
              .filter((event) => event.month <= months)
              .map((event) => (
                <EventMarker
                  key={event.id}
                  event={event}
                  x={target.xOfStep(event.month)}
                  y={target.y(ahead.total[event.month] ?? 0)}
                  label={t("futurePlan.eventMarker", {
                    name: t(EVENT_NAME_KEYS[event.kind]),
                    line: t(EVENT_LINE_KEYS[event.kind], {
                      amount: money(event.amount),
                      month: stepLabel(event.month),
                    }),
                  })}
                  reduce={reduce}
                  onGrant={() => {
                    measure();
                    show(event.month);
                  }}
                  onDrag={(pageX) => {
                    const month = stepAt(pageX, 1);
                    show(month);
                    if (month !== event.month) {
                      onMoveEvent(event.id, month);
                    }
                  }}
                  onRelease={() => show(null)}
                  onStep={(delta) => {
                    void hapticSelection();
                    onMoveEvent(
                      event.id,
                      Math.min(months, Math.max(1, event.month + delta)),
                    );
                  }}
                />
              ))
          : null}
      </View>

      <View style={{ height: 16 }}>
        <Text variant="micro" style={{ position: "absolute", left: 0 }}>
          {axisLabel(0)}
        </Text>
        {target
          ? yearTicks.map((tick) => (
              <Text
                key={tick.step}
                variant="micro"
                style={{
                  position: "absolute",
                  left: target.xOfStep(tick.step) - 20,
                  width: 40,
                  textAlign: "center",
                }}
              >
                {tick.label}
              </Text>
            ))
          : null}
        <Text variant="micro" style={{ position: "absolute", right: 0 }}>
          {axisLabel(months)}
        </Text>
      </View>
    </View>
  );
}

/** The range 8 futures in 10 stay within, morphing on the UI thread. */
function Range({
  geom,
  progress,
  color,
}: {
  geom: SharedValue<{ from: Shape; to: Shape; xs: number[] }>;
  progress: SharedValue<number>;
  color: string;
}) {
  const area = useAnimatedProps(() => {
    const { from, to, xs } = geom.get();
    const p = progress.get();
    if (to.high.length === 0 || xs.length === 0) {
      return { d: "" };
    }
    const mixed = (was: number[], goal: number[], index: number) => {
      const start = was.length === goal.length ? was[index]! : to.floor;
      return start + (goal[index]! - start) * p;
    };
    let d = "";
    for (let index = 0; index < xs.length; index += 1) {
      const value = mixed(from.high, to.high, index);
      d += `${index === 0 ? "M" : "L"}${xs[index]!.toFixed(1)},${value.toFixed(1)} `;
    }
    for (let index = xs.length - 1; index >= 0; index -= 1) {
      const value = mixed(from.low, to.low, index);
      d += `L${xs[index]!.toFixed(1)},${value.toFixed(1)} `;
    }
    return { d: `${d}Z` };
  });
  return <AnimatedPath animatedProps={area} fill={color} fillOpacity={0.16} />;
}

/** The gold total, or the dashed line of things as they stand. */
function Edge({
  pick,
  geom,
  progress,
  stroke,
  opacity,
  width,
  dashed,
}: {
  pick: "total" | "baseline";
  geom: SharedValue<{ from: Shape; to: Shape; xs: number[] }>;
  progress: SharedValue<number>;
  stroke: string;
  opacity: number;
  width: number;
  dashed?: boolean;
}) {
  const line = useAnimatedProps(() => {
    const { from, to, xs } = geom.get();
    const p = progress.get();
    const goal = to[pick];
    if (goal.length === 0 || xs.length === 0) {
      return { d: "" };
    }
    const was = from[pick];
    let d = "";
    for (let index = 0; index < xs.length; index += 1) {
      const start = was.length === goal.length ? was[index]! : to.floor;
      const value = start + (goal[index]! - start) * p;
      d += `${index === 0 ? "M" : "L"}${xs[index]!.toFixed(1)},${value.toFixed(1)} `;
    }
    return { d };
  });
  return (
    <AnimatedPath
      animatedProps={line}
      fill="none"
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeDasharray={dashed ? [4, 5] : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * An event riding the line at its month: it springs to each new place, and
 * a finger drags it sideways from month to month. A screen reader moves it
 * with the system's swipe up and down.
 */
function EventMarker({
  event,
  x,
  y,
  label,
  reduce,
  onGrant,
  onDrag,
  onRelease,
  onStep,
}: {
  event: YearAheadEvent;
  x: number;
  y: number;
  label: string;
  reduce: boolean;
  onGrant: () => void;
  onDrag: (pageX: number) => void;
  onRelease: () => void;
  onStep: (delta: number) => void;
}) {
  const colors = useThemeColors();
  const left = useSharedValue(x);
  const top = useSharedValue(y);
  const scale = useSharedValue(reduce ? 1 : 0.4);

  useEffect(() => {
    left.set(reduce ? x : withSpring(x, FOLLOW));
    top.set(reduce ? y : withSpring(y, FOLLOW));
  }, [x, y, reduce, left, top]);
  useEffect(() => {
    scale.set(reduce ? 1 : withSpring(1, FOLLOW));
  }, [reduce, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: left.get() - MARKER / 2 },
      { translateY: top.get() - MARKER - STEM },
      { scale: scale.get() },
    ],
  }));
  const tone = eventTone(event.kind);

  return (
    <Animated.View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(action) =>
        onStep(action.nativeEvent.actionName === "increment" ? 1 : -1)
      }
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => {
        if (!reduce) {
          scale.set(withSpring(1.15, FOLLOW));
        }
        onGrant();
      }}
      onResponderMove={(touch) => onDrag(touch.nativeEvent.pageX)}
      onResponderRelease={() => {
        scale.set(reduce ? 1 : withSpring(1, FOLLOW));
        onRelease();
      }}
      onResponderTerminate={() => {
        scale.set(1);
        onRelease();
      }}
      hitSlop={10}
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: MARKER,
          height: MARKER + STEM,
          alignItems: "center",
        },
        style,
      ]}
    >
      <View
        style={{
          width: MARKER,
          height: MARKER,
          borderRadius: MARKER / 2,
          borderWidth: 1,
          borderColor: `${tone}80`,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={EVENT_ICONS[event.kind]} size={ICON.sm} color={tone} />
      </View>
      <View
        style={{ width: 1, height: STEM, backgroundColor: tone, opacity: 0.6 }}
      />
    </Animated.View>
  );
}
