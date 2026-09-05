import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { groupCategoriesByType } from "@finance/core/categories";
import {
  describeSelectionDeletion,
  describeSelectionMove,
  type MoveEffect,
  type SelectionSummary,
} from "@finance/core/selection";
import type { Category } from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** Mirrors the tab bar height so the sheet clears it. */
const TAB_BAR_HEIGHT = 60;

/** Tall enough to browse, short enough to leave the warning on screen. */
const PICKER_MAX_HEIGHT = 220;

interface SelectionBarProps {
  summary: SelectionSummary;
  pending: boolean;
  onCancel: () => void;
  onDelete: () => void;
  categories: Category[];
  planMove: (categoryId: string) => MoveEffect | null;
  onMove: (categoryId: string) => void;
}

/**
 * The bar that appears once rows are selected.
 *
 * Floats above the tab bar rather than sitting in the list, because the
 * selection is made by scrolling and the action has to stay reachable from
 * wherever the user stopped. Deleting is behind a second press: it cannot be
 * undone, and on a list of checkboxes a stray tap is easy.
 *
 * Moving is not behind one, for the reason the web twin gives: a move is
 * undone by moving back. The exception is a move that changes the category
 * type, which rewrites the totals of every past month it touches.
 *
 * The picker is a list inside the bar rather than a sheet, which is the one
 * place this departs from the house pattern. A sheet would cover the sentence
 * saying which merchants the move will not teach, and that sentence is the
 * reason the picker has a warning at all.
 */
export function SelectionBar({
  summary,
  pending,
  onCancel,
  onDelete,
  categories,
  planMove,
  onMove,
}: SelectionBarProps) {
  const formatEuro = useFormatCurrency();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [target, setTarget] = useState("");

  if (summary.count === 0) {
    return null;
  }

  const groups = groupCategoriesByType(categories);
  const effect = target ? planMove(target) : null;
  const moveNote = effect
    ? describeSelectionMove(
        effect,
        summary,
        categories.find((category) => category.id === target)?.name ?? "",
      )
    : null;
  const needsConfirm = (effect?.typeChanges ?? 0) > 0;

  function close() {
    setChoosing(false);
    setTarget("");
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
        ) : choosing ? (
          <>
            <Text className="text-sm font-semibold">
              {`Move ${summary.count} ${
                summary.count === 1 ? "transaction" : "transactions"
              } to`}
            </Text>

            <ScrollView
              style={{ maxHeight: PICKER_MAX_HEIGHT }}
              className="rounded-xl border border-border"
              keyboardShouldPersistTaps="handled"
            >
              {groups.map((group) => (
                <View key={group.type}>
                  <Text
                    variant="muted"
                    className="px-3 pb-1 pt-2 text-xs uppercase tracking-wider"
                  >
                    {group.label}
                  </Text>
                  {group.categories.map((category) => (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: target === category.id }}
                      disabled={pending}
                      onPress={() => setTarget(category.id)}
                      className={cn(
                        "min-h-11 flex-row items-center justify-between px-3 py-2",
                        target === category.id && "bg-primary/10",
                      )}
                    >
                      <Text className="text-sm">{category.name}</Text>
                      {target === category.id ? (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={colors.primary}
                        />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>

            {moveNote ? (
              <Text variant="muted" className="text-sm">
                {moveNote}
              </Text>
            ) : null}

            <View className="flex-row gap-2">
              <Button
                label={
                  pending ? "Moving…" : needsConfirm ? "Yes, move them" : "Move"
                }
                variant="outline"
                className="flex-1"
                disabled={pending || !target}
                onPress={() => {
                  onMove(target);
                  close();
                }}
              />
              <Button
                label="Cancel"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onPress={close}
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
                label="Move"
                variant="outline"
                size="sm"
                disabled={pending}
                onPress={() => setChoosing(true)}
              />
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
        <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
      ) : null}
    </Pressable>
  );
}
