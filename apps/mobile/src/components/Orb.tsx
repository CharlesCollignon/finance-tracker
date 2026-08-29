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

import { cn } from "@/lib/cn";

type OrbSize = "sm" | "nav" | "hero" | "watermark";

export interface OrbProps extends ViewProps {
  size?: OrbSize;
  /** Rotates continuously. Loading spins; the brand mark drifts. */
  spin?: "none" | "drift" | "loading";
  className?: string;
}

const BOX: Record<OrbSize, number> = {
  sm: 26,
  nav: 40,
  hero: 88,
  watermark: 320,
};

/** A full turn takes this long, in ms. */
const PERIOD: Record<"drift" | "loading", number> = {
  drift: 24000,
  loading: 1600,
};

/**
 * The Pluclair orb.
 *
 * Rotating the artwork is what makes its internal gradients appear to move —
 * the bands are asymmetric, so a slow turn reads as drifting colour rather
 * than as a spinning image. The same component at a faster period is the
 * app's loading indicator, so brand and progress share one object.
 */
export function Orb({
  size = "nav",
  spin = "drift",
  className,
  style,
  ...props
}: OrbProps) {
  const box = BOX[size];
  const reduce = useReducedMotion();
  const angle = useSharedValue(0);
  const active = spin !== "none" && !reduce;

  useEffect(() => {
    if (!active) {
      angle.value = 0;
      return;
    }
    angle.value = 0;
    angle.value = withRepeat(
      withTiming(360, {
        duration: PERIOD[spin === "loading" ? "loading" : "drift"],
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [active, spin, angle]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Pluclair"
      className={cn("items-center justify-center", className)}
      style={[{ width: box, height: box }, style]}
      {...props}
    >
      <Animated.Image
        source={require("../../assets/images/logo-mark.png")}
        style={[{ width: box, height: box }, animatedStyle]}
        resizeMode="contain"
      />
    </View>
  );
}
