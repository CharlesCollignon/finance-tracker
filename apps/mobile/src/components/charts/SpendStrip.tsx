import { View } from "react-native";

import type { CategoryBreakdown } from "@finance/core/types/database";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useChartSeries } from "@/theme/chart-series";
import { useThemeColors } from "@/theme/useThemeColors";

interface SpendStripProps {
  rows: CategoryBreakdown[];
  total: number;
  /** How many categories get their own band before the rest are pooled. */
  bands?: number;
}

/**
 * Where the month went, as one bar.
 *
 * The web twin of this replaced a Sankey; here it replaces a donut and the
 * chart runtime that drew it. A split is a split — it has no flow through
 * stages and no dense series worth hovering — so it is a row of coloured
 * boxes, which is also the only version of it that stays readable at the
 * width of a phone.
 *
 * Five bands and a remainder, because a band thinner than a couple of percent
 * is a colour nobody can match to a legend.
 */
export function SpendStrip({ rows, total, bands = 5 }: SpendStripProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const series = useChartSeries();

  if (total <= 0 || rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, bands);
  const rest = sorted.slice(bands);
  const restTotal = rest.reduce((sum, row) => sum + row.total, 0);

  const segments = [
    ...head.map((row, index) => ({
      key: row.categoryId,
      name: row.name,
      amount: row.total,
      color: series[index % series.length]!,
    })),
    ...(restTotal > 0
      ? [
          {
            key: "rest",
            name: `${rest.length} more`,
            amount: restTotal,
            color: colors.mutedForeground,
          },
        ]
      : []),
  ];

  return (
    <View className="gap-3">
      <View
        accessibilityRole="image"
        accessibilityLabel={`Spending split across ${segments.length} categories`}
        className="h-2.5 flex-row overflow-hidden rounded-full"
      >
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={{
              flexGrow: segment.amount / total,
              flexBasis: 0,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </View>

      <View className="gap-1.5">
        {segments.map((segment) => (
          <View
            key={segment.key}
            className="flex-row items-center justify-between gap-3"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <Text
                numberOfLines={1}
                className="flex-1 text-sm text-muted-foreground"
              >
                {segment.name}
              </Text>
            </View>
            <PrivateAmount className="text-sm">
              {formatEuro(segment.amount)}
            </PrivateAmount>
          </View>
        ))}
      </View>
    </View>
  );
}
