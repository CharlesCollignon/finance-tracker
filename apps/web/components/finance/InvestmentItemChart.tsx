"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";
import { formatEuro } from "@finance/core/constants";
import {
  sliceChartPointsByRange,
  type PositionChartPoint,
  type PositionChartRange,
} from "@finance/core/investment-positions";
import {
  baseGrid,
  chartTextStyle,
  paddedValueAxisRange,
} from "@/lib/echarts-theme";
import { useEchartsSize } from "@/lib/use-echarts-size";

type ChartMode = "value" | "pl";

interface InvestmentItemChartProps {
  points: PositionChartPoint[];
  gainLoss: number;
  className?: string;
  /** Value/P/L toggle + range presets. Off for compact charts. */
  interactive?: boolean;
  /** Plot area height when interactive. */
  size?: "md" | "lg";
}

interface ChartRow extends PositionChartPoint {
  pl: number | null;
  plBase: number;
  plBand: number;
}

const RANGES: PositionChartRange[] = ["1M", "3M", "6M", "1Y", "All"];

export function InvestmentItemChart({
  points,
  gainLoss,
  className,
  interactive = false,
  size = "md",
}: InvestmentItemChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);
  const width = useEchartsSize(containerRef, chartRef);
  const [mode, setMode] = useState<ChartMode>("value");
  const [range, setRange] = useState<PositionChartRange>("1Y");

  const isPositive = gainLoss >= 0;
  const accent = isPositive ? "var(--chart-1)" : "var(--destructive)";

  const visiblePoints = useMemo(
    () => (interactive ? sliceChartPointsByRange(points, range) : points),
    [interactive, points, range],
  );

  const chartData = useMemo<ChartRow[]>(
    () =>
      visiblePoints.map((point) => {
        const pl =
          point.market == null
            ? null
            : Math.round((point.market - point.invested) * 100) / 100;

        if (point.market == null) {
          return { ...point, pl, plBase: 0, plBand: 0 };
        }

        const low = Math.min(point.invested, point.market);
        const high = Math.max(point.invested, point.market);

        return {
          ...point,
          pl,
          plBase: low,
          plBand: high - low,
        };
      }),
    [visiblePoints],
  );

  const option = useMemo<EChartsOption>(() => {
    const labels = chartData.map((row) => row.label);
    const axisLabel = {
      ...chartTextStyle(),
      formatter: (value: number) => formatAxisEuro(value),
    };

    if (mode === "pl") {
      const plRange = paddedValueAxisRange(chartData.map((row) => row.pl));
      return {
        animationDuration: 300,
        grid: baseGrid(),
        tooltip: {
          trigger: "axis",
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          textStyle: {
            ...chartTextStyle(),
            color: "var(--foreground)",
          },
          formatter: (params: unknown) => {
            const list = params as Array<{
              dataIndex: number;
              axisValue: string;
            }>;
            const idx = list[0]?.dataIndex ?? 0;
            const row = chartData[idx];
            if (!row) {
              return "";
            }
            const plText = row.pl == null ? "—" : formatSignedEuro(row.pl);
            return `${row.label}<br/>P/L: ${plText}`;
          },
        },
        xAxis: {
          type: "category",
          data: labels,
          boundaryGap: false,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            ...chartTextStyle(),
            hideOverlap: true,
          },
        },
        yAxis: {
          type: "value",
          min: plRange.min,
          max: plRange.max,
          scale: true,
          splitLine: {
            lineStyle: { color: "var(--border)", type: "dashed" },
          },
          axisLabel,
        },
        series: [
          {
            type: "line",
            data: chartData.map((row) => row.pl),
            showSymbol: false,
            connectNulls: false,
            lineStyle: { color: accent, width: 2 },
            areaStyle: { color: accent, opacity: 0.22 },
            itemStyle: { color: accent },
          },
        ],
      };
    }

    const valueRange = paddedValueAxisRange(
      chartData.flatMap((row) => [row.invested, row.market]),
    );

    return {
      animationDuration: 300,
      grid: baseGrid(),
      tooltip: {
        trigger: "axis",
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        textStyle: {
          ...chartTextStyle(),
          color: "var(--foreground)",
        },
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number }>;
          const idx = list[0]?.dataIndex ?? 0;
          const row = chartData[idx];
          if (!row) {
            return "";
          }
          const lines = [row.label, `Invested: ${formatEuro(row.invested)}`];
          if (row.market != null) {
            lines.push(`Market: ${formatEuro(row.market)}`);
          }
          if (row.pl != null) {
            lines.push(`P/L: ${formatSignedEuro(row.pl)}`);
          }
          return lines.join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          ...chartTextStyle(),
          hideOverlap: true,
        },
      },
      yAxis: {
        type: "value",
        min: valueRange.min,
        max: valueRange.max,
        scale: true,
        splitLine: {
          lineStyle: { color: "var(--border)", type: "dashed" },
        },
        axisLabel,
      },
      series: [
        ...(interactive
          ? [
              {
                type: "line" as const,
                data: chartData.map((row) => row.plBase),
                stack: "pl",
                showSymbol: false,
                lineStyle: { opacity: 0, width: 0 },
                areaStyle: { opacity: 0 },
                tooltip: { show: false },
                silent: true,
              },
              {
                type: "line" as const,
                data: chartData.map((row) => row.plBand),
                stack: "pl",
                showSymbol: false,
                lineStyle: { opacity: 0, width: 0 },
                areaStyle: { color: accent, opacity: 0.18 },
                tooltip: { show: false },
                silent: true,
              },
            ]
          : []),
        {
          type: "line",
          name: "invested",
          data: chartData.map((row) => row.invested),
          showSymbol: false,
          lineStyle: { color: "var(--foreground)", width: 2 },
          itemStyle: { color: "var(--foreground)" },
        },
        {
          type: "line",
          name: "market",
          data: chartData.map((row) => row.market),
          showSymbol: !interactive,
          symbolSize: 6,
          connectNulls: false,
          lineStyle: {
            color: accent,
            width: 2,
            type: interactive ? "solid" : "dashed",
          },
          itemStyle: { color: accent },
        },
      ],
    };
  }, [accent, chartData, interactive, mode]);

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex h-28 items-end text-xs text-muted-foreground",
          className,
        )}
      >
        No chart yet
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      {interactive && (
        <div className="mb-2 flex min-w-0 flex-col gap-2">
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="tablist"
            aria-label="Chart mode"
          >
            <ModeButton
              active={mode === "value"}
              onClick={() => setMode("value")}
            >
              Value
            </ModeButton>
            <ModeButton active={mode === "pl"} onClick={() => setMode("pl")}>
              P/L
            </ModeButton>
          </div>

          <div
            className="flex min-w-0 flex-wrap gap-1"
            role="group"
            aria-label="Chart range"
          >
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  range === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <ChartLegend mode={mode} accent={accent} />
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          "min-w-0 max-w-full overflow-hidden",
          !interactive && "h-full min-h-24",
          interactive && size === "md" && "h-40",
          interactive && size === "lg" && "h-56 md:h-64",
        )}
      >
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{
            height: "100%",
            width: width != null && width > 0 ? width : "100%",
          }}
          opts={{ renderer: "svg" }}
          notMerge
        />
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ChartLegend({ mode, accent }: { mode: ChartMode; accent: string }) {
  if (mode === "pl") {
    return (
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <LegendSwatch color={accent} label="Unrealised P/L" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <LegendSwatch color="var(--foreground)" label="Invested" />
      <LegendSwatch color={accent} label="Market value" />
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function formatAxisEuro(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(Math.round(value));
}

function formatSignedEuro(amount: number): string {
  const formatted = formatEuro(Math.abs(amount));
  if (amount > 0) {
    return `+${formatted}`;
  }
  if (amount < 0) {
    return `-${formatted}`;
  }
  return formatted;
}
