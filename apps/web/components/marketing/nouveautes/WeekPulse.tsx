"use client";

import { useState } from "react";
import { m } from "motion/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { GOTO_WEEK_EVENT } from "@/components/marketing/nouveautes/river-events";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** How long one bar takes to grow, and how far apart they start. */
const GROW_S = 0.7;
const STEP_S = 0.03;

export interface PulseWeek {
  /** The week's Monday. */
  week: string;
  count: number;
  /** « Semaine du 5 octobre · 9 nouveautés », said on hover and to a reader. */
  label: string;
}

/**
 * The rhythm of the work, beside the title: one bar per week since the first
 * line of code, as tall as the changes that landed in it. The quiet summer
 * and the busy October are both there, because that is how it went.
 *
 * The bars grow up from the baseline once, one after another, as the hero
 * arrives — the Journal's week strip, at the scale of the whole project.
 * Pointing at one says its week under the strip; pressing one takes the list
 * below to that week. This week's bar is in the status green while it has
 * something in it: live, as the dot above says.
 *
 * Under reduced motion the bars stand at their height.
 */
export function WeekPulse({
  weeks,
  caption,
}: {
  weeks: PulseWeek[];
  caption: string;
}) {
  const [pointed, setPointed] = useState<PulseWeek | null>(null);
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const current = weeks[weeks.length - 1]?.week;

  return (
    <figure className="w-full min-w-0">
      <div
        className="flex h-32 items-end gap-1 md:h-44 md:gap-1.5"
        onPointerLeave={() => setPointed(null)}
      >
        {weeks.map((week, index) => {
          const live = week.week === current && week.count > 0;
          const bar = (
            <m.span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 origin-bottom rounded-full transition-colors duration-hover",
                live
                  ? "bg-success"
                  : week.count > 0
                    ? "bg-white/55 group-hover:bg-white/85 group-focus-visible:bg-white/85"
                    : "bg-white/12",
              )}
              style={{
                height:
                  week.count > 0
                    ? `${Math.max(6, (week.count / max) * 100)}%`
                    : "3px",
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                duration: GROW_S,
                ease: EASE,
                delay: 0.7 + index * STEP_S,
              }}
            />
          );
          return week.count > 0 ? (
            <button
              key={week.week}
              type="button"
              aria-label={week.label}
              className={cn(
                "group relative h-full min-w-0 flex-1 rounded-full",
                marketingFocus,
              )}
              onPointerEnter={() => setPointed(week)}
              onFocus={() => setPointed(week)}
              onBlur={() => setPointed(null)}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(GOTO_WEEK_EVENT, { detail: week.week }),
                )
              }
            >
              {bar}
            </button>
          ) : (
            <span
              key={week.week}
              className="relative h-full min-w-0 flex-1"
              onPointerEnter={() => setPointed(week)}
            >
              {bar}
            </span>
          );
        })}
      </div>
      <figcaption
        className="mt-4 min-h-5 text-sm text-marketing-muted"
        aria-live="polite"
      >
        {pointed ? pointed.label : caption}
      </figcaption>
    </figure>
  );
}
