"use client";

import type { ReactNode, Ref } from "react";
import { AnimatePresence, LazyMotion, m, MotionConfig } from "motion/react";
import { DURATION, EASE_STANDARD, STAGGER_STEP_MS } from "@finance/core/motion";
import { cn } from "@/lib/utils";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * How many days into the list a change still staggers. Past the first
 * screenful nobody sees the cascade, and a delay that grew with the month
 * would leave the bottom of a long one blank for a second.
 */
const STAGGER_CAP = 8;

/**
 * A list read a day at a time, whose days move rather than jump.
 *
 * Each day keeps its place by date, so choosing another week slides the
 * days that stay to where they now go, the ones leaving fade, and the ones
 * arriving rise in a beat apart. Nothing moves on the first draw: the page
 * arrives as it is.
 *
 * Turning the order over is the exception, and is dealt again instead
 * (`deal`). Slid, every day crosses every other on the way to the far end,
 * and with no ground under the rows their text runs through each other's
 * for half a second; dealt, the list starts again from the top, one day
 * after another, which is what a new order is.
 *
 * `popLayout` takes a leaving day out of the flow at once, so the days that
 * stay start moving into the room it leaves instead of waiting for it to go;
 * `relative` is what it is positioned against meanwhile. Under reduced
 * motion every day simply stands where it belongs.
 */
export function AnimatedDays({
  children,
  className,
  deal = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Raised to draw the list again from the top, its days rising in turn. */
  deal?: number;
}) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div key={deal} className={cn("relative", className)}>
          <AnimatePresence initial={deal > 0} mode="popLayout">
            {children}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/** One day of an `AnimatedDays`; `index` is its place, for the stagger. */
export function AnimatedDay({
  index,
  children,
  className,
  ref,
}: {
  index: number;
  children: ReactNode;
  className?: string;
  /** `popLayout` measures a leaving day through it. */
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <m.div
      ref={ref}
      // Position only: a day whose rows change keeps its own height at once
      // instead of being stretched to it.
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: DURATION.press / 1000 } }}
      transition={{
        duration: DURATION.enter / 1000,
        ease: EASE,
        delay: (Math.min(index, STAGGER_CAP) * STAGGER_STEP_MS) / 1000,
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}
