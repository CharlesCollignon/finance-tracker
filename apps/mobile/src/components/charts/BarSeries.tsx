import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

export interface BarPoint {
  key: string;
  /** Axis label, kept short enough for a dozen of them to fit. */
  label: string;
  value: number;
  /** Nothing was recorded, as against recorded as zero. */
  empty?: boolean;
}

interface BarSeriesProps {
  points: BarPoint[];
  color?: string;
  /**
   * Let the series cross zero, with a baseline and bars hanging below it.
   * Off by default: a run of spending never goes negative, and reserving room
   * under a baseline that is never used wastes half the chart.
   */
  signed?: boolean;
  height?: number;
  className?: string;
}

/**
 * One series, as bars.
 *
 * Plain views rather than a chart runtime: a dozen bars need no axis engine,
 * no tooltip layer and no zoom, and this version costs nothing to mount. The
 * runtime is reserved for the one mark that earns it — a dense time series
 * worth scrubbing — which lives on Wallets.
 *
 * Scaled against the series' own peak, so what shows is the shape of the run
 * rather than the scale it happens to sit at. Periods with nothing recorded
 * are drawn as a dashed floor, because a charge that stopped is information
 * and a zero-height bar looks like a rendering fault.
 */
export function BarSeries({
  points,
  color,
  signed = false,
  height = 128,
  className,
}: BarSeriesProps) {
  const colors = useThemeColors();
  const fill = color ?? colors.primary;

  const up = points.reduce((max, p) => Math.max(max, p.value), 0);
  const down = signed
    ? points.reduce((max, p) => Math.max(max, -p.value), 0)
    : 0;
  const span = up + down || 1;
  // The baseline sits where zero falls between the two peaks, so a month that
  // lost a little does not draw the same bar as one that lost everything.
  const above = Math.round((height * up) / span);
  const below = height - above;

  return (
    <View className={cn("flex-row items-end gap-1.5", className)}>
      {points.map((point) => {
        const size = Math.max((Math.abs(point.value) / span) * height, 2);
        return (
          <View key={point.key} className="min-w-0 flex-1 items-center gap-1.5">
            <View style={{ height }} className="w-full">
              <View className="w-full justify-end" style={{ height: above }}>
                {!point.empty && point.value > 0 ? (
                  <View
                    className="w-full rounded-t"
                    style={{ height: size, backgroundColor: fill }}
                  />
                ) : null}
                {point.empty ? (
                  <View
                    className="w-full border-t border-dashed"
                    style={{ borderColor: colors.border }}
                  />
                ) : null}
              </View>
              {below > 0 ? (
                <View className="w-full" style={{ height: below }}>
                  {!point.empty && point.value < 0 ? (
                    <View
                      className="w-full rounded-b"
                      style={{
                        height: size,
                        backgroundColor: colors.destructive,
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className="text-[10px] text-muted-foreground"
            >
              {point.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
