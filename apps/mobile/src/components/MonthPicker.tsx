import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
} from "@finance/core/constants";
import { Blur } from "@/components/ui/Blur";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON, RADIUS } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  /**
   * The Ledger's own month bar: a larger month, full 44pt arrows, and a way
   * back to this month when another one is showing. The month is what the
   * whole list below is about, so it is set as the list's heading rather
   * than as one control among the housekeeping buttons. A panel that only
   * needs a month to read leaves this off.
   */
  prominent?: boolean;
}

export function MonthPicker({
  year,
  month,
  onChange,
  prominent = false,
}: MonthPickerProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const current = getCurrentMonth();
  const away = current.year !== year || current.month !== month;
  const arrowClass = prominent
    ? "h-11 w-11 items-center justify-center"
    : "h-10 w-10 items-center justify-center";

  return (
    <Blur
      style={{
        borderRadius: RADIUS.control,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between px-2 py-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.previousMonth")}
          onPress={() => {
            const next = shiftMonth(year, month, -1);
            onChange(next.year, next.month);
          }}
          className={arrowClass}
        >
          <Ionicons
            name="chevron-back"
            size={ICON.xl}
            color={colors.foreground}
          />
        </Pressable>

        <View className="min-w-0 flex-1 flex-row items-center justify-center gap-2">
          <Text
            accessibilityRole={prominent ? "header" : undefined}
            numberOfLines={1}
            className="shrink font-semibold"
            style={prominent ? { fontSize: 18 } : undefined}
          >
            {formatMonthLabel(year, month, locale)}
          </Text>
          {/* Only when it has somewhere to go. Stepping back from next
              spring one arrow at a time is the chore this saves; on this
              month it would be a button that does nothing. */}
          {prominent && away ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.thisMonth")}
              hitSlop={8}
              onPress={() => {
                void hapticLight();
                onChange(current.year, current.month);
              }}
              className="rounded-full border border-border bg-background px-2.5 py-1"
            >
              <Text className="text-xs font-medium text-muted-foreground">
                {t("common.thisMonth")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.nextMonth")}
          onPress={() => {
            const next = shiftMonth(year, month, 1);
            onChange(next.year, next.month);
          }}
          className={arrowClass}
        >
          <Ionicons
            name="chevron-forward"
            size={ICON.xl}
            color={colors.foreground}
          />
        </Pressable>
      </View>
    </Blur>
  );
}
