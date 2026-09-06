import { useMemo } from "react";
import { View } from "react-native";

import type { MonthlyTrendPoint } from "@/lib/queries";

import { BarSeries } from "@/components/charts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";

/** Below this a "trend" would be a straight line between two dots. */
const MIN_MONTHS_FOR_CHART = 3;

/** A plausible run, drawn faintly to hold the chart's space before it exists. */
const GHOST = [38, 52, 31, 64, 45, 58];

export type TrendRange = "6M" | "1Y" | "2Y";

/** Months each range asks the query for. */
export const TREND_RANGE_MONTHS: Record<TrendRange, number> = {
  "6M": 6,
  "1Y": 12,
  "2Y": 24,
};

const TREND_RANGES: TrendRange[] = ["6M", "1Y", "2Y"];

interface TrendCardProps {
  points: MonthlyTrendPoint[];
  range: TrendRange;
  onRangeChange: (next: TrendRange) => void;
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
export function TrendCard({ points, range, onRangeChange }: TrendCardProps) {
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
    <Card bezel innerClassName="p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label">What you kept</Text>
        <SegmentedControl
          label="Trend range"
          value={range}
          onChange={onRangeChange}
          segments={TREND_RANGES.map((key) => ({ value: key, label: key }))}
          className="w-40"
        />
      </View>

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
        /*
          Not enough months to be a trend, so the card keeps its shape and
          says what is missing. A placeholder run drawn at low contrast holds
          the space the real chart will take: the screen does not reflow the
          first time a third month lands, and the badge says why it is grey.
        */
        <View className="mt-4 gap-3">
          <View className="relative">
            <View className="opacity-[0.14]">
              <BarSeries
                height={140}
                points={GHOST.map((value, index) => ({
                  key: `ghost-${index}`,
                  label: "",
                  value,
                }))}
              />
            </View>
            <View className="absolute inset-0 items-center justify-center">
              <View className="rounded-full border border-border bg-card px-3 py-1.5">
                <Text variant="micro">
                  {`${active.length} of ${MIN_MONTHS_FOR_CHART} months`}
                </Text>
              </View>
            </View>
          </View>

          {active.map((point) => (
            <View
              key={point.monthKey}
              className="flex-row items-center justify-between"
            >
              <Text variant="micro">{point.label}</Text>
              <PrivateAmount
                className={cn(
                  "font-mono text-xs font-semibold",
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
