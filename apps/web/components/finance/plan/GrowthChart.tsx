"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { EnvelopeYear } from "@finance/core/future-plan";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import styles from "./plan.module.css";

/**
 * The three parts of the long view, bottom to top. Chart tokens rather than
 * the accent, in an order checked for colour-blind separation: adjacent
 * pairs sit ΔE 18–21 apart under deuteranopia and protanopia.
 */
export const GROWTH_SERIES = [
  { key: "initial", color: "var(--chart-4)", swatch: "bg-chart-4" },
  { key: "contributions", color: "var(--chart-2)", swatch: "bg-chart-2" },
  { key: "netGains", color: "var(--chart-1)", swatch: "bg-chart-1" },
] as const;

const HEIGHT = 200;
const PAD_TOP = 12;
const SPAN = 1000;

/**
 * What the accounts would hold, year by year: what is already there, what is
 * paid in, and what it earns after tax, stacked.
 *
 * Drawn like the page's other curve — relative units stretched to the card,
 * a crosshair that follows the pointer, a finger or the arrow keys to the
 * nearest year and reads all three parts out. The stack rises from its
 * baseline once, as the card arrives; after that it answers every edit at
 * once, because a calculator that animates between answers is one you wait
 * for. A 2px seam in the card's colour separates the bands.
 */
export function GrowthChart({
  years,
  format,
  yearLabel,
  onActiveChange,
}: {
  years: EnvelopeYear[];
  format: (value: number) => string;
  yearLabel: (year: number) => string;
  /** The year being read, as an index into `years`, or null when none is. */
  onActiveChange?: (index: number | null) => void;
}) {
  const t = useT();
  const titleId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const [active, setActiveState] = useState<number | null>(null);
  // Told only when the year changes: the pointer moves far more often.
  const setActive = (next: number | null) => {
    if (next === active) {
      return;
    }
    setActiveState(next);
    onActiveChange?.(next);
  };

  const geometry = useMemo(() => {
    const tops = years.map((point) => {
      const initial = Math.max(0, point.initial);
      const contributions = initial + Math.max(0, point.contributions);
      return [
        initial,
        contributions,
        contributions + Math.max(0, point.netGains),
      ] as const;
    });
    const max = Math.max(1, ...tops.map((top) => top[2]));
    const last = Math.max(1, years.length - 1);
    const x = (index: number) => index / last;
    const y = (value: number) => HEIGHT - (value / max) * (HEIGHT - PAD_TOP);
    const line = (band: 0 | 1 | 2) =>
      tops
        .map(
          (top, index) =>
            `${index === 0 ? "M" : "L"}${(x(index) * SPAN).toFixed(1)},${y(top[band]).toFixed(1)}`,
        )
        .join(" ");
    const lower = (band: 0 | 1 | 2) =>
      band === 0
        ? `L${SPAN},${HEIGHT} L0,${HEIGHT} Z`
        : `${tops
            .map(
              (top, index) =>
                `L${(x(index) * SPAN).toFixed(1)},${y(top[(band - 1) as 0 | 1]).toFixed(1)}`,
            )
            .reverse()
            .join(" ")} Z`;
    return {
      x,
      y,
      tops,
      lines: [line(0), line(1), line(2)] as const,
      areas: ([0, 1, 2] as const).map((band) => `${line(band)} ${lower(band)}`),
    };
  }, [years]);

  function nearest(clientX: number): number {
    const frame = frameRef.current;
    if (!frame) {
      return 0;
    }
    const rect = frame.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(
      years.length - 1,
      Math.max(0, Math.round(ratio * (years.length - 1))),
    );
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -years.length,
      End: years.length,
    };
    const step = steps[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const start = active ?? (step > 0 ? -1 : years.length);
    setActive(Math.min(years.length - 1, Math.max(0, start + step)));
  }

  const shown = active !== null ? years[active] : null;
  const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;
  const labels = {
    initial: t("futurePlan.legendInitial"),
    contributions: t("futurePlan.legendContributions"),
    netGains: t("futurePlan.legendGains"),
  };
  const end = years[years.length - 1];

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
          {t("planWeb.growthChartLabel")}
        </span>
        <svg
          viewBox={`0 0 ${SPAN} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <g className={styles.rise}>
            {GROWTH_SERIES.map((series, band) => (
              <path
                key={series.key}
                d={geometry.areas[band]}
                fill={series.color}
                fillOpacity={0.88}
              />
            ))}
            {/* The seams between bands, in the card's own colour. */}
            {[0, 1].map((band) => (
              <path
                key={band}
                d={geometry.lines[band as 0 | 1]}
                fill="none"
                stroke="var(--card)"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <line
            x1={0}
            x2={SPAN}
            y1={HEIGHT}
            y2={HEIGHT}
            stroke="var(--hairline-strong)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {active !== null && shown ? (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/60"
              style={{ left: percent(geometry.x(active)) }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
              style={{
                left: percent(geometry.x(active)),
                top: geometry.y(geometry.tops[active]![2]),
              }}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 z-10 min-w-44 whitespace-nowrap",
                "rounded-control border border-foreground/10 bg-popover px-3 py-2 text-left",
                geometry.x(active) < 0.25
                  ? "translate-x-2"
                  : geometry.x(active) > 0.75
                    ? "-translate-x-[calc(100%+0.5rem)]"
                    : "-translate-x-1/2",
              )}
              style={{ left: percent(geometry.x(active)) }}
            >
              <p className="text-xs text-muted-foreground">
                {yearLabel(shown.year)}
              </p>
              <p className="privacy-amount font-serif text-base font-semibold tabular-nums">
                {format(shown.netValue)}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {[...GROWTH_SERIES].reverse().map((series) => (
                  <li
                    key={series.key}
                    className="flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        aria-hidden
                        className={cn("size-2 rounded-full", series.swatch)}
                      />
                      {labels[series.key]}
                    </span>
                    <span className="privacy-amount tabular-nums">
                      {format(shown[series.key])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {shown
          ? `${t("futurePlan.scrubPoint", {
              month: yearLabel(shown.year),
              amount: format(shown.netValue),
            })} · ${GROWTH_SERIES.map(
              (series) => `${labels[series.key]} ${format(shown[series.key])}`,
            ).join(" · ")}`
          : ""}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{yearLabel(0)}</span>
        <span>{end ? yearLabel(end.year) : ""}</span>
      </div>

      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{t("planWeb.tableYear")}</th>
            {GROWTH_SERIES.map((series) => (
              <th key={series.key} scope="col">
                {labels[series.key]}
              </th>
            ))}
            <th scope="col">{t("futurePlan.statNet")}</th>
          </tr>
        </thead>
        <tbody>
          {years.map((point) => (
            <tr key={point.year}>
              <th scope="row">{yearLabel(point.year)}</th>
              {GROWTH_SERIES.map((series) => (
                <td key={series.key}>{format(point[series.key])}</td>
              ))}
              <td>{format(point.netValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
