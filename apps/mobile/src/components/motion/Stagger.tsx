import type { ReactNode } from "react";

import { FadeIn } from "@/components/motion/FadeIn";

/** Matches the web Stagger's 40ms cadence. */
const STAGGER_MS = 40;

/** Caps the delay so long lists don't leave later rows visibly late. */
const MAX_STEPS = 8;

interface StaggerItemProps {
  index: number;
  children: ReactNode;
  className?: string;
}

/**
 * One item in a staggered enter. Reanimated entering animations only run on
 * mount, so this plays once and does not replay on re-render — the same
 * behaviour the web Stagger locks in explicitly.
 */
export function StaggerItem({ index, children, className }: StaggerItemProps) {
  return (
    <FadeIn
      delayMs={Math.min(index, MAX_STEPS) * STAGGER_MS}
      className={className}
    >
      {children}
    </FadeIn>
  );
}
