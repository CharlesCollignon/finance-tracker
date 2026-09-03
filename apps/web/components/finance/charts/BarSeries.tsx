"use client";

import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

export interface BarPoint {
  key: string;
  /** Axis label, kept short enough for twelve of them to fit. */
  label: string;
  value: number;
  /** Nothing was recorded, as against recorded as zero. */
  empty?: boolean;
}

interface BarSeriesProps {
  points: BarPoint[];
  /** Chart token, e.g. "var(--chart-1)". */
  color?: string;
  /**
   * Let the series cross zero, with a baseline and bars hanging below it.
   * Off by default: a run of spending never goes negative, and reserving room
   * under a baseline that is never used wastes half the chart.
   */
  signed?: boolean;
  className?: string;
}

/**
 * One series, as bars.
 *
 * Drawn in plain elements rather than through a charting runtime: a dozen
 * bars need no axis engine, no tooltip layer and no zoom, and doing it this
 * way keeps the page server-rendered and costs nothing on a phone. The
 * runtime is reserved for the one mark that earns it — a dense time series
 * you want to hover — which lives on Wallets.
 *
 * Scaled against the series' own peak, so what shows is the shape of the run
 * rather than the scale it happens to sit at. Periods with nothing recorded
 * are drawn as gaps, because a charge that stopped is information.
 */
export function BarSeries({
  points,
  color = "var(--chart-1)",
  signed = false,
  className,
}: BarSeriesProps) {
  const formatMoney = useFormatCurrency();

  const up = points.reduce((max, p) => Math.max(max, p.value), 0);
  const down = signed
    ? points.reduce((max, p) => Math.max(max, -p.value), 0)
    : 0;
  const span = up + down || 1;
  // The baseline sits where zero falls between the two peaks, so a month that
  // lost a little does not draw the same bar as one that lost everything.
  const above = (up / span) * 100;

  return (
    <div className={cn("flex items-end gap-1.5 sm:gap-2", className)}>
      {points.map((point) => {
        const size = Math.max((Math.abs(point.value) / span) * 100, 2);
        return (
          <div
            key={point.key}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-[0.65rem] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {point.empty ? "—" : formatMoney(point.value)}
            </span>
            <div className="h-32 w-full sm:h-40">
              <div
                className="flex w-full items-end"
                style={{ height: `${above}%` }}
              >
                {point.empty ? (
                  <div className="w-full border-t border-dashed border-border" />
                ) : point.value > 0 ? (
                  <div
                    className="w-full rounded-t transition-[height]"
                    style={{ height: `${size}%`, backgroundColor: color }}
                  />
                ) : null}
              </div>
              {above < 100 ? (
                <div className="w-full" style={{ height: `${100 - above}%` }}>
                  {!point.empty && point.value < 0 ? (
                    <div
                      className="w-full rounded-b bg-destructive transition-[height]"
                      style={{ height: `${size}%` }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="truncate text-[0.65rem] text-muted-foreground">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
