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
  /** What the bars are measured against. Defaults to the tallest. */
  peak?: number;
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
 * rather than the scale it happens to sit at. Months with nothing recorded
 * are drawn as gaps, because a charge that stopped is information.
 */
export function BarSeries({
  points,
  color = "var(--chart-1)",
  peak,
  className,
}: BarSeriesProps) {
  const formatMoney = useFormatCurrency();
  const scale =
    peak ?? points.reduce((max, p) => Math.max(max, p.value), 0) ?? 1;
  const ceiling = scale > 0 ? scale : 1;

  return (
    <div className={cn("flex items-end gap-1.5 sm:gap-2", className)}>
      {points.map((point) => {
        const share = Math.max(0, point.value) / ceiling;
        return (
          <div
            key={point.key}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-[0.65rem] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {point.empty ? "—" : formatMoney(point.value)}
            </span>
            <div className="flex h-32 w-full items-end sm:h-40">
              <div
                className={cn(
                  "w-full rounded-t transition-[height]",
                  point.empty && "border-t border-dashed border-border",
                )}
                style={{
                  height: point.empty ? 1 : `${Math.max(share * 100, 2)}%`,
                  backgroundColor: point.empty ? "transparent" : color,
                }}
              />
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
