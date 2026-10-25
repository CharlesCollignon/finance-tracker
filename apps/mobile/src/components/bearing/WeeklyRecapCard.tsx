import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useReducedMotion,
} from "react-native-reanimated";

import { monthLong } from "@finance/core/i18n/calendar-names";
import { weeklyRecapLines, type WeeklyRecap } from "@finance/core/weekly-recap";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { dismissWeeklyRecap } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { FADE_IN, FADE_OUT } from "@/components/motion/fade";

/** The mask `PrivateAmount` shows, here inside a sentence. */
const MASK = "••••••";

/**
 * Monday's recap, as a card on Le point: the push opened, in the same
 * sentences, one to a line — the web's own card. Put away with « Vu », for
 * the week and on every device.
 */
export function WeeklyRecapCard({ recap }: { recap: WeeklyRecap }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const format = useFormatCurrency();
  const { hidden } = usePrivacy();
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);

  if (gone) {
    return null;
  }

  const lines = weeklyRecapLines(recap, {
    t,
    formatMoney: (amount) => (hidden ? MASK : format(amount)),
    previousMonthName: monthLong(recap.monthSoFar.previousMonth, locale),
  });

  function dismiss() {
    void hapticLight();
    setGone(true);
    void dismissWeeklyRecap(recap.weekOf, locale);
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FADE_IN}
      exiting={reduceMotion ? undefined : FADE_OUT}
      className="gap-3 rounded-card border border-border bg-card/70 p-card"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Ionicons
              name="calendar-outline"
              size={ICON.sm}
              color={colors.foreground}
            />
          </View>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="shrink text-sm font-medium text-muted-foreground"
          >
            {t("recap.title")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={dismiss}
          hitSlop={6}
          className="min-h-9 justify-center rounded-full px-3"
        >
          <Text className="text-sm font-medium text-muted-foreground">
            {t("recap.dismiss")}
          </Text>
        </Pressable>
      </View>
      <View className="gap-1.5">
        {lines.map((line) => (
          <Text key={line} className="text-sm leading-relaxed">
            {line}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}
