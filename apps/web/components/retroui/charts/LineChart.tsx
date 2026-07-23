"use client";

import { cn } from "@/lib/utils";
import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LineChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: object[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showGrid?: boolean;
  className?: string;
}

export const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>(
  (
    {
      data = [],
      index,
      categories = [],
      colors = ["var(--chart-3)", "var(--chart-4)", "var(--chart-5)"],
      valueFormatter = (value: number) => value.toString(),
      showGrid = true,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn("h-80 w-full", className)} {...props}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          >
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
            )}
            <XAxis
              dataKey={index}
              axisLine={false}
              tickLine={false}
              className="text-xs fill-muted-foreground"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs fill-muted-foreground"
              tickFormatter={valueFormatter}
            />
            <Tooltip
              formatter={(value) =>
                valueFormatter(Number(value ?? 0))
              }
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "2px solid var(--border)",
                borderRadius: 0,
              }}
            />
            {categories.map((category, indexValue) => (
              <Line
                key={category}
                type="monotone"
                dataKey={category}
                stroke={colors[indexValue % colors.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

LineChart.displayName = "LineChart";
