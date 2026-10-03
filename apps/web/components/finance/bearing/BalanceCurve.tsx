"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  gapShapes,
  type MonthBalancePoint,
} from "@finance/core/month-balance";
import { formatShortDate } from "@finance/core/constants";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

interface BalanceCurveProps {
  points: MonthBalancePoint[];
  /**
   * The month as planned from its first day, one value per point — drawn as
   * a thin line, with the gap between it and the balance washed in: green
   * where the account is above the plan, red where it is below.
   */
  plan?: number[] | null;
  /** Today, when it falls in the month: where the line stops being recorded. */
  today: string | null;
  format: (value: number) => string;
  /** What the line is, for the chart's accessible name. */
  label: string;
  className?: string;
}

/** The plot's height in pixels; its width is whatever the card gives it. */
const HEIGHT = 168;
/** Room above and below the line, so the end dot and a low point are not cut. */
const PAD_Y = 14;
/** The x axis in the SVG's own units, stretched to the card's width. */
const SPAN = 1000;

/**
 * The month's balance, one point a day: solid where it has happened, dashed
 * where it is only the charges' arithmetic.
 *
 * A single series, so no legend box beyond the solid/dashed key — the card
 * names it — and one colour, the accent, because this is the figure the
 * screen is opened for. Two dots at most: today and the month's end, the two
 * places a reader looks. Everything else is on the crosshair, which follows
 * the pointer or the arrow keys to the nearest day and reads that day's
 * balance out, to a screen reader as well.
 *
 * Drawn in relative units and stretched to the card, with the strokes kept
 * at their width by `non-scaling-stroke` and the dots placed in HTML, so the
 * line is in the server's HTML and there when the card appears rather than
 * after a measurement.
 */
