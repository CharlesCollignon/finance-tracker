import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatPercentLabel } from "@finance/core/constants";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useLocale } from "@/providers/LocaleProvider";
import { CHART_COLORS, ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

export interface WeightBarRow {
  id: string;
  label: string;
  /** Share of the whole, 0–1. */
  weight: number;
  /** Drawn before the label — a flag, for a country. */
  mark?: string | null;
}

interface WeightBarsProps {
  rows: WeightBarRow[];
  /** How many rows get their own line before the rest are pooled. */
  limit?: number;
  /** Words for the pooled remainder — "4 more countries". */
  restLabel: (count: number) => string;
  showRestLabel: string;
  hideRestLabel: string;
}

/**
 * A weighting, as a list of bars — the web's `WeightBars`, on a phone.
 *
 * One colour, because every row carries its own name; the longest bar is the
 * full width rather than the bar being a share of 100%, so a portfolio that is
 * 12% Japan at most is not a column of slivers. Everything past `limit` pools
 * into one row that unfolds the names behind it in place.
 */
export function WeightBars({
  rows,
  limit = 6,
  restLabel,
  showRestLabel,
  hideRestLabel,
}: WeightBarsProps) {
  const locale = useLocale();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  if (rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((left, right) => right.weight - left.weight);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const restWeight = rest.reduce((sum, row) => sum + row.weight, 0);
  const pooled = restWeight > 0.001;

  const largest = Math.max(
    ...head.map((row) => row.weight),
    pooled ? restWeight : 0,
    0.0001,
  );

  return (
    <View className="gap-3">
      {head.map((row) => (
        <Row key={row.id} row={row} largest={largest} locale={locale} />
      ))}

      {pooled ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityHint={open ? hideRestLabel : showRestLabel}
            onPress={() => {
              void hapticLight();
              setOpen((was) => !was);
            }}
            className="min-h-11 justify-center gap-1"
          >
            <View className="flex-row items-baseline justify-between gap-3">
              <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={ICON.xs}
                  color={colors.mutedForeground}
                />
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                  {restLabel(rest.length)}
                </Text>
              </View>
              <Text className="font-sans tabular-nums text-sm font-semibold">
                {formatShare(restWeight, locale)}
              </Text>
            </View>
            <Bar weight={restWeight} largest={largest} />
          </Pressable>

          {open ? (
            <View className="gap-3 border-t border-border pt-3">
              {rest.map((row) => (
                <Row key={row.id} row={row} largest={largest} locale={locale} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Row({
  row,
  largest,
  locale,
}: {
  row: WeightBarRow;
  largest: number;
  locale: Locale;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${row.label}, ${formatShare(row.weight, locale)}`}
      className="gap-1"
    >
      <View className="flex-row items-baseline justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
          {row.mark ? <Text className="text-sm">{row.mark}</Text> : null}
          <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
            {row.label}
          </Text>
        </View>
        <Text className="font-sans tabular-nums text-sm font-semibold">
          {formatShare(row.weight, locale)}
        </Text>
      </View>
      <Bar weight={row.weight} largest={largest} />
    </View>
  );
}

/** The bar itself; the figure above it is what a screen reader hears. */
function Bar({ weight, largest }: { weight: number; largest: number }) {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <View
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, (weight / largest) * 100)}%`,
          backgroundColor: CHART_COLORS[0],
        }}
      />
    </View>
  );
}

/**
 * A share, at one decimal place at most; "<0,1 %" rather than "0,0 %" for a
 * sliver, which would say the holding is not there. The web's rule.
 */
function formatShare(weight: number, locale: Locale): string {
  const percent = weight * 100;
  if (percent > 0 && percent < 0.1) {
    return `<${formatPercentLabel(0.1, locale)}`;
  }
  return translator(locale)("units.percent", {
    value: new Intl.NumberFormat(INTL_LOCALES[locale], {
      maximumFractionDigits: percent < 10 ? 1 : 0,
    }).format(percent),
  });
}
