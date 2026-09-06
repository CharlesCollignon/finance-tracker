import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useThemeColors } from "@/theme/useThemeColors";

interface SparklineProps {
  /** Oldest first. Two points draw a line; fewer draws nothing. */
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * The shape of the run, beside the figure it belongs to.
 *
 * No axis, no grid, no labels — the number next to it is the value, and this
 * only has to say which way it has been going. The last point is marked
 * because that is the one the figure states; without the dot the eye reads
 * the peak instead of the end.
 */
export function Sparkline({
  values,
  width = 72,
  height = 24,
  color,
}: SparklineProps) {
  const colors = useThemeColors();
  const stroke = color ?? colors.primary;

  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat run has no span to scale against, so it draws down the middle
  // rather than dividing by zero and collapsing onto the top edge.
  const span = max - min || 1;
  const inset = 2;
  const usable = height - inset * 2;

  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = inset + (1 - (value - min) / span) * usable;
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1]!;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={lastX} cy={lastY} r={2.2} fill={stroke} />
      </Svg>
    </View>
  );
}
