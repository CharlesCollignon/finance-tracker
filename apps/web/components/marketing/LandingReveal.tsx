"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EASE_STANDARD } from "@finance/core/motion";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * The two scroll reveals the marketing pages use, and the only reason any of
 * this is client-side. Kept in one file so a server-rendered section can wrap
 * a block without becoming a client component itself.
 *
 * An IntersectionObserver and a CSS transition. These used to be two
 * vendored react-bits components on gsap and its ScrollTrigger plugin, which
 * were the only thing in the app that used gsap: a whole animation library
 * shipped to every visitor for a fade and a rise.
 *
 * Both collapse to a plain wrapper under prefers-reduced-motion rather than
 * running at 0.01ms, so nothing depends on an animation having finished.
 */

const EASE = `cubic-bezier(${EASE_STANDARD.join(", ")})`;

/** The block has come into view: once, and it stays shown. */
function useShownOnce(threshold: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || shown) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, shown]);

  return { ref, shown };
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds, so a list can stagger its items. */
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, shown } = useShownOnce(0.15);
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transition: `opacity 600ms ${EASE} ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export function Rise({
  children,
  className,
  distance = 24,
}: {
  children: ReactNode;
  className?: string;
  /** Pixels it rises through. */
  distance?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, shown } = useShownOnce(0.15);
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${distance}px)`,
        transition: `opacity 700ms ${EASE}, transform 700ms ${EASE}`,
      }}
    >
      <div className={className}>{children}</div>
    </div>
  );
}
