"use client";

import { cn } from "@/lib/utils";
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { CHART_PALETTE, chartTextStyle } from "@/lib/echarts-theme";

interface PieChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showTooltip?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
}

const PieChart = React.forwardRef<HTMLDivElement, PieChartProps>(
  (
    {
      data = [],
      dataKey,
      nameKey,
      colors = [...CHART_PALETTE],
      valueFormatter = (value: number) => value.toString(),
      showTooltip = true,
      innerRadius = 0,
      outerRadius = 100,
      className,
      ...props
    },
    ref,
  ) => {
    const option = useMemo<EChartsOption>(() => {
      const seriesData = data.map((row, index) => ({
        name: String(row[nameKey] ?? ""),
        value: Number(row[dataKey] ?? 0),
        itemStyle: {
          color: colors[index % colors.length],
        },
      }));

      const maxRadius = Math.max(outerRadius, 1);
      const outerPct = "70%";
      const innerPct =
        innerRadius > 0
          ? `${Math.round((innerRadius / maxRadius) * 70)}%`
          : "0%";

      return {
        animationDuration: 400,
        tooltip: showTooltip
          ? {
              trigger: "item",
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              textStyle: {
                ...chartTextStyle(),
                color: "var(--foreground)",
              },
              formatter: (params: unknown) => {
                const p = params as {
                  name: string;
                  value: number;
                };
                return `${p.name}<br/><strong>${valueFormatter(p.value)}</strong>`;
              },
            }
          : undefined,
        series: [
          {
            type: "pie",
            radius: [innerPct, outerPct],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            label: { show: false },
            labelLine: { show: false },
            data: seriesData,
          },
        ],
      };
    }, [
      colors,
      data,
      dataKey,
      innerRadius,
      nameKey,
      outerRadius,
      showTooltip,
      valueFormatter,
    ]);

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

PieChart.displayName = "PieChart";

export { PieChart, type PieChartProps };
