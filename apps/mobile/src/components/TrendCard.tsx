import { useMemo } from "react";
import { View } from "react-native";
import type { EChartsCoreOption } from "echarts/core";

import type { MonthlyTrendPoint } from "@/lib/queries";

import { EChart } from "@/components/charts/EChart";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** Below this a "trend" would be a straight line between two dots. */
const MIN_MONTHS_FOR_CHART = 3;

interface TrendCardProps {
  points: MonthlyTrendPoint[];
}

/**
 * Net per month over the last half-year.
 *
 * Deliberately honest about thin data: with fewer than three months that have
 * activity it says so and shows the months it does have, rather than drawing a
 * shape that implies a trend which isn't there yet.
 */
export function TrendCard({ points }: TrendCardProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const active = useMemo(
    () => points.filter((point) => point.income !== 0 || point.outflow !== 0),
    [points],
  );
  const best = useMemo(
    () =>
      active.reduce<MonthlyTrendPoint | null>(
        (top, point) => (top === null || point.net > top.net ? point : top),
        null,
      ),
    [active],
  );
  const isBestThisMonth =
    best !== null &&
    active.length > 1 &&
    best.monthKey === active.at(-1)?.monthKey;

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (active.length < MIN_MONTHS_FOR_CHART) {
      return null;
    }
    return {
      animationDuration: 450,
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: active.map((point) => point.label.split(" ")[0]),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: colors.mutedForeground, fontSize: 9 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: colors.border, type: "dashed" } },
        axisLabel: { color: colors.mutedForeground, fontSize: 9 },
      },
      series: [
        {
          type: "bar",
          data: active.map((point) => ({
            value: point.net,
            itemStyle: {
              color: point.net < 0 ? colors.destructive : colors.primary,
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
      ],
    };
  }, [active, colors]);

  return (
    <Card bezel innerClassName="p-4">
      <Text className="text-sm font-medium text-muted-foreground">
        What you kept
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        Income minus everything else, month by month.
      </Text>

      {option ? (
        <>
          <EChart option={option} height={160} className="mt-3" />
          {best ? (
            <View className="mt-2 flex-row items-center justify-between">
              <Text variant="muted" className="text-xs">
                {isBestThisMonth ? "Best month so far" : `Best: ${best.label}`}
              </Text>
              <PrivateAmount
                className={cn(
                  "font-mono text-xs font-semibold",
                  best.net < 0 ? "text-destructive" : "text-success",
                )}
              >
                {formatEuro(best.net)}
              </PrivateAmount>
            </View>
          ) : null}
        </>
      ) : (
        <View className="mt-3 gap-2">
          <Text variant="muted" className="text-sm">
            {active.length === 0
              ? "Once you have a month of activity, it will show up here."
              : `${active.length} month${active.length === 1 ? "" : "s"} of history so far — this becomes a chart at ${MIN_MONTHS_FOR_CHART}.`}
          </Text>
          {active.map((point) => (
            <View
              key={point.monthKey}
              className="flex-row items-center justify-between"
            >
              <Text className="text-sm">{point.label}</Text>
              <PrivateAmount
                className={cn(
                  "font-mono text-sm font-semibold",
                  point.net < 0 ? "text-destructive" : "text-success",
                )}
              >
                {formatEuro(point.net)}
              </PrivateAmount>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
