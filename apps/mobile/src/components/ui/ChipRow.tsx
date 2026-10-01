import { Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipRowProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the row filters, read before the chips by a screen reader. */
  label: string;
  className?: string;
}

/**
 * One line of filter chips that scrolls sideways, as on the web.
 *
 * The rows these replace wrapped onto a second and third line, so a screen
 * with three filters spent a quarter of its height on them before the first
 * entry. Selected is the foreground fill, never gold: the web keeps its accent
 * for the one thing on a page that wants a decision.
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: ChipRowProps<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        className={className}
        contentContainerClassName="gap-1.5"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              hitSlop={{ top: 8, bottom: 8 }}
              onPress={() => {
                if (!selected) {
                  void hapticSelection();
                  onChange(option.value);
                }
              }}
              className={cn(
                "h-8 justify-center rounded-full border px-3",
                selected ? "border-foreground bg-foreground" : "border-border",
              )}
            >
              <Text
                numberOfLines={1}
                className={cn(
                  "text-xs font-medium",
                  selected ? "text-background" : "text-muted-foreground",
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
