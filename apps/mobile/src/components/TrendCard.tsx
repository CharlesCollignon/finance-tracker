import { useMemo } from "react";
import { View } from "react-native";

import type { MonthlyTrendPoint } from "@/lib/queries";

import { BarSeries } from "@/components/charts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";

/** Below this a "trend" would be a straight line between two dots. */
const MIN_MONTHS_FOR_CHART = 3;

interface TrendCardProps {
  points: MonthlyTrendPoint[];
}

/**
 * Net per month over the last half-year.
 *
 * Deliberately honest about thin data: with fewer than three months that have
 * activity it says so and lists the months it does have, rather than drawing
 * a shape that implies a trend which isn't there yet.
 *
 * Drawn with the shared bar mark rather than a chart runtime. It was an
 * ECharts bar chart, which was the whole reason this screen mounted one — a
 * few dozen kilobytes and a canvas to draw six rectangles.
 */
export function TrendCard({ points }: TrendCardProps) {
  const formatEuro = useFormatCurrency();

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

  const enough = active.length >= MIN_MONTHS_FOR_CHART;

  return (
    <Card bezel innerClassName="p-4">
      <Text className="text-sm font-medium text-muted-foreground">
        What you kept
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        Income minus everything else, month by month.
      </Text>

      {enough ? (
        <>
          <BarSeries
            className="mt-4"
            height={140}
            signed
            points={active.map((point) => ({
              key: point.monthKey,
              label: point.label.split(" ")[0] ?? point.label,
              value: point.net,
            }))}
          />
          {best ? (
            <View className="mt-3 flex-row items-center justify-between">
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
