import type { ReactNode } from "react";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";

interface FadeInProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

/** Soft enter: opacity + slight rise, ~200ms ease-out. */
export function FadeIn({ children, delayMs = 0, className }: FadeInProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <Animated.View className={cn(className)}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(200).delay(delayMs)}
      className={cn(className)}
    >
      {children}
    </Animated.View>
  );
}
