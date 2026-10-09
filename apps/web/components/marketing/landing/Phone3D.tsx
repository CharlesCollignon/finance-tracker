"use client";

import type { ReactNode } from "react";
import { m, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A phone in three dimensions, drawn in CSS: a body with its edge given depth
 * by layers set back along Z, a screen inset into it, the light sliding
 * across the glass as it turns. Its turn is handed in as motion values, so
 * whatever drives it — the page's scroll, here — moves it without a render.
 *
 * Generic on purpose: no maker's buttons, notch or cameras. The screens it
 * shows are the web app in a phone's browser, which is what exists today;
 * the phone app itself is under « Bientôt ».
 */
export function Phone3D({
  rotateX,
  rotateY,
  y,
  className,
  children,
}: {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  y: MotionValue<number>;
  className?: string;
  /** The screen, at the phone's 9:19.5 aspect. */
  children: ReactNode;
}) {
  // The glare moves against the turn, as light on glass does.
  const glare = useTransform(rotateY, [-35, 35], ["120%", "-20%"]);
  const shadowScale = useTransform(y, [-20, 20], [0.86, 1]);
  const shadowOpacity = useTransform(y, [-20, 20], [0.35, 0.6]);

  return (
    <div className={cn("relative [perspective:1600px]", className)}>
      <m.div
        className="relative mx-auto aspect-[9/19.5] w-full [transform-style:preserve-3d]"
        style={{ rotateX, rotateY, y }}
      >
        {/* The edge: a few layers set back, each a little darker, read as
            the phone's thickness once it turns. */}
        {[10, 7, 4].map((depth) => (
          <div
            key={depth}
            aria-hidden
            className="absolute inset-0 rounded-[2.9rem] bg-[#1b1b26] ring-1 ring-white/5"
            style={{ transform: `translateZ(-${depth}px)` }}
          />
        ))}
        <div className="absolute inset-0 rounded-[2.9rem] bg-[linear-gradient(145deg,#2b2b38,#0d0d14_45%,#1d1d29)] p-[3.2%] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.6)]">
          <div className="relative size-full overflow-hidden rounded-[2.45rem] bg-background">
            {children}
            {/* The speaker slot, centred: nothing more of a maker's design. */}
            <div
              aria-hidden
              className="absolute left-1/2 top-[1.6%] h-[2.1%] w-[26%] -translate-x-1/2 rounded-full bg-black/90"
            />
            <m.div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgba(255,255,255,0.10)_48%,transparent_60%)] bg-[length:250%_100%]"
              style={{ backgroundPositionX: glare }}
            />
          </div>
        </div>
      </m.div>
      {/* Its shadow on the ground, tightening as it lifts. */}
      <m.div
        aria-hidden
        className="mx-auto mt-6 h-6 w-3/4 rounded-[50%] bg-black blur-xl"
        style={{ scaleX: shadowScale, opacity: shadowOpacity }}
      />
    </div>
  );
}
