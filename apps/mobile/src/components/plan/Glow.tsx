import { useEffect, useId } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/** The orb's body colour, `C2` in `components/Orb.tsx`. */
const ORB_BODY = "#f4a23a";

/** One inhale, as the orb's own (`INHALE`): the two breathe together. */
const INHALE = 2_800;

/**
 * The orb's warm light, behind something worth celebrating — a milestone
 * reached, a run kept alive. Light rather than shadow: a radial wash of the
 * orb's body colour that fades to nothing, breathing on the orb's period.
 * Centred on its parent, which must be `relative` and give it room.
 *
 * Under reduced motion it holds at its middle, as the orb's halo does: a
 * steady soft light, not none.
 */
export function Glow({
  size,
  strength = 1,
  breathe = true,
}: {
  size: number;
  /** 0 to 1: how bright at the centre. */
  strength?: number;
  breathe?: boolean;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (reduce || !breathe) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: INHALE, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, breathe, pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          left: "50%",
          top: "50%",
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <Stop
              offset="0"
              stopColor={ORB_BODY}
              stopOpacity={0.42 * strength}
            />
            <Stop
              offset="0.45"
              stopColor={ORB_BODY}
              stopOpacity={0.16 * strength}
            />
            <Stop offset="1" stopColor={ORB_BODY} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${id}-glow)`} />
      </Svg>
    </Animated.View>
  );
}
