"use client";

import { useRef, type ReactNode } from "react";
import { cssEasing, DURATION } from "@finance/core/motion";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/** Below this, the pointer is not near enough an edge to light it. */
/*
 * Softened deliberately, twice over.
 *
 * The glow was 70% of the foreground and began lighting from a third of the
 * way out, so most of a card's area put a bright moving edge on screen. It is
 * 40% now and starts at just over half, which keeps the effect as something
 * you notice when the pointer is near an edge rather than something that
 * follows you across the card. The Bearing is the screen the app opens to and
 * five of these are visible at once; an effect that reads well on one reads as
 * restless on five.
 */
const EDGE_SENSITIVITY = 0.55;

/**
 * A card whose edge lights where the pointer approaches it.
 *
 * Adapted from React Bits' BorderGlow. The original owned the card's
 * background — it took a `backgroundColor` hex and painted it — and built
 * its border from a seven-stop mesh of three hard-coded hex colours. Both
 * are gone: the surface belongs to the caller, and the edge is the app's own
 * accent, so a theme change moves this with it.
 *
 * Like `SpotlightCard`, the pointer writes custom properties rather than
 * state. The original called two `setState`s per `pointermove`; five of these
 * in a list, each wrapping an accordion, is the version of that which is
 * actually felt.
 *
 * The two effects are not the same one twice. This lights the *edge* the
 * pointer is near; the spotlight follows it across the *interior*. Layering
 * them is the intended look.
 */
export function BorderGlow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const el = ref.current;
        if (reducedMotion || !el) {
          return;
        }
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = event.clientX - rect.left - cx;
        const dy = event.clientY - rect.top - cy;

        // How close to an edge, 0 at the centre and 1 at the border. The
        // original's arithmetic, kept: the larger of the two axis ratios.
        const proximity = Math.min(
          1,
          Math.max(Math.abs(dx) / cx, Math.abs(dy) / cy),
        );
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        el.style.setProperty("--glow-angle", `${angle.toFixed(2)}deg`);
        el.style.setProperty(
          "--glow-on",
          proximity < EDGE_SENSITIVITY
            ? "0"
            : ((proximity - EDGE_SENSITIVITY) / (1 - EDGE_SENSITIVITY)).toFixed(
                3,
              ),
        );
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--glow-on", "0");
      }}
      className={cn("relative isolate", className)}
    >
      <span
        aria-hidden="true"
        // The house curve and the house duration, not Tailwind's. `duration-300`
        // and a bare `transition-opacity` were a second easing and a second
        // timing beside `motion.ts`'s — which exists to say that "a screen
        // where different blocks decelerate differently reads as several
        // screens", and it means the decorations too. `enter` is the one the
        // spotlight layered over this already used.
        style={{ transition: `opacity ${DURATION.enter}ms ${cssEasing()}` }}
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-[inherit]",
          "opacity-[var(--glow-on,0)]",
          // Foreground, not the accent. The Rare Accent Rule gives Lamplit
          // Gold four homes and a glow around every card is none of them —
          // five cards on the screen the app opens to spent it five times
          // before a figure had a chance to. The light is the effect; the
          // colour it was borrowing was doing no work here.
          "[background:conic-gradient(from_var(--glow-angle,0deg),color-mix(in_srgb,var(--foreground)_40%,transparent),transparent_25%,transparent_75%,color-mix(in_srgb,var(--foreground)_40%,transparent))]",
          // Border-box only: the fill is the caller's surface, and painting
          // under it would wash the figures out.
          "[mask:linear-gradient(#000_0_0)_padding-box,linear-gradient(#000_0_0)]",
          "[mask-composite:exclude] [padding:1px]",
        )}
      />
      {children}
    </div>
  );
}
