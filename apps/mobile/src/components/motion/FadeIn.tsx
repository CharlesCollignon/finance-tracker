import type { ReactNode } from "react";
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { cn } from "@/lib/cn";

interface FadeInProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

const NOCTURNE_EASING = Easing.bezier(...EASE_STANDARD);

/** Soft enter: opacity + slight rise, 500ms ledger-style ease. */
export function FadeIn({ children, delayMs = 0, className }: FadeInProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <Animated.View className={cn(className)}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(DURATION.enter)
        .easing(NOCTURNE_EASING)
        .delay(delayMs)}
      className={cn(className)}
    >
      {children}
    </Animated.View>
  );
}
