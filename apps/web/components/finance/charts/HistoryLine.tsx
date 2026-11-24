"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { niceTicks } from "@finance/core/year-ahead";
import { cn } from "@/lib/utils";

const WIDTH = 1000;
const HEIGHT = 200;
const PAD = 12;

/**
 * A dated run with its scale: one line over a faint wash, two to four round
 * amounts as labelled gridlines, and a point read out under a pointer, a
 * finger or the arrow keys — handed up as an index, so the parent says what
 * that point is in its own words.
 *
 * An optional mark stands at the right edge for a figure that belongs beside
 * the line without being on it: a property's estimated value next to its
 * carried purchase price. It is hollow, so it is never read as the line's
 * own end.
 *
 * Plain SVG stretched to its box; the labels are HTML over it, so they keep
 * their size and the privacy blur covers them.
 */
export function HistoryLine({
  values,
  mark = null,
  active,
  onActive,
  label,
  format,
  className,
}: {
  /** Oldest first. Fewer than two draws nothing. */
  values: readonly number[];
  /** A figure to stand at the right edge, apart from the line. */
  mark?: number | null;
  active: number | null;
  onActive: (index: number | null) => void;
  label: string;
  /** An amount as a gridline says it. */
  format: (value: number) => string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const washId = useId();
  if (values.length < 2) {
    return null;
  }
  const last = values.length - 1;
  const all = mark === null ? values : [...values, mark];
  const lowest = Math.min(...all);
  const highest = Math.max(...all);
  const span = highest - lowest || Math.max(1, highest * 0.02);
  const floor = lowest - span * 0.12;
  const ceiling = highest + span * 0.12;
  const x = (index: number) => (index / last) * WIDTH;
  const y = (value: number) =>
    PAD + (1 - (value - floor) / (ceiling - floor)) * (HEIGHT - 2 * PAD);
  const line = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`)
    .join(" ");
  const wash = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  const ticks = niceTicks(floor, ceiling);

  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return;
    }
    const share = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    onActive(Math.round(share * last));
  }

  function step(event: KeyboardEvent<HTMLDivElement>) {
    const at = active ?? last;
    if (event.key === "ArrowLeft") {
      onActive(Math.max(0, at - 1));
    } else if (event.key === "ArrowRight") {
      onActive(Math.min(last, at + 1));
    } else if (event.key === "Home") {
      onActive(0);
    } else if (event.key === "End") {
      onActive(last);
    } else {
      return;
    }
    event.preventDefault();
  }

  const dot = (index: number, hollow: boolean, value = values[index]!) => (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
        hollow
          ? "border-primary bg-background"
          : "border-background bg-primary",
      )}
      style={{
        left: `${(x(index) / WIDTH) * 100}%`,
        top: `${(y(value) / HEIGHT) * 100}%`,
      }}
    />
  );

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={active ?? last}
      aria-valuetext={format(values[active ?? last]!)}
      onPointerMove={pick}
      onPointerDown={pick}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          onActive(null);
        }
      }}
      onKeyDown={step}
      onBlur={() => onActive(null)}
      className={cn(
        "history-line fade-in relative h-48 w-full touch-pan-y rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {/* The scale keeps a gutter of its own, so no amount sits on the line. */}
      {ticks.map((tick) => (
        <div
          key={tick}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 flex items-center"
          style={{ top: `${(y(tick) / HEIGHT) * 100}%` }}
        >
          <span className="privacy-sensitive w-16 shrink-0 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground">
            {format(tick)}
          </span>
          <span className="h-px flex-1 -translate-y-1/2 bg-foreground/10" />
        </div>
      ))}
      <div ref={box} className="absolute inset-y-0 left-16 right-1.5">
        <svg
          aria-hidden
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id={washId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={wash} fill={`url(#${washId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={0}
              y2={HEIGHT}
              stroke="var(--foreground)"
              strokeOpacity={0.35}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {/* The line's own end, so the eye lands on today rather than the peak. */}
        {dot(active ?? last, false)}
        {mark !== null ? dot(last, true, mark) : null}
      </div>
    </div>
  );
}
