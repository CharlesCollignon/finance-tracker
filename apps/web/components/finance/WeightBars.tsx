"use client";

import { useId, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { MICRO } from "@/lib/type-scale";
import { ICON } from "@/lib/icon-scale";

export interface WeightBarRow {
  id: string;
  label: string;
  /** Share of the whole, 0–1. */
  weight: number;
  /** Shown to the right when given. */
  detail?: string;
  /**
   * Drawn before the label — a flag, for a country.
   *
   * Text rather than a node, because it is an emoji: a flag is two code
   * points derived from the country's own code, so there is no image to load,
   * nothing to ship and nothing that can fall out of step with the name
   * beside it.
   */
  mark?: string | null;
}

interface WeightBarsProps {
  rows: WeightBarRow[];
  /** How many rows get their own line before the rest are pooled. */
  limit?: number;
  /** Words for the pooled remainder — "4 more countries". */
  restLabel?: (count: number) => string;
  /** What the control that unfolds the remainder says, in both states. */
  showRestLabel?: string;
  hideRestLabel?: string;
  className?: string;
}

/**
 * A weighting, as a list of bars.
 *
 * Plain elements, no runtime — the fourth of the five marks in
 * `components/finance/charts`, in the shape this surface needs. A country
 * split is a ranked list where the question is "how much of it is that one",
 * and a bar behind a label answers it without a legend to match colours
 * against.
 *
 * One colour, not five. `SpendStrip` needs a palette because its bands sit
 * end to end with no room for labels; here every row carries its own name, so
 * colour would be decoration competing with the figure beside it. The longest
 * bar is full width rather than the bar being a share of 100% — a portfolio
 * that is 12% Japan at most would otherwise be a column of near-invisible
 * slivers.
 *
 * ## The pooled row
 *
 * Everything past `limit` is pooled into one row carrying the rest of the
 * weight. That row used to be the end of it: the weight was stated and the
 * names behind it were simply not available anywhere, which made the pooled
 * row the one line on the page that raised a question it would not answer.
 * It is now a button that unfolds them in place — no second surface, no
 * navigation, and the folded state is still the default because a diversified
 * portfolio can run to thirty countries and burying the sections below that
 * is the reason the limit exists.
 */
export function WeightBars({
  rows,
  limit = 6,
  restLabel,
  showRestLabel,
  hideRestLabel,
  className,
}: WeightBarsProps) {
  const [open, setOpen] = useState(false);
  const restId = useId();

  if (rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((left, right) => right.weight - left.weight);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const restWeight = rest.reduce((sum, row) => sum + row.weight, 0);
  const pooled = restWeight > 0.001 && restLabel !== undefined;

  // Scaled to the largest row, so the shape of the ranking is legible even
  // when nothing reaches a fifth of the portfolio. The pooled row is included
  // because it can outweigh the smallest named ones.
  const largest = Math.max(
    ...head.map((row) => row.weight),
    pooled ? restWeight : 0,
    0.0001,
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col gap-2">
        {head.map((row) => (
          <Row key={row.id} row={row} largest={largest} />
        ))}
      </ul>

      {pooled ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
            aria-controls={restId}
            className={cn(
              "-mx-2 flex min-h-12 min-w-0 flex-col justify-center gap-1 rounded-md px-2",
              "text-left transition-colors duration-hover hover:bg-muted/50",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
            )}
          >
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <CaretDown
                  size={ICON.xs}
                  weight="bold"
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-muted-foreground transition-transform duration-hover",
                    open && "rotate-180",
                  )}
                />
                <span className="min-w-0 truncate text-sm">
                  {restLabel(rest.length)}
                </span>
                {/* The control's own words, for a reader who arrives on it
                    with a screen reader and hears only the count. */}
                <span className="sr-only">
                  {" — "}
                  {open ? hideRestLabel : showRestLabel}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatShare(restWeight)}
              </span>
            </div>
            <Bar weight={restWeight} largest={largest} />
          </button>

          {open ? (
            <ul
              id={restId}
              className="flex flex-col gap-2 border-t border-border pt-2"
            >
              {rest.map((row) => (
                <Row key={row.id} row={row} largest={largest} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Row({ row, largest }: { row: WeightBarRow; largest: number }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          {row.mark ? (
            // Decoration beside a name that already says which country this
            // is: announcing "flag of Japan, Japan" is the same word twice.
            <span
              aria-hidden="true"
              className="shrink-0 overflow-hidden rounded-full text-sm leading-none"
            >
              {row.mark}
            </span>
          ) : null}
          <span className="min-w-0 truncate text-sm">{row.label}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {formatShare(row.weight)}
          {row.detail ? (
            <span
              className={cn(MICRO, "ml-2 font-normal text-muted-foreground")}
            >
              {row.detail}
            </span>
          ) : null}
        </span>
      </div>
      <Bar weight={row.weight} largest={largest} />
    </li>
  );
}

/**
 * The bar itself, hidden from a screen reader.
 *
 * The figure above it is the content, and a reader that announced both would
 * say everything twice.
 */
function Bar({ weight, largest }: { weight: number; largest: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full bg-[var(--chart-1)]"
        style={{ width: `${(weight / largest) * 100}%` }}
      />
    </div>
  );
}

/**
 * A share, at one decimal place at most.
 *
 * Below a tenth of a percent it reads as "<0.1%" rather than "0.0%", which
 * would say the holding is not there.
 */
function formatShare(weight: number): string {
  const percent = weight * 100;
  if (percent > 0 && percent < 0.1) {
    return "<0.1%";
  }
  return `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
}
