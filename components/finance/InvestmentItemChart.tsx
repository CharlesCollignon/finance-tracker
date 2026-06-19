"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEuro } from "@/lib/constants";
import type { PositionChartPoint } from "@/lib/investment-positions";

interface InvestmentItemChartProps {
  points: PositionChartPoint[];
  gainLoss: number;
  className?: string;
}

interface ChartRow extends PositionChartPoint {
  plBase: number;
  plBand: number;
}

export function InvestmentItemChart({
  points,
  gainLoss,
  className,
}: InvestmentItemChartProps) {
  const isPositive = gainLoss >= 0;
  const fillColor = isPositive ? "var(--chart-4)" : "var(--destructive)";

  const chartData = useMemo<ChartRow[]>(
    () =>
      points.map((point) => {
        if (point.market == null) {
          return { ...point, plBase: 0, plBand: 0 };
        }

        const low = Math.min(point.invested, point.market);
        const high = Math.max(point.invested, point.market);

        return {
          ...point,
          plBase: low,
          plBand: high - low,
        };
      }),
    [points],
  );

  return (
    <div className={cn("h-40 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            className="text-[10px] fill-muted-foreground"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={48}
            className="text-[10px] fill-muted-foreground"
            tickFormatter={(value) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const invested = payload.find(
                (entry) => entry.dataKey === "invested",
              );
              const market = payload.find(
                (entry) => entry.dataKey === "market",
              );

              return (
                <div
                  className="border-2 border-border bg-background p-2 text-xs"
                  style={{ fontSize: "12px" }}
                >
                  <p className="mb-1 font-medium">{label}</p>
                  {invested && (
                    <p>
                      Your wallet:{" "}
                      {formatEuro(Number(invested.value ?? 0))}
                    </p>
                  )}
                  {market && market.value != null && (
                    <p>
                      Market value: {formatEuro(Number(market.value))}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="plBase"
            stackId="pl"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="plBand"
            stackId="pl"
            stroke={fillColor}
            fill={fillColor}
            fillOpacity={0.22}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="invested"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={false}
            name="invested"
          />
          <Line
            type="monotone"
            dataKey="market"
            stroke={fillColor}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: fillColor }}
            connectNulls={false}
            name="market"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
