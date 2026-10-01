import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * One choice in a picker sheet. The chosen one sits on the raised ground with
 * a check, as on the web — neither gold, which the app keeps for decisions,
 * nor a border, which would make a grid of options read as a grid of fields.
 */
export function PickerOptionRow({
  label,
  selected,
  onPress,
  leading,
  className,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  className?: string;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      className={cn(
        "min-h-12 flex-row items-center gap-2 rounded-control px-2.5 py-2",
        selected ? "bg-muted" : "active:bg-muted/60",
        className,
      )}
    >
      {leading}
      <Text
        numberOfLines={2}
        className={cn("min-w-0 flex-1 text-sm", selected && "font-medium")}
      >
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark" size={ICON.sm} color={colors.foreground} />
      ) : null}
    </Pressable>
  );
}

/** The width of one cell in a picker grid of `columns`. */
export function cellWidth(columns: 1 | 2 | 3): `${number}%` {
  return columns === 3 ? "33.333%" : columns === 2 ? "50%" : "100%";
}
