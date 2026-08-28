import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

interface DateFieldProps {
  /** ISO date, YYYY-MM-DD. Empty string means unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Allows clearing back to an empty value (open-ended end dates). */
  clearable?: boolean;
  className?: string;
}

/** Local-time ISO date, so picking "today" never lands on yesterday in UTC. */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return new Date();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function formatDisplay(value: string): string {
  if (!value) {
    return "";
  }
  const date = parseIsoDate(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Date entry through the platform picker. Replaces the hand-typed YYYY-MM-DD
 * fields — logging a transaction is the app's most repeated action, and typing
 * ten characters correctly was its largest source of friction.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = false,
  className,
}: DateFieldProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    // Android fires once and owns its own dismissal.
    if (Platform.OS === "android") {
      setOpen(false);
    }
    if (event.type === "dismissed" || !date) {
      return;
    }
    onChange(toIsoDate(date));
  }

  const display = formatDisplay(value);

  return (
    <View className={className}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={display ? `Date ${display}` : placeholder}
        onPress={() => setOpen(true)}
        className={cn(
          "min-h-12 flex-row items-center justify-between gap-2 rounded-lg",
          "border border-border bg-background px-3",
        )}
      >
        <Text className={cn("text-base", !display && "text-muted-foreground")}>
          {display || placeholder}
        </Text>
        <View className="flex-row items-center gap-2">
          {clearable && display ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear date"
              hitSlop={8}
              onPress={() => onChange("")}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : null}
          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.mutedForeground}
          />
        </View>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={parseIsoDate(value)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
