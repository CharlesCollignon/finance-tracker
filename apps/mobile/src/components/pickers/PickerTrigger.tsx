import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface PickerTriggerProps {
  /** The field's name, read out together with its value. */
  label: string;
  /** What the field holds, or null while nothing is chosen. */
  value: string | null;
  /** Shown, muted, while nothing is chosen. */
  placeholder: string;
  /** Drawn before the value: a category's icon. */
  leading?: ReactNode;
  open: boolean;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A field that opens a picker: the choice, and a chevron that says there is
 * more behind it. The same height, border and ground as `Input`, so a form
 * mixing typed fields and chosen ones reads as one column.
 */
export function PickerTrigger({
  label,
  value,
  placeholder,
  leading,
  open,
  onPress,
  disabled,
  className,
}: PickerTriggerProps) {
  const t = useT();
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("formPickers.fieldValue", {
        label,
        value: value ?? placeholder,
      })}
      accessibilityState={{ expanded: open, disabled }}
      disabled={disabled}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      className={cn(
        "min-h-12 w-full flex-row items-center gap-2 rounded-control border border-border bg-background px-4 py-2",
        disabled && "opacity-50",
        className,
      )}
    >
      {leading ? <View>{leading}</View> : null}
      <Text
        numberOfLines={1}
        className={cn(
          "min-w-0 flex-1 text-base",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value ?? placeholder}
      </Text>
      <Ionicons
        name="chevron-down"
        size={ICON.sm}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}
