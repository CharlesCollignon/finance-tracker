import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { hapticLight } from "@/lib/haptics";
import { useRefreshAll } from "@/providers/RefreshProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** A full turn takes this long, in ms. */
const SPIN_PERIOD = 900;

/**
 * Ask the bank, from the header band every screen already has.
 *
 * Pull-to-refresh re-reads Supabase and always has. This is the control that
 * asks the bank for anything new — a different and slower thing — so it is a
 * deliberate press rather than a gesture, and it spins while it waits because
 * a bank round trip is long enough that a still icon reads as a dead button.
 *
 * The dot says the figures are some hours old. Not a warning: a statement
 * fetched this morning is a perfectly ordinary thing to be looking at, and
 * colouring it red would teach people to ignore the colour.
 */
export function RefreshButton() {
  const refresh = useRefreshAll();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);

  const running = refresh?.running ?? false;
  const active = running && !reduce;

  // Assigning to a shared value cancels whatever animation was running on
  // it, which is how the Orb's loading spin stops too.
  useEffect(() => {
    if (!active) {
      spin.value = 0;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(360, { duration: SPIN_PERIOD, easing: Easing.linear }),
      -1,
      false,
    );
  }, [active, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  if (!refresh?.available) {
    return null;
  }

  const label = running
    ? "Asking your bank…"
    : refresh.known
      ? `Refresh — last checked ${refresh.age}`
      : "Ask your bank for anything new";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: running }}
      disabled={running}
      onPress={() => {
        void hapticLight();
        refresh.refresh();
      }}
      className="h-9 w-9 items-center justify-center rounded-md border border-border"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <Animated.View style={style}>
        <Ionicons name="refresh" size={18} color={colors.mutedForeground} />
      </Animated.View>
      {refresh.stale && !running ? (
        <View
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colors.primary }}
        />
      ) : null}
    </Pressable>
  );
}
