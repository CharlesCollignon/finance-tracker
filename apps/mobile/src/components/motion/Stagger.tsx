import type { ReactNode } from "react";

import { staggerDelay } from "@finance/core/motion";

import { FadeIn } from "@/components/motion/FadeIn";

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
    <FadeIn delayMs={staggerDelay(index)} className={className}>
      {children}
    </FadeIn>
  );
}
