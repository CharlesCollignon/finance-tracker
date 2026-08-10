"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { formatEuro } from "@finance/core/constants";
import {
  sliceChartPointsByRange,
  type PositionChartPoint,
  type PositionChartRange,
} from "@finance/core/investment-positions";

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
  const [mode, setMode] = useState<ChartMode>("value");
  const [range, setRange] = useState<PositionChartRange>("1Y");

  const isPositive = gainLoss >= 0;
  const accent = isPositive ? "var(--chart-4)" : "var(--destructive)";

  const visiblePoints = useMemo(
    () =>
      interactive ? sliceChartPointsByRange(points, range) : points,
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
    <div className={cn("w-full", className)}>
      {interactive && (
        <div className="mb-2 flex flex-col gap-2">
          <div
            className="flex rounded border-2 border-border p-0.5"
            role="tablist"
            aria-label="Chart mode"
          >
            <ModeButton
              active={mode === "value"}
              onClick={() => setMode("value")}
            >
              Value
            </ModeButton>
            <ModeButton
              active={mode === "pl"}
              onClick={() => setMode("pl")}
            >
              P/L
            </ModeButton>
          </div>

          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Chart range"
          >
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={cn(
                  "rounded border-2 px-2 py-0.5 text-[11px] font-medium transition-colors",
                  range === option
                    ? "border-foreground bg-foreground text-background"
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
        className={cn(
          !interactive && "h-full min-h-24",
          interactive && size === "md" && "h-40",
          interactive && size === "lg" && "h-56 md:h-64",
        )}
      >
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
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={48}
              className="text-[10px] fill-muted-foreground"
              tickFormatter={formatAxisEuro}
              domain={mode === "pl" ? ["auto", "auto"] : undefined}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) {
                  return null;
                }

                const row = payload[0]?.payload as ChartRow | undefined;
                if (!row) {
                  return null;
                }

                return (
                  <div className="border-2 border-border bg-background p-2 text-xs">
                    <p className="mb-1 font-medium">{label}</p>
                    {mode === "value" ? (
                      <>
                        <p>
                          Invested: {formatEuro(row.invested)}
                        </p>
                        {row.market != null && (
                          <p>
                            Market: {formatEuro(row.market)}
                          </p>
                        )}
                        {row.pl != null && (
                          <p
                            className={cn(
                              row.pl > 0 && "text-[var(--chart-4)]",
                              row.pl < 0 && "text-destructive",
                            )}
                          >
                            P/L: {formatSignedEuro(row.pl)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p
                        className={cn(
                          row.pl != null &&
                            row.pl > 0 &&
                            "text-[var(--chart-4)]",
                          row.pl != null &&
                            row.pl < 0 &&
                            "text-destructive",
                        )}
                      >
                        P/L:{" "}
                        {row.pl == null
                          ? "—"
                          : formatSignedEuro(row.pl)}
                      </p>
                    )}
                  </div>
                );
              }}
            />

            {mode === "value" ? (
              <>
                {interactive && (
                  <>
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
                      stroke="none"
                      fill={accent}
                      fillOpacity={0.18}
                      isAnimationActive={false}
                    />
                  </>
                )}
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
                  stroke={accent}
                  strokeWidth={2}
                  strokeDasharray={interactive ? undefined : "5 4"}
                  dot={
                    interactive
                      ? false
                      : { r: 3, fill: accent }
                  }
                  connectNulls={false}
                  name="market"
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="pl"
                  stroke={accent}
                  fill={accent}
                  fillOpacity={0.22}
                  strokeWidth={2}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="pl"
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
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
        "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ChartLegend({
  mode,
  accent,
}: {
  mode: ChartMode;
  accent: string;
}) {
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

function LegendSwatch({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
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
