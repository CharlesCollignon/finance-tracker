"use client";

import { useRef, type ReactNode } from "react";
import { cssEasing, DURATION } from "@finance/core/motion";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * A card with a glow that follows the pointer across it.
 *
 * Adapted from React Bits' SpotlightCard, with two changes it needed to
 * live here. Its colours were `bg-neutral-900` and `border-neutral-800`,
 * which would have pinned a second palette beside the app's and painted over
 * the veil `GLASS_CARD` lets through; the surface is the caller's now and
 * this draws only the glow.
 *
 * And the original tracked the pointer in React state, re-rendering on every
 * mousemove. Here the pointer writes two CSS custom properties onto the
 * element, so the browser repaints and React never runs — which matters
 * because these cards contain an open accordion, and re-rendering that
 * sixty times a second to move a gradient is the kind of thing that makes an
 * interface feel cheap on a laptop.
 */
export function SpotlightCard({
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
        if (reducedMotion || !ref.current) {
          return;
        }
        const rect = ref.current.getBoundingClientRect();
        ref.current.style.setProperty(
          "--spot-x",
          `${event.clientX - rect.left}px`,
        );
        ref.current.style.setProperty(
          "--spot-y",
          `${event.clientY - rect.top}px`,
        );
        ref.current.style.setProperty("--spot-on", "1");
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--spot-on", "0");
      }}
      className={cn("relative isolate overflow-hidden", className)}
    >
      <span
        aria-hidden="true"
        // The house curve, not Tailwind's default one — see `motion.ts`, and
        // `BorderGlow`, which this is layered over and now shares a timing
        // with. The 500ms is unchanged; only where it comes from is.
        style={{ transition: `opacity ${DURATION.enter}ms ${cssEasing()}` }}
        className={cn(
          "pointer-events-none absolute inset-0 -z-10",
          "opacity-[var(--spot-on,0)]",
          // Foreground, not the accent. The Rare Accent Rule gives Lamplit
          // Gold four homes and a glow around every card is none of them —
          // five cards on the screen the app opens to spent it five times
          // before a figure had a chance to. The light is the effect; the
          // colour it was borrowing was doing no work here.
          "bg-[radial-gradient(circle_at_var(--spot-x,50%)_var(--spot-y,50%),color-mix(in_srgb,var(--foreground)_18%,transparent),transparent_70%)]",
        )}
      />
      {children}
    </div>
  );
}
