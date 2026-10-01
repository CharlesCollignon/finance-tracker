import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The search box at the top of a picker sheet.
 *
 * Not focused on opening, as the web's is: on a phone that raises a keyboard
 * over half the options before anyone has decided whether they need to type.
 */
export function PickerSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const t = useT();
  const colors = useThemeColors();

  return (
    <View className="h-11 flex-row items-center gap-2 rounded-full border border-border bg-background px-3.5">
      <Ionicons
        name="search-outline"
        size={ICON.md}
        color={colors.mutedForeground}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        className="h-11 flex-1 font-sans text-sm text-foreground"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ledger.clearSearch")}
          hitSlop={8}
          onPress={() => onChange("")}
        >
          <Ionicons
            name="close-circle"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
