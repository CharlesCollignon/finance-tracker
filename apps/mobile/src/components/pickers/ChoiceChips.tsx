import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";

interface ChoiceChipsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses, read before the chips. */
  label: string;
  /**
   * Each chip takes an equal share of the row, for two or three choices that
   * belong side by side: monthly, weekly, yearly.
   */
  fill?: boolean;
  className?: string;
}

/**
 * Two to four choices laid out rather than hidden behind a sheet — the web's
 * `ChoiceChips`. Selected is the foreground fill, as on every chip in the
 * app; the forms had been filling it gold.
 *
 * Wrapping rather than scrolling, unlike `ChipRow`: a form's choice is read
 * whole, and a fourth option hidden off the edge would never be seen.
 */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
  fill = false,
  className,
}: ChoiceChipsProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={cn("flex-row flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!selected) {
                void hapticSelection();
                onChange(option.value);
              }
            }}
            className={cn(
              "min-h-11 items-center justify-center rounded-full border px-4",
              fill && "flex-1",
              selected ? "border-foreground bg-foreground" : "border-border",
            )}
          >
            <Text
              numberOfLines={1}
              className={cn(
                "text-sm font-medium",
                selected ? "text-background" : "text-muted-foreground",
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
