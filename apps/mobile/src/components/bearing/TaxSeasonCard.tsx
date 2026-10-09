import { Pressable, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Le point in April to June: the return's amounts are ready. The web's twin
 * is `components/tax/TaxSeasonCard.tsx`.
 */
export function TaxSeasonCard({ year }: { year: number }) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Animated.View entering={FadeInDown.springify().damping(16)}>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          void hapticLight();
          router.push("/tax" as Href);
        }}
        className="flex-row items-center gap-4 rounded-card border border-border bg-card/70 p-card"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Ionicons name="receipt-outline" size={ICON.lg} color={colors.foreground} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium">{t("tax.seasonTitle")}</Text>
          <Text variant="muted" className="text-sm">
            {t("tax.seasonBody", { year })}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={ICON.md} color={colors.foreground} />
      </Pressable>
    </Animated.View>
  );
}
