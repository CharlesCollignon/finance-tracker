"use client";

import { cn } from "@/lib/utils";
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { CHART_PALETTE, chartTextStyle } from "@/lib/echarts-theme";

export interface TreemapNode {
  name: string;
  value: number;
  fill?: string;
}

interface TreemapProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TreemapNode[];
  valueFormatter?: (value: number) => string;
  className?: string;
}

const Treemap = React.forwardRef<HTMLDivElement, TreemapProps>(
  (
    {
      data,
      valueFormatter = (value: number) => String(value),
      className,
      ...props
    },
    ref,
  ) => {
    const option = useMemo<EChartsOption>(() => {
      return {
        animationDuration: 350,
        tooltip: {
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          textStyle: {
            ...chartTextStyle(),
            color: "var(--foreground)",
          },
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number };
            return `${p.name}<br/><strong>${valueFormatter(p.value)}</strong>`;
          },
        },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              color: "var(--foreground)",
              fontSize: 11,
            },
            itemStyle: {
              borderColor: "var(--background)",
              borderWidth: 2,
              gapWidth: 2,
            },
            data: data.map((node, index) => ({
              name: node.name,
              value: node.value,
              itemStyle: {
                color: node.fill ?? CHART_PALETTE[index % CHART_PALETTE.length],
              },
            })),
          },
        ],
      };
    }, [data, valueFormatter]);

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

Treemap.displayName = "Treemap";

export { Treemap, type TreemapProps };
