import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  type LayoutChangeEvent,
  type ViewProps,
  useColorScheme,
} from "react-native";
import * as echarts from "echarts/core";
import { LineChart, PieChart, SankeyChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import SvgChart, {
  SVGRenderer,
} from "@wuba/react-native-echarts/svgChart";
import type { EChartsCoreOption } from "echarts/core";

import { cn } from "@/lib/cn";
import { chartPalette, chartTextColor } from "@/theme/echarts";

echarts.use([
  SVGRenderer,
  LineChart,
  PieChart,
  SankeyChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

export interface EChartProps extends ViewProps {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
}

/**
 * Theme-aware ECharts host for future chart screens.
 * Uses SVG renderer (Expo-friendly); series colors default to gold/gray.
 *
 * The chart is created only once the container has been measured. SvgChart
 * reports its own size back to the renderer, and with no explicit width that
 * size is 0, which makes ECharts build a null coordinate transform and throw
 * while laying out (fatal on Hermes). So we measure first, then init.
 */
export function EChart({
  option,
  height = 220,
  className,
  onLayout,
  ...props
}: EChartProps) {
  const svgRef = useRef(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const colorScheme = useColorScheme();
  const scheme = colorScheme === "light" ? "light" : "dark";
  const [width, setWidth] = useState(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      setWidth((prev) => (prev === next ? prev : next));
      onLayout?.(event);
    },
    [onLayout],
  );

  useEffect(() => {
    if (!svgRef.current || width <= 0) {
      return;
    }
    const chart = echarts.init(svgRef.current, undefined, {
      renderer: "svg",
      width,
      height,
    });
    chartRef.current = chart;
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const palette = chartPalette(scheme);
    const textColor = chartTextColor(scheme);
    chart.setOption(
      {
        color: palette,
        textStyle: { color: textColor },
        ...option,
      },
      { notMerge: true },
    );
  }, [option, scheme, width, height]);

  return (
    <View
      className={cn("w-full overflow-hidden", className)}
      onLayout={handleLayout}
      style={{ height }}
      {...props}
    >
      {width > 0 ? (
        <SvgChart ref={svgRef} style={{ width, height }} />
      ) : null}
    </View>
  );
}
