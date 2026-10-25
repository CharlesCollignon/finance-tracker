import type { ReactNode } from "react";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { FADE_IN } from "@/components/motion/fade";

import { cn } from "@/lib/cn";

interface FadeInProps {
  children: ReactNode;
  className?: string;
}

/**
 * A block arriving: a fade, opacity alone. It was a rise and, through
 * `StaggerItem`, a cascade 40ms a step; since October 2026 everything in the
 * app arrives this way and nothing waits its turn, as on the web. Reanimated
 * plays it on mount only, so a re-render does not replay it.
 */
export function FadeIn({ children, className }: FadeInProps) {
  const reduce = useReducedMotion();

  return (
    <Animated.View
      entering={reduce ? undefined : FADE_IN}
      className={cn(className)}
    >
      {children}
    </Animated.View>
  );
}
