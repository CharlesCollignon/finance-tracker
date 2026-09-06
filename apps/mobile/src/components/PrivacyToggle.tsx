import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { usePrivacy } from "@/providers/PrivacyProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { hapticLight } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";

export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  const colors = useThemeColors();

  return (
    <Pressable
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={hidden ? "Show amounts" : "Hide amounts"}
      onPress={() => {
        void hapticLight();
        toggle();
      }}
      className="h-9 w-9 items-center justify-center rounded-md border border-border"
      style={{
        backgroundColor: hidden ? `${colors.primary}22` : colors.card,
        borderColor: colors.border,
      }}
    >
      <Ionicons
        name={hidden ? "eye-off-outline" : "eye-outline"}
        size={ICON.lg}
        color={hidden ? colors.primary : colors.mutedForeground}
      />
    </Pressable>
  );
}
