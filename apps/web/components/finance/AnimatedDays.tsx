"use client";

import type { ReactNode, Ref } from "react";
import { AnimatePresence, LazyMotion, m, MotionConfig } from "motion/react";
import { FADE } from "@/components/motion/fade";
import { cn } from "@/lib/utils";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/**
 * A list read a day at a time, whose days move rather than jump.
 *
 * Each day keeps its place by date, so choosing another week slides the
 * days that stay to where they now go, the ones leaving fade out and the
 * ones arriving fade in. Nothing moves on the first draw: the page arrives
 * as it is.
 *
 * Turning the order over is the exception, and is dealt again instead
 * (`deal`). Slid, every day crosses every other on the way to the far end,
 * and with no ground under the rows their text runs through each other's
 * for a moment; dealt, the list fades in again from the top, which is what
 * a new order is.
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
  /** Raised to draw the list again from the top, its days fading in. */
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

/** One day of an `AnimatedDays`. */
export function AnimatedDay({
  children,
  className,
  ref,
}: {
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
      {...FADE}
      className={className}
    >
      {children}
    </m.div>
  );
}
