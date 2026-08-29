import { useEffect } from "react";
import { View, type ViewProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Orb } from "@/components/Orb";
import { cn } from "@/lib/cn";

interface SkeletonProps extends ViewProps {
  className?: string;
}

/** Pulsing placeholder block. */
export function Skeleton({ className, style, ...props }: SkeletonProps) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (reduce) {
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[animatedStyle, style]}
      className={cn("rounded-lg bg-hairline-strong", className)}
      {...props}
    />
  );
}

/** Centred orb for indeterminate waits, where a shape preview would lie. */
export function LoadingOrb({ label }: { label?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading"}
      className="items-center justify-center gap-3 py-10"
    >
      <Orb size="hero" spin="loading" />
    </View>
  );
}

/** Screen-level placeholder: a hero block then a few rows. */
export function ScreenSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} className="flex-row items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </View>
          <Skeleton className="h-3.5 w-16" />
        </View>
      ))}
    </View>
  );
}
