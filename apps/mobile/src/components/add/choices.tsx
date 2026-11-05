import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

import { withAlpha } from "./kind-ink";

/**
 * A choice inside the Add sheet: a hairline when idle; once chosen, a rim and
 * a faint wash in the colour of the kind of money being entered, so what has
 * been decided reads as belonging to this entry.
 */
export function Chip({
  label,
  selected,
  ink,
  onPress,
  className,
}: {
  label: string;
  selected: boolean;
  ink: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        if (!selected) {
          void hapticSelection();
          onPress();
        }
      }}
      style={{
        borderColor: selected ? withAlpha(ink, 0.7) : "rgba(236,236,241,0.10)",
        backgroundColor: selected ? withAlpha(ink, 0.1) : "transparent",
      }}
      className={cn(
        "min-h-10 items-center justify-center rounded-full border px-4 active:opacity-70",
        className,
      )}
    >
      <Text
        className={cn(
          "text-[13px] font-medium",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Two answers side by side on a recessed track: Une fois · Régulièrement. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row rounded-xl bg-foreground/5 p-[3px]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                void hapticSelection();
                onChange(option.value);
              }
            }}
            style={
              selected
                ? {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }
                : { borderWidth: 1, borderColor: "transparent" }
            }
            className="h-9 flex-1 items-center justify-center rounded-[9px]"
          >
            <Text
              className={cn(
                "text-[13px] font-medium",
                selected ? "text-foreground" : "text-muted-foreground",
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

/**
 * Numbered cells seven to a row: the days of a month to pick one from, or
 * the 1–31 a recurring entry falls on. A cell that cannot be chosen (a day
 * still to come, for something that already happened) is drawn faint and
 * does nothing.
 */
export function DayCells({
  cells,
  selected,
  ink,
  marked,
  onPick,
  label,
}: {
  /** Null for an empty cell before the 1st, so weekdays line up. */
  cells: readonly ({ day: number; disabled?: boolean } | null)[];
  selected: number | null;
  ink: string;
  /** A day ringed rather than filled: today. */
  marked?: number | null;
  onPick: (day: number) => void;
  label: string;
}) {
  const colors = useThemeColors();
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} className="gap-0.5">
      {rows.map((row, r) => (
        <View key={r} className="flex-row gap-0.5">
          {Array.from({ length: 7 }, (_, c) => {
            const cell = row[c] ?? null;
            if (!cell) {
              return <View key={c} className="h-9 flex-1" />;
            }
            const isSelected = cell.day === selected;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: isSelected,
                  disabled: cell.disabled,
                }}
                disabled={cell.disabled}
                onPress={() => {
                  void hapticSelection();
                  onPick(cell.day);
                }}
                style={{
                  backgroundColor: isSelected ? ink : "transparent",
                  borderWidth: 1,
                  borderColor:
                    !isSelected && cell.day === marked
                      ? "rgba(236,236,241,0.16)"
                      : "transparent",
                }}
                className="h-9 flex-1 items-center justify-center rounded-[10px]"
              >
                <Text
                  className={cn(
                    "tabular-nums text-sm",
                    isSelected && "font-semibold",
                  )}
                  style={{
                    color: isSelected
                      ? colors.background
                      : cell.disabled
                        ? "rgba(155,155,173,0.35)"
                        : colors.foreground,
                  }}
                >
                  {cell.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
