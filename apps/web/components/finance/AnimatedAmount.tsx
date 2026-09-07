"use client";

import { useEffect, useRef, useState } from "react";

import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { usePrivacyOn } from "@/lib/use-privacy";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

interface AnimatedAmountProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  /** What this figure is, on hover. Forwarded to PrivateAmount. */
  title?: string;
}

const DURATION_MS = 650;

/** Ease-out cubic — fast start, settles gently on the final figure. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts a figure up when it changes.
 *
 * The web counterpart of `AnimatedAmount` in the phone app, and deliberately
 * the same 650ms ease-out cubic over `requestAnimationFrame` rather than a
 * spring: the two clients show the same figure and a spring settles on a
 * different curve, so the same amount would arrive differently depending on
 * which screen you were holding.
 *
 * This replaces a vendored `CountUp` that had sat unused since it was added.
 * It formatted its own digits with a thousands separator and took no format
 * function, so it could not render an amount in the user's currency — which
 * is most of why nothing ever called it.
 *
 * Skips the animation when the figure is masked (there is nothing to watch
 * behind the blur) or the user has asked for reduced motion, and always lands
 * exactly on `value` rather than on the last frame's interpolation.
 */
export function AnimatedAmount({
  value,
  format,
  className,
  title,
}: AnimatedAmountProps) {
  const hidden = usePrivacyOn();
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;

    if (reduce || hidden || from === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setDisplay(from + (value - from) * easeOut(progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // Settle on the target so an interrupted run never leaves a stale figure.
      fromRef.current = value;
    };
  }, [value, hidden, reduce]);

  return (
    <PrivateAmount className={className} title={title}>
      {format(display)}
    </PrivateAmount>
  );
}
