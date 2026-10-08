import { Pressable } from "react-native";
import { type Href, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** The way to « Questions », under the month read on Le point. */
export function AskLink() {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={6}
      onPress={() => {
        void hapticLight();
        router.push("/ask" as Href);
      }}
      className="mt-3 flex-row items-center gap-1.5 self-start rounded-full py-1"
    >
      <Ionicons
        name="chatbubble-ellipses-outline"
        size={ICON.md}
        color={colors.mutedForeground}
      />
      <Text variant="muted" className="text-sm font-medium">
        {t("ask.openFromRead")}
      </Text>
    </Pressable>
  );
}
