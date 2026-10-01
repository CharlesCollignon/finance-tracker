"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Sparkle } from "@phosphor-icons/react";
import { formatMonthCompact } from "@finance/core/constants";
import { withExtraSaving, type WhatIfPoint } from "@finance/core/future-plan";
import type { ForwardProjection } from "@finance/core/projection";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { Button, ButtonNub } from "@/components/ui/Button";
import { GLASS_HERO } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { FIGURE_HERO, MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { PlanCard, Slider } from "./plan-controls";

/** What the "Et si…" slider runs to, in euros a month. */
const EXTRA_MAX = 500;
const EXTRA_STEP = 25;
const QUICK_EXTRAS = [50, 100, 200] as const;

interface YearAheadCardProps {
  projection: ForwardProjection;
  hasTemplates: boolean;
  extra: number;
  onExtraChange: (extra: number) => void;
  /**
   * What the extra does to the next milestone. A slot rather than a string:
   * it needs the investment accounts' market value, which streams in after
   * the card, so it arrives inside its own Suspense boundary.
   */
  milestoneLine: ReactNode;
}

/**
 * A year from now: the page's headline figure and the one control on it
 * that is pure play.
 *
 * The figure is the forward projection's kept track — what is on the
 * accounts and put aside twelve months out, or what the months add when there
 * is no balance to start from — and the slider under it moves it. Money kept
 * rather than spent adds up month after month, so the curve redraws a second,
 * dashed line as the thumb moves and the figure counts to its new end: the
 * cheapest way to show what fifty euros a month is worth is to let someone
 * drag it.
 */
export function YearAheadCard({
  projection,
  hasTemplates,
  extra,
  onExtraChange,
  milestoneLine,
}: YearAheadCardProps) {
  const t = useT();
  const format = useFormatCurrency();
  const { summary, points, makeup } = projection;

  const series = useMemo(() => withExtraSaving(points, extra), [points, extra]);

  if (!hasTemplates || !summary || points.length < 2) {
    return (
      <PlanCard
        icon={<CalendarCheck size={ICON.sm} weight="fill" />}
        title={t("futurePlan.yearTitle")}
        className={GLASS_HERO}
      >
        <p className="text-sm text-muted-foreground">
          {t("planWeb.yearEmpty")}
        </p>
        <Button
          variant="pill"
          className="gap-3 self-start"
          render={<Link href="/recurring" />}
        >
          {t("planWeb.yearEmptyCta")}
          <ButtonNub>
            <ArrowRight size={ICON.md} />
          </ButtonNub>
        </Button>
      </PlanCard>
    );
  }

  const base = summary.grounded ? summary.endingKept : summary.addedAltogether;
  const total = base + extra * points.length;

  return (
    <PlanCard
      icon={<CalendarCheck size={ICON.sm} weight="fill" />}
      title={t("futurePlan.yearTitle")}
      className={cn(GLASS_HERO, "md:p-8")}
    >
      {/* Above the figure, because it invalidates it. */}
      {makeup.noIncomeScheduled ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {t("projection.noIncomeCharge")}{" "}
          <Link
            href="/recurring"
            className="font-medium underline underline-offset-2"
          >
            {t("projection.noIncomeCta")}
          </Link>
        </p>
      ) : null}

      <div>
        <AnimatedAmount
          value={total}
          format={(value) => format(Math.round(value))}
          className={cn(FIGURE_HERO, "block text-primary-ink")}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.grounded
            ? t("futurePlan.yearGrounded", { month: summary.endLabel })
            : t("futurePlan.yearAdded", { month: summary.endLabel })}
        </p>
      </div>

      <YearCurve
        points={series}
        showExtra={extra > 0}
        extraLabel={t("futurePlan.whatIfPerMonth", { amount: format(extra) })}
        format={(value) => format(Math.round(value))}
      />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="flex items-center gap-2 font-head text-base">
            <Sparkle
              size={ICON.md}
              weight="fill"
              aria-hidden
              className="text-primary"
            />
            {t("futurePlan.whatIfTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("futurePlan.whatIfLabel")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Slider
            value={extra}
            min={0}
            max={EXTRA_MAX}
            step={EXTRA_STEP}
            onChange={onExtraChange}
            label={t("futurePlan.whatIfLabel")}
            valueText={t("futurePlan.whatIfPerMonth", {
              amount: format(extra),
            })}
            className="min-w-0 flex-1"
          />
          <span
            className={cn(
              "privacy-sensitive w-28 shrink-0 text-right text-sm font-medium tabular-nums",
              extra === 0 && "text-muted-foreground",
            )}
          >
            {t("futurePlan.whatIfPerMonth", { amount: format(extra) })}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_EXTRAS.map((amount) => {
            const on = extra === amount;
            return (
              <button
                key={amount}
                type="button"
                aria-pressed={on}
                onClick={() => onExtraChange(on ? 0 : amount)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm tabular-nums transition-colors duration-hover lg:min-h-9",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  on
                    ? "border-foreground/30 bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                +{format(amount)}
              </button>
            );
          })}
        </div>

        <div aria-live="polite" className="min-h-12">
          {extra === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("futurePlan.whatIfNone")}
            </p>
          ) : (
            <>
              <p className="privacy-sensitive text-base font-medium">
                {t("futurePlan.whatIfResult", {
                  amount: format(extra * points.length),
                })}
              </p>
              {milestoneLine}
            </>
          )}
        </div>
      </div>
    </PlanCard>
  );
}

/* ------------------------------------------------------------ the curve */

