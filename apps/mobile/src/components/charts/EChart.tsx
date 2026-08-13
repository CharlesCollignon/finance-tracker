import { useEffect, useRef } from "react";
import { View, type ViewProps, useColorScheme } from "react-native";
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
 */
export function EChart({
  option,
  height = 220,
  className,
  ...props
}: EChartProps) {
  const svgRef = useRef(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const colorScheme = useColorScheme();
  const scheme = colorScheme === "light" ? "light" : "dark";

  useEffect(() => {
    let chart: echarts.EChartsType | undefined;
    if (svgRef.current) {
      chart = echarts.init(svgRef.current, undefined, {
        renderer: "svg",
        height,
      });
      chartRef.current = chart;
    }
    return () => {
      chart?.dispose();
      chartRef.current = null;
    };
  }, [height]);

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
  }, [option, scheme]);

  return (
    <View className={cn("w-full overflow-hidden", className)} {...props}>
      <SvgChart ref={svgRef} />
    </View>
  );
}
