"use client";

import { cn } from "@/lib/utils";
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { baseGrid, chartTextStyle, CHART_PALETTE } from "@/lib/echarts-theme";

interface LineChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  stroke?: string;
  className?: string;
}

export const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>(
  (
    { data = [], xKey, yKey, stroke = CHART_PALETTE[0], className, ...props },
    ref,
  ) => {
    const option = useMemo<EChartsOption>(() => {
      const categories = data.map((row) => String(row[xKey] ?? ""));
      const values = data.map((row) => Number(row[yKey] ?? 0));

      return {
        animationDuration: 350,
        grid: baseGrid(),
        xAxis: {
          type: "category",
          data: categories,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: chartTextStyle(),
        },
        yAxis: {
          type: "value",
          splitLine: {
            lineStyle: { color: "var(--border)", type: "dashed" },
          },
          axisLabel: chartTextStyle(),
        },
        series: [
          {
            type: "line",
            data: values,
            showSymbol: false,
            smooth: 0.2,
            lineStyle: { color: stroke, width: 2 },
            itemStyle: { color: stroke },
          },
        ],
      };
    }, [data, stroke, xKey, yKey]);

    return (
      <div ref={ref} className={cn("h-80 w-full", className)} {...props}>
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>
    );
  },
);

LineChart.displayName = "LineChart";
