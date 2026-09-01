import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import {
  formatRunway,
  summarizeProjection,
  type ProjectionPoint,
  type Runway,
} from "@finance/core/projection";

import { Card } from "@/components/ui/Card";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface ProjectionCardProps {
  points: ProjectionPoint[];
  runway: Runway | null;
  startingBalance?: number;
}

/**
 * Where the months ahead lead.
 *
 * Because recurring templates are modelled properly this is arithmetic rather
 * than a guess, which is why it says "if nothing changes" instead of dressing
 * itself up as a forecast. Discretionary spending is left out on purpose: an
 * honest line the user can reconcile beats an invented one.
 */
export function ProjectionCard({
  points,
  runway,
  startingBalance = 0,
}: ProjectionCardProps) {
  const formatEuro = useFormatCurrency();
  const summary = summarizeProjection(points, startingBalance);
  const runwayLine = runway ? formatRunway(runway) : null;

  if (!summary) {
    return null;
  }

  return (
    <Card bezel innerClassName="gap-2 p-5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text className="font-bold">If nothing changes</Text>
        <Text variant="muted" className="text-xs">
          {`Next ${points.length} months`}
        </Text>
      </View>

      <PrivateAmount
        className={cn(
          "font-mono font-bold",
          summary.shrinking ? "text-destructive" : "text-primary-ink",
        )}
        style={{ fontSize: 28 }}
      >
        {formatEuro(summary.endingBalance)}
      </PrivateAmount>

      <Text variant="muted" className="text-sm">
        {`by ${summary.endLabel} · ${summary.monthlyAverage >= 0 ? "+" : "−"}${formatEuro(
          Math.abs(summary.monthlyAverage),
        )} a month on average`}
      </Text>

      <ProjectionSparkline points={points} />

      <Text variant="muted" className="text-xs">
        Recurring income and costs only — one-off spending is not guessed at.
      </Text>

      {runwayLine && runway ? (
        <View className="border-t border-border pt-3">
          <Text variant="muted" className="text-sm">
            {"Everything you have logged as savings covers "}
            <Text className="font-medium text-foreground">
              {runwayLine.replace(/\.$/, "")}
            </Text>
            {` at ${formatEuro(runway.monthlyCommitted)} a month.`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * One series, no axes — drawn by hand rather than through the chart library,
 * which would cost more than the picture is worth for twelve points.
 */
function ProjectionSparkline({ points }: { points: ProjectionPoint[] }) {
  const colors = useThemeColors();

  if (points.length < 2) {
    return null;
  }

  const width = 100;
  const height = 28;
  const values = points.map((point) => point.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return { x, y };
  });

  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1]!;

  return (
    <View className="my-1 h-16 w-full">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="projectionFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#projectionFill)" />
        <Path
          d={line}
          fill="none"
          stroke={colors.primary}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <Circle
          cx={last.x}
          cy={last.y}
          r={2}
          fill={colors.primary}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}
