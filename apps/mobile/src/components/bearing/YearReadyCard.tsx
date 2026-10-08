import { useState } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { dismissYearReview } from "@/lib/mutations";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * January's card on Le point, as on the web: « Votre année » is ready. It
 * opens the review, and « Vu » puts it away on every device.
 */
export function YearReadyCard({ year }: { year: number }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const [gone, setGone] = useState(false);
  if (gone) {
    return null;
  }
  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
      <View className="flex-row items-start gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Ionicons name="sparkles" size={ICON.md} color={colors.primaryForeground} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-base font-semibold">
            {t("yearReview.ready", { year })}
          </Text>
          <Text variant="muted" className="text-sm">
            {t("yearReview.readyBody")}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button
          label={t("yearReview.open")}
          size="sm"
          onPress={() => router.push(`/year?y=${year}` as Href)}
        />
        <Button
          label={t("yearReview.seen")}
          variant="ghost"
          size="sm"
          onPress={() => {
            void hapticLight();
            setGone(true);
            void dismissYearReview(year, locale);
          }}
        />
      </View>
    </View>
  );
}
