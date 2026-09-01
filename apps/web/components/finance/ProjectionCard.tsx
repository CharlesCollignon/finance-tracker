"use client";

import { useId } from "react";
import type { ProjectionPoint, Runway } from "@finance/core/projection";
import { formatRunway, summarizeProjection } from "@finance/core/projection";
import { Card } from "@/components/retroui/Card";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

interface ProjectionCardProps {
  points: ProjectionPoint[];
  runway: Runway;
  startingBalance?: number;
}

/**
 * Where the months ahead lead.
 *
 * Because recurring templates are modelled properly, this is arithmetic
 * rather than a guess — which is why it says "if nothing changes" instead of
 * dressing itself up as a forecast. Discretionary spending is deliberately
 * excluded: an honest line the user can reconcile beats an invented one.
 */
export function ProjectionCard({
  points,
  runway,
  startingBalance = 0,
}: ProjectionCardProps) {
  const formatEuro = useFormatCurrency();
  const summary = summarizeProjection(points, startingBalance);
  const runwayLine = formatRunway(runway);

  if (!summary) {
    return null;
  }

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-head text-base">If nothing changes</h2>
        <p className="text-sm text-muted-foreground">
          Next {points.length} months
        </p>
      </div>

      <p
        className={cn(
          "mt-3 font-serif text-3xl font-semibold tabular-nums md:text-4xl",
          summary.shrinking ? "text-destructive" : "text-primary-ink",
        )}
      >
        <span className="privacy-amount">
          {formatEuro(summary.endingBalance)}
        </span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        by {summary.endLabel} ·{" "}
        <span className="tabular-nums">
          {summary.monthlyAverage >= 0 ? "+" : "−"}
          {formatEuro(Math.abs(summary.monthlyAverage))}
        </span>{" "}
        a month on average
      </p>

      <ProjectionSparkline points={points} />

      <p className="mt-3 text-sm text-muted-foreground">
        Recurring income and costs only — one-off spending is not guessed at.
      </p>

      {runwayLine ? (
        <p className="mt-4 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">
            Everything you have logged as savings covers{" "}
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {runwayLine.replace(/\.$/, "")}
          </span>
          <span className="text-muted-foreground">
            {" "}
            at {formatEuro(runway.monthlyCommitted)} a month.
          </span>
        </p>
      ) : null}
    </Card.Bezel>
  );
}

/**
 * A plain inline sparkline.
 *
 * Hand-drawn rather than pulled from the chart library because it carries one
 * series and no axes — loading ECharts for twelve points would cost more than
 * the picture is worth. Colour comes from `currentColor` so both themes work
 * without a second definition.
 */
function ProjectionSparkline({ points }: { points: ProjectionPoint[] }) {
  const gradientId = useId();

  if (points.length < 2) {
    return null;
  }

  const width = 100;
  const height = 28;
  const values = points.map((point) => point.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = `M${coords.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1]!.split(",");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Projected balance over ${points.length} months`}
      className="mt-4 h-16 w-full text-primary"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2"
        fill="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
