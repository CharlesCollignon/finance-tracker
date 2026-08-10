import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatMonthLabel, shiftMonth } from "@finance/core/constants";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/theme/tokens";

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  return (
    <View className="flex-row items-center justify-between border-2 border-border bg-card px-2 py-1">
      <Pressable
        accessibilityLabel="Previous month"
        onPress={() => {
          const next = shiftMonth(year, month, -1);
          onChange(next.year, next.month);
        }}
        className="h-10 w-10 items-center justify-center"
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.foreground} />
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
        <Ionicons name="chevron-forward" size={20} color={COLORS.foreground} />
      </Pressable>
    </View>
  );
}
