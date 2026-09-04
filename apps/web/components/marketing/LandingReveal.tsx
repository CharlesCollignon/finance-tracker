"use client";

import type { ReactNode } from "react";
import AnimatedContent from "@/components/react-bits/AnimatedContent";
import FadeContent from "@/components/react-bits/FadeContent";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";

/**
 * The two scroll reveals the marketing pages use, and the only reason any of
 * this is client-side. Kept in one file so a server-rendered section can wrap
 * a block without becoming a client component itself.
 *
 * Both collapse to a plain wrapper under prefers-reduced-motion rather than
 * running at 0.01ms, so nothing depends on an animation having finished.
 */

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <FadeContent
      className={className}
      duration={0.6}
      delay={delay}
      threshold={0.15}
    >
      {children}
    </FadeContent>
  );
}

export function Rise({
  children,
  className,
  distance = 24,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <AnimatedContent distance={distance} duration={0.7} threshold={0.15}>
      <div className={className}>{children}</div>
    </AnimatedContent>
  );
}
