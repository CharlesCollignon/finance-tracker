import { useId, useMemo, useState } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

/**
 * An instrument's price over a year, drawn faintly behind its row — the
 * line of the fund or the share itself, not of what the user made on it.
 * Decoration that informs: no axis, no figure, nothing to touch. Sized to
 * whatever box it is given, and nothing at all below two points.
 */
export function PriceSparkline({
  values,
  color,
  style,
}: {
  values: readonly number[];
  color: string;
  style?: ViewStyle;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [size, setSize] = useState({ width: 0, height: 0 });

  const paths = useMemo(() => {
    if (values.length < 2 || size.width === 0 || size.height === 0) {
      return null;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    // A little room top and bottom, so the line never runs on the box's edge.
    const pad = 3;
    const usable = size.height - pad * 2;
    const points = values.map((value, index) => ({
      x: (index / (values.length - 1)) * size.width,
      y: pad + usable - ((value - min) / span) * usable,
    }));
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ");
    const area = `${line} L${size.width},${size.height} L0,${size.height} Z`;
    return { line, area };
  }, [values, size]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute" }, style]}
      onLayout={(event) =>
        setSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
    >
      {paths ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.12} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={paths.area} fill={`url(#${id}-fill)`} />
          <Path
            d={paths.line}
            stroke={color}
            strokeOpacity={0.4}
            strokeWidth={1.25}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}
