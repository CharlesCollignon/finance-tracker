import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatMonthLabel, shiftMonth } from "@finance/core/constants";
import { Blur } from "@/components/ui/Blur";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/theme/useThemeColors";

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  const colors = useThemeColors();

  return (
    <Blur
      style={{
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between px-2 py-1">
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() => {
            const next = shiftMonth(year, month, -1);
            onChange(next.year, next.month);
          }}
          className="h-10 w-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text className="font-semibold">{formatMonthLabel(year, month)}</Text>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() => {
            const next = shiftMonth(year, month, 1);
            onChange(next.year, next.month);
          }}
          className="h-10 w-10 items-center justify-center"
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.foreground}
          />
        </Pressable>
      </View>
    </Blur>
  );
}
