import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatPercentLabel } from "@finance/core/constants";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import {
  allocationSegments,
  type AllocationKind,
  type RecurringRollup,
} from "@finance/core/recurring-rollup";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { CHART_COLORS, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASING = Easing.bezier(...EASE_STANDARD);

/** The bar starts filling once the figure has begun to count. */
const BAR_DELAY_MS = 150;

const RING = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * What a month of recurring entries leaves, and where the rest of the income
 * goes — the web's `WhereItGoes` card, on a phone.
 *
 * It replaces four tiles that took half the first screen: four 24px figures
 * in half-width cards, three of which the bar below now carries as a legend.
 * What is left leads, counting up as the screen opens; the ring beside it
 * fills to the share of income that stays; the bar grows in from the left,
 * in the colours the groups below give the same amounts. Every term is still
 * on screen — a total whose subtrahends nobody can see is not believed.
 */
export function WhereItGoes({ rollup }: { rollup: RecurringRollup }) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const segments = allocationSegments(rollup);
  const kept =
    rollup.income > 0
      ? Math.max(0, Math.min(1, rollup.left / rollup.income))
      : 0;

  const segmentColor: Record<AllocationKind, string> = {
    expense: colors.destructive,
    savings: colors.primary,
    investment: colors.info,
    // `ALLOCATION_COLORS.remaining` on the web: --chart-5.
    left: CHART_COLORS[4],
  };
  const labels: Record<AllocationKind, string> = {
    expense: t("allocation.expenses"),
    savings: t("allocation.savings"),
    investment: t("allocation.investments"),
    left: t("charges.tileLeft"),
  };

  return (
    <View className="gap-4 rounded-card border border-border bg-card px-5 py-5">
      <View className="flex-row items-center gap-4">
        <View className="min-w-0 flex-1 gap-1.5">
          <Text variant="label">{t("charges.leftEachMonth")}</Text>
          {rollup.income > 0 ? (
            <>
              <AnimatedAmount
                value={rollup.left}
                startFrom={0}
                format={formatEuro}
                style={TYPE.figure}
                numberOfLines={1}
                adjustsFontSizeToFit
                className={rollup.left < 0 ? "text-destructive" : undefined}
              />
              <Text variant="muted" className="text-sm">
                {`${t("charges.ofIncomeBefore")} `}
                <PrivateAmount
                  className={cn("text-sm", TYPE_AMOUNT_CLASS.income)}
                >
                  {formatEuro(rollup.income)}
                </PrivateAmount>
                {` ${t("charges.ofIncomeAfter")}`}
              </Text>
            </>
          ) : (
            // Not a figure: with no income recorded, what is left would only
            // be the outgoings with a minus sign.
            <Text variant="muted" className="text-sm">
              {t("charges.noIncomeYet")}
            </Text>
          )}
        </View>
        {rollup.income > 0 ? (
          <KeptRing
            ratio={kept}
            label={formatPercentLabel(Math.round(kept * 100), locale)}
            accessibilityLabel={t("charges.keptShare", {
              percent: formatPercentLabel(Math.round(kept * 100), locale),
            })}
          />
        ) : null}
      </View>

      {segments.length > 0 ? (
        <>
          <GrowingBar
            segments={segments.map((segment) => ({
              key: segment.kind,
              share: segment.share,
              color: segmentColor[segment.kind],
            }))}
          />
          {/* Two columns: four labelled amounts do not fit one line on a
              phone, and a wrapped line would split a label from its figure.
              The dot repeats the bar's colour; the word carries the meaning. */}
          <View className="flex-row flex-wrap gap-y-2">
            {segments.map((segment) => (
              <View
                key={segment.kind}
                className="w-1/2 flex-row items-center gap-2 pr-2"
              >
                <View
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: segmentColor[segment.kind] }}
                />
                <View className="min-w-0 flex-1">
                  <Text variant="muted" numberOfLines={1} className="text-xs">
                    {labels[segment.kind]}
                  </Text>
                  <PrivateAmount
                    numberOfLines={1}
                    className={cn(
                      "text-sm font-medium",
                      segment.kind === "left"
                        ? "text-foreground"
                        : TYPE_AMOUNT_CLASS[segment.kind],
                    )}
                  >
                    {formatEuro(segment.amount)}
                  </PrivateAmount>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** The share of income that stays, as a ring that fills on arrival. */
function KeptRing({
  ratio,
  label,
  accessibilityLabel,
}: {
  ratio: number;
  label: string;
  accessibilityLabel: string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const { hidden } = usePrivacy();
  const progress = useSharedValue(reduce ? ratio : 0);

  useEffect(() => {
    progress.value = reduce
      ? ratio
      : withTiming(ratio, { duration: DURATION.count, easing: EASING });
  }, [ratio, reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View
      accessible
      accessibilityLabel={hidden ? undefined : accessibilityLabel}
      className="items-center justify-center"
      style={{ width: RING, height: RING }}
    >
      <Svg
        width={RING}
        height={RING}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          stroke={colors.hairlineStrong}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          stroke={CHART_COLORS[4]}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <Text className="font-sans tabular-nums text-xs font-semibold">
        {hidden ? "••" : label}
      </Text>
    </View>
  );
}

/**
 * The bar, growing in from the left. The segments keep their proportions
 * throughout — it is the bar that grows, not one part at the expense of
 * another — so a reader never sees a split that is not the real one.
 */
function GrowingBar({
  segments,
}: {
  segments: { key: string; share: number; color: string }[];
}) {
  const reduce = useReducedMotion();
  const width = useSharedValue(reduce ? 100 : 0);

  useEffect(() => {
    width.value = reduce
      ? 100
      : withDelay(
          BAR_DELAY_MS,
          withTiming(100, { duration: DURATION.panel, easing: EASING }),
        );
  }, [reduce, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    // Hidden from screen readers: the legend says the same in words.
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="h-2 w-full"
    >
      <Animated.View
        style={style}
        className="h-full flex-row gap-0.5 overflow-hidden rounded-full"
      >
        {segments.map((segment) => (
          <View
            key={segment.key}
            className="h-full"
            style={{ flex: segment.share, backgroundColor: segment.color }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
