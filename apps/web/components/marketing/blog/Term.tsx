"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * A word a reader may not know — « débit différé », « unités de compte » —
 * underlined with dots, explained in a small glass card above it on a press,
 * a hover or a focus. Escape, a press elsewhere or leaving it puts the card
 * away. The explanation is in the page for a screen reader all along; under
 * reduced motion the card is simply there.
 */
export function Term({ def, children }: { def: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const still = useReducedMotion() ?? false;
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "cursor-help rounded-sm text-marketing-ink underline decoration-white/40 decoration-dotted underline-offset-4",
          marketingFocus,
        )}
      >
        {children}
      </button>
      <span id={id} className="sr-only">
        {def}
      </span>
      <AnimatePresence>
        {open ? (
          <m.span
            aria-hidden
            role="tooltip"
            initial={still ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={still ? undefined : { opacity: 0, y: 4 }}
            transition={{ duration: DURATION.hover / 1000, ease: EASE }}
            className="glass-panel absolute bottom-full left-1/2 z-20 mb-2 block w-64 -translate-x-1/2 rounded-2xl p-3 text-left text-sm leading-relaxed text-marketing-ink"
          >
            {def}
          </m.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
