import type { ReactNode } from "react";
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";

interface FadeInProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

const NOCTURNE_EASING = Easing.bezier(0.32, 0.72, 0, 1);

/** Soft enter: opacity + slight rise, 500ms ledger-style ease. */
export function FadeIn({ children, delayMs = 0, className }: FadeInProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <Animated.View className={cn(className)}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(500).easing(NOCTURNE_EASING).delay(delayMs)}
      className={cn(className)}
    >
      {children}
    </Animated.View>
  );
}
