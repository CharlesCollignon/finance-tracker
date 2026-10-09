import { Pressable } from "react-native";
import { type Href, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * « Questions », beside the refresh in the header: a sparkle for the AI, on
 * every screen of the app. It turns and pops under the finger, and fills on
 * the screen it opens. The web's twin is `components/ask/AskButton.tsx`.
 */
export function AskButton() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();
  const press = useSharedValue(0);
  const here = pathname === "/ask";
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${press.get() * 18}deg` },
      { scale: 1 + press.get() * 0.12 },
    ],
  }));

  return (
    <Pressable
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={t("ask.title")}
      accessibilityState={{ selected: here }}
      onPressIn={() => press.set(withSpring(1, { damping: 12, stiffness: 320 }))}
      onPressOut={() => press.set(withSpring(0, { damping: 14, stiffness: 260 }))}
      onPress={() => {
        if (here) {
          return;
        }
        void hapticLight();
        router.push("/ask" as Href);
      }}
      className="h-9 w-9 items-center justify-center rounded-control border border-border"
    >
      <Animated.View style={style}>
        <Ionicons
          name={here ? "sparkles" : "sparkles-outline"}
          size={ICON.lg}
          color={here ? colors.foreground : colors.mutedForeground}
        />
      </Animated.View>
    </Pressable>
  );
}
