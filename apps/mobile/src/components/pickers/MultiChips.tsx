import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface MultiChipsProps {
  options: readonly { value: string; label: string }[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** What the group picks, read before the chips. */
  label: string;
  className?: string;
}

/**
 * Any number of choices at once: a transaction's tags. A chosen chip carries
 * a check as well as the raised ground, so "on" is never said by colour
 * alone; the forms had said it in gold.
 */
export function MultiChips({
  options,
  values,
  onChange,
  label,
  className,
}: MultiChipsProps) {
  const colors = useThemeColors();

  return (
    <View
      accessibilityLabel={label}
      className={cn("flex-row flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const on = values.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            onPress={() => {
              void hapticSelection();
              onChange(
                on
                  ? values.filter((value) => value !== option.value)
                  : [...values, option.value],
              );
            }}
            className={cn(
              "min-h-11 flex-row items-center gap-1.5 rounded-full border px-4",
              on ? "border-foreground bg-secondary" : "border-border",
            )}
          >
            {on ? (
              <Ionicons
                name="checkmark"
                size={ICON.sm}
                color={colors.foreground}
              />
            ) : null}
            <Text
              className={cn(
                "text-sm",
                on ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
