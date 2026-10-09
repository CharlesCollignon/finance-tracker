"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  resampleSeries,
  type YearAheadAccountId,
  type YearAheadBand,
} from "@finance/core/year-ahead";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { FOLLOW, MORPH } from "./year-ahead-parts";

/** A sparkline's points, the same count whatever the window, so it morphs. */
const SPARK_SAMPLES = 25;
const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 28;

/**
 * The accounts under the chart, one row each: its colour, its name, its
 * own small curve, what it holds today and at the end, and the change.
 * Read on its own row, an account no longer has to be guessed from the
 * thickness of a band. A press takes it out of the figure and the chart,
 * another brings it back; the last one showing cannot be taken out. The
 * row an account's « Pourquoi » line is pointed at lights up.
 */
export function YearAheadAccounts({
  bands,
  months,
  pending,
  played,
  focus,
  color,
  name,
  onToggle,
  format,
}: {
  bands: YearAheadBand[];
  months: number;
  pending: boolean;
  played: boolean;
  focus: YearAheadAccountId | null;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  onToggle: (id: YearAheadAccountId) => void;
  format: (value: number) => string;
}) {
  const t = useT();
  const reduce = useReducedMotion() ?? false;
  const shown = bands.filter((band) => !band.hidden).length;
  // One scale for every sparkline, in euros: a steep curve is a big change,
  // a flat one a small one, whatever the account holds.
  const changes = bands
    .filter((band) => !band.hidden)
    .flatMap((band) =>
      band.values.map((value) => value - (band.values[0] ?? 0)),
    );
  const scale = {
    up: Math.max(0, ...changes),
    down: Math.max(0, ...changes.map((change) => -change)),
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="grid gap-x-10 gap-y-0.5 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {bands.map((band) => {
            const last = !band.hidden && shown === 1;
            const today = band.values[0] ?? 0;
            const end = band.values[months] ?? 0;
            const change = end - today;
            return (
              <m.li
                key={band.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={reduce ? { duration: 0 } : FOLLOW}
              >
                <button
                  type="button"
                  aria-pressed={!band.hidden}
                  aria-label={t("futurePlan.accountToggle", {
                    name: name(band.id),
                  })}
                  disabled={last}
                  onClick={() => onToggle(band.id)}
                  className={cn(
                    "-mx-2 grid min-h-12 w-[calc(100%+1rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-control px-2 text-left text-sm",
                    "sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
                    "transition-colors duration-hover hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    focus === band.id && "bg-muted/60",
                    last && "cursor-default hover:bg-transparent",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 rounded-full transition-opacity duration-hover",
                      band.hidden && "opacity-35",
                    )}
                    style={{ background: color(band.id) }}
                  />
                  <span
                    className={cn(
                      "truncate",
                      band.hidden && "text-muted-foreground line-through",
                    )}
                  >
                    {name(band.id)}
                  </span>
                  <Sparkline
                    values={band.values}
                    scale={scale}
                    color={color(band.id)}
                    hidden={band.hidden}
                  />
                  {band.hidden ? (
                    <span />
                  ) : (
                    <span className="privacy-sensitive flex flex-col items-end tabular-nums">
                      <span>
                        <span className="hidden text-muted-foreground sm:inline">
                          {format(today)} →{" "}
                        </span>
                        <AnimatedAmount
                          value={end}
                          format={format}
                          className="font-medium"
                        />
                      </span>
                      <span className={cn(MICRO, "text-muted-foreground")}>
                        {change >= 0 ? "+" : "−"}
                        {format(Math.abs(change))}
                      </span>
                    </span>
                  )}
                </button>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {pending || played ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {pending ? (
            <span className="animate-pulse">
              {t("futurePlan.accountsPending")}
            </span>
          ) : null}
          {played ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-0 w-4 border-t-2 border-dashed border-foreground/85"
              />
              {t("planWeb.asItStands")}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * An account's own curve, from where it starts today, on the scale every
 * row shares — so the current account's +12 000 € climbs and a livret's
 * +137 € barely leaves the line.
 */
function Sparkline({
  values,
  scale,
  color,
  hidden,
}: {
  values: readonly number[];
  /** The largest rise and the largest fall any visible account makes. */
  scale: { up: number; down: number };
  color: string;
  hidden: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const samples = resampleSeries(values, SPARK_SAMPLES);
  const start = samples[0] ?? 0;
  const span = scale.up + scale.down || 1;
  const room = SPARK_HEIGHT - 6;
  // Where "no change" sits: the floor when everything rises.
  const level = 3 + (scale.up / span) * room;
  const d = samples
    .map((value, index) => {
      const x = (index / (SPARK_SAMPLES - 1)) * SPARK_WIDTH;
      const y = level - ((value - start) / span) * room;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className={cn(
        "hidden h-7 w-24 overflow-visible sm:block",
        hidden && "opacity-30",
      )}
    >
      <m.path
        initial={false}
        animate={{ d }}
        transition={reduce ? { duration: 0 } : MORPH}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