export function BalanceCurve({
  points,
  plan = null,
  today,
  format,
  label,
  className,
}: BalanceCurveProps) {
  const t = useT();
  const locale = useLocale();
  const titleId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) {
      return null;
    }
    const values = points.map((point) => point.value);
    const planned = plan && plan.length === points.length ? plan : null;
    let min = Math.min(...values, ...(planned ?? []), 0);
    let max = Math.max(...values, ...(planned ?? []), 0);
    // A flat month still needs a height to draw in.
    if (max - min < 1) {
      max += 1;
      min -= 1;
    }
    const last = Math.max(1, points.length - 1);
    // x as a fraction of the width, y in pixels.
    const x = (index: number) => index / last;
    const y = (value: number) =>
      PAD_Y + ((max - value) / (max - min)) * (HEIGHT - PAD_Y * 2);

    const todayIndex = today
      ? points.findIndex((point) => point.date === today)
      : -1;
    const lastRecorded =
      todayIndex >= 0
        ? todayIndex
        : points.every((point) => point.planned)
          ? -1
          : points.length - 1;

    const path = (from: number, to: number) =>
      points
        .slice(from, to + 1)
        .map(
          (point, offset) =>
            `${offset === 0 ? "M" : "L"}${(x(from + offset) * SPAN).toFixed(1)},${y(point.value).toFixed(1)}`,
        )
        .join(" ");

    // The gap to the plan, washed in: one path for where the balance is
    // above it, one for below (`gapShapes`, split where the lines cross).
    const gap = { above: "", below: "" };
    let planLine = "";
    if (planned) {
      const px = (index: number) => (x(index) * SPAN).toFixed(1);
      planLine = planned
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${px(index)},${y(value).toFixed(1)}`,
        )
        .join(" ");
      for (const shape of gapShapes(values, planned)) {
        const d = `M${shape.corners
          .map(([day, value]) => `${px(day)},${y(value).toFixed(1)}`)
          .join(" L")} Z `;
        if (shape.above) {
          gap.above += d;
        } else {
          gap.below += d;
        }
      }
    }

    return {
      x,
      y,
      gap,
      planLine,
      solid: lastRecorded >= 0 ? path(0, lastRecorded) : "",
      dashed:
        lastRecorded < points.length - 1
          ? path(Math.max(0, lastRecorded), points.length - 1)
          : "",
      area: `${path(0, points.length - 1)} L${SPAN},${y(min).toFixed(1)} L0,${y(min).toFixed(1)} Z`,
      zeroY: min < 0 && max > 0 ? y(0) : null,
      todayIndex,
    };
  }, [points, plan, today]);

  function nearest(clientX: number): number {
    const frame = frameRef.current;
    if (!frame || points.length === 0) {
      return 0;
    }
    const rect = frame.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(
      points.length - 1,
      Math.max(0, Math.round(ratio * (points.length - 1))),
    );
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const start = active ?? Math.max(0, geometry?.todayIndex ?? 0);
    setActive(
      Math.min(
        points.length - 1,
        Math.max(0, start + (event.key === "ArrowRight" ? 1 : -1)),
      ),
    );
  }

  const lastIndex = points.length - 1;
  const endPoint = points[lastIndex];
  const shown = active !== null ? points[active] : null;
  const shownPlan =
    active !== null && plan && plan.length === points.length
      ? plan[active]!
      : null;
  const shownGap =
    shown && shownPlan !== null
      ? Math.round((shown.value - shownPlan) * 100) / 100
      : null;
  const gapText = (gap: number) =>
    gap >= 0
      ? t("bearingMonth.gapAbove", { amount: format(gap) })
      : t("bearingMonth.gapBelow", { amount: format(-gap) });
  const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={frameRef}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onPointerMove={(event: PointerEvent<HTMLDivElement>) =>
          setActive(nearest(event.clientX))
        }
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={handleKey}
        className={cn(
          "relative w-full touch-pan-y select-none rounded-control outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        )}
        style={{ height: HEIGHT }}
      >
        <span id={titleId} className="sr-only">
          {label}
        </span>

        {geometry ? (
          <>
            <svg
              viewBox={`0 0 ${SPAN} ${HEIGHT}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              <defs>
                <linearGradient
                  id={`${titleId}-wash`}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--primary)"
                    stopOpacity="0.16"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--primary)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>

              {geometry.zeroY !== null ? (
                <line
                  x1={0}
                  x2={SPAN}
                  y1={geometry.zeroY}
                  y2={geometry.zeroY}
                  stroke="var(--hairline-strong)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              <path
                d={geometry.area}
                fill={`url(#${titleId}-wash)`}
                className="balance-curve-wash"
              />
              {geometry.planLine ? (
                <>
                  <path
                    d={geometry.gap.above}
                    fill="var(--success)"
                    fillOpacity={0.16}
                    className="balance-curve-fade"
                  />
                  <path
                    d={geometry.gap.below}
                    fill="var(--destructive)"
                    fillOpacity={0.16}
                    className="balance-curve-fade"
                  />
                  <path
                    d={geometry.planLine}
                    fill="none"
                    stroke="var(--muted-foreground)"
                    strokeOpacity={0.7}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="balance-curve-fade"
                  />
                </>
              ) : null}
              {geometry.solid ? (
                <path
                  d={geometry.solid}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="balance-curve-draw"
                />
              ) : null}
              {geometry.dashed ? (
                <path
                  d={geometry.dashed}
                  fill="none"
                  stroke="var(--primary)"
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="balance-curve-fade"
                />
              ) : null}
            </svg>

            {/* Today, and where the month ends: the two places a reader
                looks, each a dot with a ring of the card behind it. In HTML
                rather than the stretched SVG, so they stay round. */}
            {geometry.todayIndex >= 0 ? (
              <Dot
                left={percent(geometry.x(geometry.todayIndex))}
                top={geometry.y(points[geometry.todayIndex]!.value)}
                className="balance-curve-today size-3 bg-primary"
              />
            ) : null}
            {endPoint && lastIndex !== geometry.todayIndex ? (
              <Dot
                left={percent(geometry.x(lastIndex))}
                top={geometry.y(endPoint.value)}
                className={cn(
                  "balance-curve-fade size-2.5 border-2 border-primary",
                  endPoint.planned ? "bg-card" : "bg-primary",
                )}
              />
            ) : null}

            {active !== null && shown ? (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 w-px bg-hairline-strong"
                  style={{ left: percent(geometry.x(active)) }}
                />
                <Dot
                  left={percent(geometry.x(active))}
                  top={geometry.y(shown.value)}
                  className="size-3 bg-foreground"
                />
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-0 z-10 whitespace-nowrap",
                    "rounded-control border border-foreground/10 bg-popover px-2.5 py-1.5 text-left",
                    // Kept inside the card at either edge.
                    geometry.x(active) < 0.15
                      ? "translate-x-0"
                      : geometry.x(active) > 0.85
                        ? "-translate-x-full"
                        : "-translate-x-1/2",
                  )}
                  style={{ left: percent(geometry.x(active)) }}
                >
                  <p className="privacy-amount text-sm font-semibold tabular-nums">
                    {format(shown.value)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(shown.date, locale)}
                    {shown.planned ? ` · ${t("ledger.planned")}` : ""}
                  </p>
                  {shownPlan !== null && shownGap !== null ? (
                    <p className="privacy-sensitive mt-1 text-xs tabular-nums text-muted-foreground">
                      {t("bearingMonth.planAt", { amount: format(shownPlan) })}
                      {" · "}
                      <span
                        className={
                          shownGap >= 0 ? "text-success" : "text-destructive"
                        }
                      >
                        {gapText(shownGap)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {/* The readings the crosshair gives, for anyone not seeing it. */}
      <p className="sr-only" aria-live="polite">
        {shown
          ? `${formatShortDate(shown.date, locale)}: ${format(shown.value)}${
              shownGap !== null ? `, ${gapText(shownGap)}` : ""
            }`
          : ""}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{points[0] ? formatShortDate(points[0].date, locale) : ""}</span>
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {points.some((point) => !point.planned) ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
              {t("bearingMonth.recorded")}
            </span>
          ) : null}
          {points.some((point) => point.planned) ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden
                className="h-0 w-4 border-t-2 border-dashed border-primary/70"
              />
              {t("ledger.planned")}
            </span>
          ) : null}
          {plan && plan.length === points.length ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden
                className="h-px w-4 rounded-full bg-muted-foreground/70"
              />
              {t("bearingMonth.asPlanned")}
            </span>
          ) : null}
        </span>
        <span>{endPoint ? formatShortDate(endPoint.date, locale) : ""}</span>
      </div>
    </div>
  );
}

/** A round marker centred on a point of the line, ringed in the card. */
function Dot({
  left,
  top,
  className,
}: {
  left: string;
  top: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
        className,
      )}
      style={{ left, top }}
    />
  );
}
