import { Pressable, View } from "react-native";
import Animated, {
  LinearTransition,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import {
  resampleSeries,
  type YearAheadAccountId,
  type YearAheadBand,
} from "@finance/core/year-ahead";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { useTwoColumns } from "./year-ahead-parts";

const SPARK_SAMPLES = 25;
const SPARK_WIDTH = 64;
const SPARK_HEIGHT = 24;

/**
 * The accounts under the chart, one row each — the web's rows: its colour,
 * its name, its small curve, what it holds today and at the month read
 * (the end, or the month under the finger on the chart), and the change.
 * A tap takes it out of the figure and the chart, another brings it back;
 * the last one showing stays. The row a « Pourquoi » line was tapped for
 * lights up. Two columns on a wide screen.
 */
export function YearAheadAccounts({
  bands,
  step,
  pending,
  played,
  focus,
  color,
  name,
  onToggle,
  whole,
}: {
  bands: YearAheadBand[];
  /** The month read: the end, or the one under the finger. */
  step: number;
  pending: boolean;
  played: boolean;
  focus: YearAheadAccountId | null;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  onToggle: (id: YearAheadAccountId) => void;
  /** For `AnimatedAmount`, which masks on its own. */
  whole: (value: number) => string;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [wide, onLayout] = useTwoColumns();
  const shownCount = bands.filter((band) => !band.hidden).length;
  // One scale for every sparkline, in euros, as on the web.
  const changes = bands
    .filter((band) => !band.hidden)
    .flatMap((band) => band.values.map((value) => value - (band.values[0] ?? 0)));
  const scale = {
    up: Math.max(0, ...changes),
    down: Math.max(0, ...changes.map((change) => -change)),
  };

  const rows = bands.map((band) => {
    const last = !band.hidden && shownCount === 1;
    const today = band.values[0] ?? 0;
    const at = band.values[Math.min(step, band.values.length - 1)] ?? 0;
    const change = at - today;
    return (
      <Animated.View
        key={band.id}
        entering={reduce ? undefined : ZoomIn.springify().damping(16)}
        layout={reduce ? undefined : LinearTransition.springify().damping(20)}
        style={wide ? { width: "48%" } : undefined}
      >
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: !band.hidden, disabled: last }}
          accessibilityLabel={t("futurePlan.accountToggle", {
            name: name(band.id),
          })}
          disabled={last}
          onPress={() => onToggle(band.id)}
          className={cn(
            "-mx-2 min-h-12 flex-row items-center gap-3 rounded-control px-2",
            focus === band.id && "bg-muted",
          )}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: color(band.id),
              opacity: band.hidden ? 0.35 : 1,
            }}
          />
          <Text
            numberOfLines={1}
            className={cn(
              "min-w-0 flex-1 text-sm",
              band.hidden ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {name(band.id)}
          </Text>
          <Sparkline
            values={band.values}
            scale={scale}
            color={color(band.id)}
            dim={band.hidden}
          />
          {band.hidden ? (
            <View style={{ width: 88 }} />
          ) : (
            <View className="items-end" style={{ minWidth: 88 }}>
              <AnimatedAmount
                value={at}
                format={whole}
                className="text-sm font-semibold tabular-nums"
              />
              <Text variant="micro" className="tabular-nums">
                {`${change >= 0 ? "+" : "−"}${whole(Math.abs(change))}`}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  });

  return (
    <View className="gap-2" onLayout={onLayout}>
      <View className={wide ? "flex-row flex-wrap justify-between" : undefined}>
        {rows}
      </View>
      {pending || played ? (
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          {pending ? (
            <Text variant="muted" className="text-xs">
              {t("futurePlan.accountsPending")}
            </Text>
          ) : null}
          {played ? (
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  width: 16,
                  height: 0,
                  borderTopWidth: 2,
                  borderStyle: "dashed",
                  borderColor: colors.foreground,
                }}
              />
              <Text variant="muted" className="text-xs">
                {t("planWeb.asItStands")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** An account's curve from where it starts today, on the rows' shared scale. */
function Sparkline({
  values,
  scale,
  color,
  dim,
}: {
  values: readonly number[];
  scale: { up: number; down: number };
  color: string;
  dim: boolean;
}) {
  const samples = resampleSeries(values, SPARK_SAMPLES);
  const start = samples[0] ?? 0;
  const span = scale.up + scale.down || 1;
  const room = SPARK_HEIGHT - 6;
  const level = 3 + (scale.up / span) * room;
  const d = samples
    .map((value, index) => {
      const x = (index / (SPARK_SAMPLES - 1)) * SPARK_WIDTH;
      const y = level - ((value - start) / span) * room;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <Svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      style={{ opacity: dim ? 0.3 : 1 }}
      pointerEvents="none"
    >
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