/** The plot's height in pixels; its width is whatever the card gives it. */
const HEIGHT = 176;
/** Room above and below the lines, so an end dot is not cut. */
const PAD_Y = 16;
/** The x axis in the SVG's own units, stretched to the card's width. */
const SPAN = 1000;

/**
 * The twelve months ahead, and the same twelve with the extra.
 *
 * Built the way the Bearing's balance curve is — relative units stretched to
 * the card, strokes held at their width, dots in HTML so they stay round — so
 * the line is in the server's HTML and draws itself in as the card arrives.
 * The solid line is the accent, being the figure the page opens on; the extra
 * is a dashed line in the ink, told apart by its dash as well as its colour.
 * The crosshair follows the pointer, a finger or the arrow keys to the
 * nearest month and reads it out, to a screen reader as well.
 */
function YearCurve({
  points,
  showExtra,
  extraLabel,
  format,
}: {
  points: WhatIfPoint[];
  showExtra: boolean;
  extraLabel: string;
  format: (value: number) => string;
}) {
  const t = useT();
  const locale = useLocale();
  const titleId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const values = points.flatMap((point) =>
      showExtra ? [point.value, point.withExtra] : [point.value],
    );
    let min = Math.min(...values, 0);
    let max = Math.max(...values, 0);
    if (max - min < 1) {
      max += 1;
      min -= 1;
    }
    const last = Math.max(1, points.length - 1);
    const x = (index: number) => index / last;
    const y = (value: number) =>
      PAD_Y + ((max - value) / (max - min)) * (HEIGHT - PAD_Y * 2);
    const path = (pick: (point: WhatIfPoint) => number) =>
      points
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"}${(x(index) * SPAN).toFixed(1)},${y(pick(point)).toFixed(1)}`,
        )
        .join(" ");
    const base = path((point) => point.value);
    return {
      x,
      y,
      base,
      extra: showExtra ? path((point) => point.withExtra) : "",
      area: `${base} L${SPAN},${y(min).toFixed(1)} L0,${y(min).toFixed(1)} Z`,
      zeroY: min < 0 && max > 0 ? y(0) : null,
    };
  }, [points, showExtra]);

  function nearest(clientX: number): number {
    const frame = frameRef.current;
    if (!frame) {
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
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -points.length,
      End: points.length,
    };
    const step = steps[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const start = active ?? (step > 0 ? -1 : points.length);
    setActive(Math.min(points.length - 1, Math.max(0, start + step)));
  }

  const lastIndex = points.length - 1;
  const end = points[lastIndex]!;
  const shown = active !== null ? points[active] : null;
  const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;
  const shortLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-").map(Number);
    return formatMonthCompact(year!, month!, locale);
  };
  const readout = shown
    ? t("futurePlan.scrubPoint", {
        month: shown.label,
        amount: format(shown.value),
      })
    : "";

  return (
    <div>
      <div
        ref={frameRef}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onPointerMove={(event: PointerEvent<HTMLDivElement>) =>
          setActive(nearest(event.clientX))
        }
        onPointerDown={(event: PointerEvent<HTMLDivElement>) =>
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
          {t("planWeb.yearChartLabel")}
        </span>

        <svg
          viewBox={`0 0 ${SPAN} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={`${titleId}-wash`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
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
          <path
            d={geometry.base}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="balance-curve-draw"
          />
          {geometry.extra ? (
            <path
              d={geometry.extra}
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity={0.85}
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        <Dot
          left={percent(geometry.x(lastIndex))}
          top={geometry.y(end.value)}
          className="balance-curve-fade size-2.5 bg-primary"
        />
        {showExtra ? (
          <Dot
            left={percent(geometry.x(lastIndex))}
            top={geometry.y(end.withExtra)}
            className="size-2.5 border-2 border-foreground bg-card"
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
              className="size-3 bg-primary"
            />
            {showExtra ? (
              <Dot
                left={percent(geometry.x(active))}
                top={geometry.y(shown.withExtra)}
                className="size-3 bg-foreground"
              />
            ) : null}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 z-10 whitespace-nowrap",
                "rounded-control border border-foreground/10 bg-popover px-2.5 py-1.5 text-left",
                geometry.x(active) < 0.15
                  ? "translate-x-0"
                  : geometry.x(active) > 0.85
                    ? "-translate-x-full"
                    : "-translate-x-1/2",
              )}
              style={{ left: percent(geometry.x(active)) }}
            >
              <p className="privacy-sensitive text-sm font-semibold tabular-nums">
                {readout}
              </p>
              {showExtra ? (
                <p className="privacy-sensitive text-xs tabular-nums text-muted-foreground">
                  {t("futurePlan.scrubWithExtra", {
                    amount: format(shown.withExtra),
                  })}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {readout}
        {shown && showExtra
          ? ` · ${t("futurePlan.scrubWithExtra", { amount: format(shown.withExtra) })}`
          : ""}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{shortLabel(points[0]!.monthKey)}</span>
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
            {t("planWeb.asItStands")}
          </span>
          {showExtra ? (
            <span className="privacy-sensitive flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0 w-4 border-t-2 border-dashed border-foreground/85"
              />
              {extraLabel}
            </span>
          ) : null}
        </span>
        <span>{shortLabel(end.monthKey)}</span>
      </div>
      <p className={cn(MICRO, "mt-1 text-center text-muted-foreground")}>
        {t("futurePlan.scrubHint")}
      </p>

      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{t("planWeb.tableMonth")}</th>
            <th scope="col">{t("planWeb.asItStands")}</th>
            {showExtra ? <th scope="col">{extraLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.monthKey}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
              {showExtra ? <td>{format(point.withExtra)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
