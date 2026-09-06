import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/**
 * A section the screen offers rather than asserts.
 *
 * Home had eleven blocks stacked at equal weight, which is a screen with no
 * answer to "how is the month going" — everything is shouting the same
 * volume. The figures that answer that question stay above; the ones that
 * elaborate on it live here, one tap away and closed by default.
 *
 * Closed is the resting state on purpose: a disclosure that remembers being
 * open is a disclosure that stops being a summary after the first visit.
 */
export function Disclosure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();

  // withTiming reads the system reduced-motion setting by default, so the
  // rotation simply lands at its end value when that is on.
  const turn = useDerivedValue(() =>
    withTiming(open ? 1 : 0, { duration: 180 }),
  );
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
  }));

  return (
    <View className="gap-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={() => {
          void hapticSelection();
          setOpen((value) => !value);
        }}
        className="flex-row items-center justify-center gap-1.5 py-1"
      >
        <Text variant="label">{open ? "Less" : label}</Text>
        <Animated.View style={chevron}>
          <Ionicons
            name="chevron-down"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        </Animated.View>
      </Pressable>

      {open ? <View className="gap-4">{children}</View> : null}
    </View>
  );
}
