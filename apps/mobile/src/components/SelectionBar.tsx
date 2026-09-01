import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  describeSelectionDeletion,
  type SelectionSummary,
} from "@finance/core/selection";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** Mirrors the tab bar height so the sheet clears it. */
const TAB_BAR_HEIGHT = 60;

interface SelectionBarProps {
  summary: SelectionSummary;
  pending: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

/**
 * The bar that appears once rows are selected.
 *
 * Floats above the tab bar rather than sitting in the list, because the
 * selection is made by scrolling and the action has to stay reachable from
 * wherever the user stopped. Deleting is behind a second press: it cannot be
 * undone, and on a list of checkboxes a stray tap is easy.
 */
export function SelectionBar({
  summary,
  pending,
  onCancel,
  onDelete,
}: SelectionBarProps) {
  const formatEuro = useFormatCurrency();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [confirming, setConfirming] = useState(false);

  if (summary.count === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: TAB_BAR_HEIGHT + insets.bottom + 12,
      }}
    >
      <View
        accessibilityRole="summary"
        accessibilityLabel={`${summary.count} transactions selected`}
        className="gap-3 rounded-2xl border border-border bg-card p-3"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        {confirming ? (
          <>
            <Text className="text-sm">
              {describeSelectionDeletion(summary)}
            </Text>
            <View className="flex-row gap-2">
              <Button
                label={pending ? "Deleting…" : "Yes, delete"}
                variant="outline"
                className="flex-1 border-destructive"
                disabled={pending}
                onPress={onDelete}
              />
              <Button
                label="Cancel"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onPress={() => setConfirming(false)}
              />
            </View>
          </>
        ) : (
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold">
                {`${summary.count} selected`}
                {summary.total > 0 ? (
                  <Text variant="muted" className="font-mono text-xs">
                    {`  ${formatEuro(summary.total)}`}
                  </Text>
                ) : null}
              </Text>
              {summary.recurringCount > 0 ? (
                <Text variant="muted" className="text-xs">
                  {`${summary.recurringCount} from recurring`}
                </Text>
              ) : null}
            </View>

            <View className="flex-row items-center gap-2">
              <Button
                label="Delete"
                variant="outline"
                size="sm"
                className="border-destructive"
                disabled={pending}
                onPress={() => setConfirming(true)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear selection"
                hitSlop={8}
                disabled={pending}
                onPress={onCancel}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/** A tap target sized checkbox, used on each selectable row. */
export function RowCheckbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className={cn(
        "h-6 w-6 items-center justify-center rounded-md border",
        checked ? "border-primary bg-primary" : "border-border bg-background",
      )}
    >
      {checked ? (
        <Ionicons
          name="checkmark"
          size={16}
          color={colors.primaryForeground}
        />
      ) : null}
    </Pressable>
  );
}
