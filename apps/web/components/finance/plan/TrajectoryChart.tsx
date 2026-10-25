"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { niceTicks } from "@finance/core/year-ahead";
import { cn } from "@/lib/utils";
import styles from "./plan.module.css";

const WIDTH = 1000;
const HEIGHT = 240;
const PAD = 12;

/**
 * The trajectory: the middle start as one gold line inside the band eight
 * starts in ten end in, today at the left. Two to four round amounts as
 * labelled gridlines keep the scale honest; a pointer, a finger or the arrow
 * keys read a month out, handed up as an index (0 is today).
 *
 * It fades in when it arrives — the parent keys it by horizon, so changing
 * the horizon crossfades rather than morphs — and otherwise holds still.
 */
export function TrajectoryChart({
  low,
  middle,
  high,
  active,
  onActive,
  label,
  format,
}: {
  /** Month by month from today, the same length each. */
  low: readonly number[];
  middle: readonly number[];
  high: readonly number[];
  active: number | null;
  onActive: (index: number | null) => void;
  label: string;
  /** An amount as a gridline says it. */
  format: (value: number) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const last = middle.length - 1;
  const lowest = Math.min(...low, ...middle);
  const highest = Math.max(...high, ...middle);
  const span = highest - lowest || 1;
  const floor = lowest - span * 0.05;
  const ceiling = highest + span * 0.05;
  const x = (index: number) => (last > 0 ? (index / last) * WIDTH : 0);
  const y = (value: number) =>
    PAD + (1 - (value - floor) / (ceiling - floor)) * (HEIGHT - 2 * PAD);
  const line = (values: readonly number[]) =>
    values
      .map(
        (value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`,
      )
      .join(" ");
  const band = `${line(high)} ${[...low]
    .reverse()
    .map((value, index) => `L${x(last - index)},${y(value)}`)
    .join(" ")} Z`;
  const ticks = niceTicks(lowest, highest);

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
    const by = event.shiftKey ? 12 : 1;
    if (event.key === "ArrowLeft") {
      onActive(Math.max(0, at - by));
    } else if (event.key === "ArrowRight") {
      onActive(Math.min(last, at + by));
    } else if (event.key === "Home") {
      onActive(0);
    } else if (event.key === "End") {
      onActive(last);
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={active ?? last}
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
        styles.rise,
        "relative h-56 w-full touch-pan-y rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {ticks.map((tick) => (
        <div
          key={tick}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 flex items-center gap-2"
          style={{ top: `${(y(tick) / HEIGHT) * 100}%` }}
        >
          <span className="privacy-sensitive -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground">
            {format(tick)}
          </span>
          <span className="h-px flex-1 -translate-y-1/2 bg-foreground/10" />
        </div>
      ))}
      <svg
        aria-hidden
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <path d={band} fill="var(--primary)" fillOpacity={0.16} />
        <path
          d={line(middle)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
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
      {active !== null ? (
        <span
          aria-hidden
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
          style={{
            left: `${(x(active) / WIDTH) * 100}%`,
            top: `${(y(middle[active]!) / HEIGHT) * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}
