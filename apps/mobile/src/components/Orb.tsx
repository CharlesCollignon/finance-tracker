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

type OrbSize = "sm" | "nav" | "hero" | "login" | "watermark";

export interface OrbProps extends ViewProps {
  size?: OrbSize;
  /** Only the loading indicator turns; see the note on the component. */
  spin?: "none" | "loading";
  className?: string;
}

const BOX: Record<OrbSize, number> = {
  sm: 26,
  nav: 40,
  hero: 88,
  login: 160,
  watermark: 320,
};

/** A full turn takes this long, in ms. */
const LOADING_PERIOD = 1600;

/**
 * The Pluclair orb.
 *
 * It does not drift any more. The mark used to be a flat, roughly symmetric
 * disc, so turning it slowly read as colour moving inside the sphere. The new
 * artwork is a lit ball with a fixed highlight, and rotating that sends the
 * highlight orbiting the surface — which reads as a rendering bug rather than
 * a shine.
 *
 * Spinning survives for the loading indicator alone, where a gold ball
 * rolling is the point and the logo is literally a ball that rolls.
 */
export function Orb({
  size = "nav",
  spin = "none",
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
      withTiming(360, { duration: LOADING_PERIOD, easing: Easing.linear }),
      -1,
      false,
    );
  }, [active, angle]);

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
