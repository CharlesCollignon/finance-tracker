import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { EASE_STANDARD } from "@finance/core/motion";
import type {
  YearAheadAccountId,
  YearAheadFlow,
} from "@finance/core/year-ahead";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { COLORS, ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { MORPH_MS, useTwoColumns } from "./year-ahead-parts";

const EASING = Easing.bezier(...EASE_STANDARD);

/** The two ways money leaves for good, quieter than any account. */
const COMMITTED_COLOR = `${COLORS.mutedForeground}73`;
const EVERYDAY_COLOR = `${COLORS.mutedForeground}47`;

interface Segment {
  key: string;
  label: string;
  /** Signed: what it does to the month. */
  amount: number;
  color: string;
  account: YearAheadAccountId | null;
  hint?: string;
}

/**
 * Why the money ends up where the chart puts it — the web's « Pourquoi »: a
 * month's income as one bar, cut into the charges, everyday spending, each
 * account in its colour and what stays on the current account, the pieces
 * growing in one after another; then one sentence for interest and returns. A tap on an account's row lights its band
 * on the chart; another tap lets it go.
 */
export function YearAheadWhy({
  flow,
  everydayCounted,
  endLabel,
  color,
  name,
  focus,
  onFocus,
  whole,
  shown,
}: {
  flow: YearAheadFlow;
  everydayCounted: boolean;
  /** "septembre 2027": where the window ends, for the returns' sentence. */
  endLabel: string;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  focus: YearAheadAccountId | null;
  onFocus: (id: YearAheadAccountId | null) => void;
  /** For `AnimatedAmount`, which masks on its own. */
  whole: (value: number) => string;
  /** For an amount inside a sentence, masked when amounts are hidden. */
  shown: (value: number) => string;
}) {
  const t = useT();
  const colors = useThemeColors();
  const [wide, onLayout] = useTwoColumns();
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${whole(Math.abs(value))}`;

  const segments: Segment[] = [
    {
      key: "committed",
      label: t("futurePlan.flowCommitted"),
      amount: -flow.committed,
      color: COMMITTED_COLOR,
      account: null,
    },
    ...(everydayCounted && flow.everyday > 0
      ? [
          {
            key: "everyday",
            label: t("futurePlan.flowEveryday"),
            amount: -flow.everyday,
            color: EVERYDAY_COLOR,
            account: null,
          },
        ]
      : []),
    ...flow.into.map((row) => ({
      key: row.id,
      label: name(row.id),
      amount: row.monthly,
      color: color(row.id),
      account: row.id,
      hint: row.id === "elsewhere" ? t("futurePlan.elsewhereHint") : undefined,
    })),
    {
      key: "current",
      label:
        flow.current >= 0
          ? t("futurePlan.flowCurrentStays")
          : t("futurePlan.flowCurrentFalls"),
      amount: flow.current,
      color: color("current"),
      account: "current",
    },
  ];

  // The bar is the month's income; when more goes out than comes in, it is
  // the outgoings, so every piece still fits.
  const widthOf = (segment: Segment) =>
    segment.key === "current"
      ? Math.max(0, segment.amount)
      : Math.abs(segment.amount);
  const scale = Math.max(
    flow.income,
    segments.reduce((sum, segment) => sum + widthOf(segment), 0),
    1,
  );

  const half = Math.ceil(segments.length / 2);
  const renderRow = (segment: Segment) => {
    const on = segment.account !== null && focus === segment.account;
    const row = (
      <View className="min-h-11 justify-center gap-0.5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: segment.color,
              }}
            />
            <Text
              numberOfLines={1}
              className={cn("shrink text-sm", on && "font-semibold")}
            >
              {segment.label}
            </Text>
          </View>
          <AnimatedAmount
            value={segment.amount}
            format={signed}
            className={cn(
              "text-sm tabular-nums",
              segment.key === "current" &&
                segment.amount < 0 &&
                "text-destructive",
            )}
          />
        </View>
        {segment.hint && on ? (
          <View className="flex-row items-start gap-1.5 pl-[18px]">
            <Ionicons
              name="information-circle-outline"
              size={ICON.sm}
              color={colors.mutedForeground}
            />
            <Text variant="muted" className="shrink text-xs">
              {segment.hint}
            </Text>
          </View>
        ) : null}
      </View>
    );
    return segment.account ? (
      <Pressable
        key={segment.key}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => {
          void hapticSelection();
          onFocus(on ? null : segment.account);
        }}
        className={cn(
          "-mx-2 rounded-control px-2",
          on && "bg-muted",
        )}
      >
        {row}
      </Pressable>
    ) : (
      <View key={segment.key}>{row}</View>
    );
  };

  return (
    <View className="gap-3" onLayout={onLayout}>
      <Text variant="muted" className="text-sm">
        {t("futurePlan.whyLeadIncome", { amount: shown(flow.income) })}
      </Text>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          flexDirection: "row",
          height: 12,
          gap: 2,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: colors.muted,
        }}
      >
        {segments.map((segment, index) => (
          <Piece
            key={segment.key}
            share={widthOf(segment) / scale}
            color={segment.color}
            index={index}
          />
        ))}
      </View>

      {/* Two columns on a wide screen, as on the web; one on a phone. */}
      {wide ? (
        <View className="flex-row gap-8">
          <View className="min-w-0 flex-1">
            {segments.slice(0, half).map(renderRow)}
          </View>
          <View className="min-w-0 flex-1">
            {segments.slice(half).map(renderRow)}
          </View>
        </View>
      ) : (
        <View>{segments.map(renderRow)}</View>
      )}

      {!everydayCounted ? (
        <Text variant="muted" className="text-xs">
          {t("futurePlan.flowEverydayUnmeasured")}
        </Text>
      ) : null}

      {Math.round(flow.growth) > 0 ? (
        <Text variant="muted" className="text-sm">
          {t("futurePlan.flowGrowthLine", {
            amount: shown(flow.growth),
            month: endLabel,
          })}
        </Text>
      ) : null}
    </View>
  );
}

/** One piece of the bar, growing to its share — in turn on the first draw. */
function Piece({
  share,
  color,
  index,
}: {
  share: number;
  color: string;
  index: number;
}) {
  const reduce = useReducedMotion();
  const width = useSharedValue(reduce ? share : 0);
  const first = useSharedValue(true);

  useEffect(() => {
    if (reduce) {
      width.set(share);
      return;
    }
    const grow = withTiming(share, { duration: MORPH_MS, easing: EASING });
    width.set(first.get() ? withDelay(index * 50, grow) : grow);
    first.set(false);
  }, [share, index, reduce, width, first]);

  // The colour on the animated view itself: an inline style, which the web
  // build keeps (a class on an Animated.View is dropped there).
  const style = useAnimatedStyle(() => ({
    width: `${Math.max(0, width.get()) * 100}%`,
  }));

  return <Animated.View style={[{ height: 12, backgroundColor: color }, style]} />;
}
