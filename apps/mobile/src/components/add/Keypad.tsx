import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AmountKey } from "@finance/core/amount-input";

import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const ROWS: AmountKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
];

/**
 * The keypad, with no borders: twelve quiet targets that light up under the
 * finger. The decimal key shows the reader's own separator — a comma in
 * French — while still sending "." to the entry.
 */
export function Keypad({ onKey }: { onKey: (key: AmountKey) => void }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const separator = locale === "fr" ? "," : ".";

  return (
    <View className="flex-1 gap-1.5">
      {ROWS.map((row) => (
        <View key={row.join("")} className="flex-1 flex-row gap-1.5">
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={
                key === "backspace"
                  ? t("quickAdd.deleteLastDigit")
                  : key === "."
                    ? t("entry.decimal")
                    : key
              }
              onPress={() => onKey(key)}
              onLongPress={key === "backspace" ? () => onKey("clear") : undefined}
              className="min-h-10 flex-1 items-center justify-center rounded-2xl active:bg-foreground/10"
            >
              {key === "backspace" ? (
                <Ionicons
                  name="backspace-outline"
                  size={ICON.hero - 4}
                  color={colors.mutedForeground}
                />
              ) : (
                <Text className="tabular-nums" style={{ fontSize: 24 }}>
                  {key === "." ? separator : key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
