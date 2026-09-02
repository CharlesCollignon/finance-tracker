import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { recurringOccurrenceKey } from "@finance/core/apply-recurring";

import type {
  ApplyRecurringPlan,
  RecurringOccurrenceUpdate,
} from "@finance/core/apply-recurring";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

const EMPTY_KEYS: ReadonlySet<string> = new Set();

interface ApplyRecurringSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ApplyRecurringPlan | null;
  pending: boolean;
  onConfirm: (includeUpdates: boolean, selectedKeys: Set<string>) => void;
}

function Checkbox({ checked }: { checked: boolean }) {
  const checkColor = useThemeColors().primaryForeground;

  return (
    <View
      className={cn(
        "h-5 w-5 items-center justify-center rounded border",
        checked ? "border-primary bg-primary" : "border-border bg-background",
      )}
    >
      {checked ? (
        <Ionicons name="checkmark" size={14} color={checkColor} />
      ) : null}
    </View>
  );
}

function UpdateRow({
  item,
  selected,
  onToggle,
}: {
  item: RecurringOccurrenceUpdate;
  selected: boolean;
  onToggle: () => void;
}) {
  const formatEuro = useFormatCurrency();
  const amountChanged = Math.abs(item.previousAmount - item.amount) > 0.009;
  const noteChanged =
    (item.previousNote?.trim() ?? "") !== (item.note?.trim() ?? "");
  const categoryChanged = item.previousCategoryId !== item.categoryId;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={item.name}
      onPress={onToggle}
      className={cn(
        "flex-row gap-3 rounded-lg border p-3",
        selected ? "border-border" : "border-border opacity-50",
      )}
    >
      <Checkbox checked={selected} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium">{item.name}</Text>
        <Text variant="muted" className="mt-0.5 text-xs">
          {item.dateLabel}
        </Text>
        {amountChanged ? (
          <View className="mt-2 flex-row items-center gap-1">
            <Text className="text-sm">Amount </Text>
            <PrivateAmount className="text-sm text-muted-foreground line-through">
              {formatEuro(item.previousAmount)}
            </PrivateAmount>
            <Text className="text-sm"> → </Text>
            <PrivateAmount className="text-sm font-semibold">
              {formatEuro(item.amount)}
            </PrivateAmount>
          </View>
        ) : null}
        {noteChanged ? (
          <Text variant="muted" className="mt-1 text-xs">
            Note updated to match recurring template
          </Text>
        ) : null}
        {categoryChanged ? (
          <Text variant="muted" className="mt-1 text-xs">
            Moved to the recurring template’s category
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Bottom sheet listing exactly what applying recurring will change, mirroring
 * the web ApplyRecurringSheet. Replaces a stock Alert that only reported
 * counts.
 */
export function ApplyRecurringSheet({
  open,
  onOpenChange,
  plan,
  pending,
  onConfirm,
}: ApplyRecurringSheetProps) {
  const formatEuro = useFormatCurrency();

  const allKeys = useMemo(() => {
    if (!plan) {
      return [] as string[];
    }
    return [
      ...plan.toCreate.map((item) =>
        recurringOccurrenceKey(item.templateId, item.occurredOn),
      ),
      ...plan.toUpdate.map((item) =>
        recurringOccurrenceKey(item.templateId, item.occurredOn),
      ),
    ];
  }, [plan]);

  // Everything starts selected; deselecting is the exception, not the rule.
  // The set is tagged with the plan it belongs to so a new plan reads as empty
  // without an effect resetting it.
  const planKey = allKeys.join("|");
  const [deselection, setDeselection] = useState<{
    planKey: string;
    keys: Set<string>;
  } | null>(null);
  const deselected =
    deselection?.planKey === planKey ? deselection.keys : EMPTY_KEYS;

  const isSelected = (key: string) => !deselected.has(key);
  const toggle = (key: string) =>
    setDeselection((current) => {
      const base = current?.planKey === planKey ? current.keys : EMPTY_KEYS;
      const next = new Set(base);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { planKey, keys: next };
    });
  const selectedKeys = new Set(allKeys.filter((key) => !deselected.has(key)));

  if (!plan) {
    return null;
  }

  const hasCreates = plan.toCreate.length > 0;
  const hasUpdates = plan.toUpdate.length > 0;
  const selectedCount = selectedKeys.size;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => onOpenChange(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel="Close"
          className="flex-1"
          onPress={() => onOpenChange(false)}
        />
        <View className="max-h-[85%] rounded-t-3xl border border-border bg-card p-5">
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-hairline-strong" />
          <Text className="mb-2 font-semibold" style={{ fontSize: 18 }}>
            Apply recurring
          </Text>
          <Text variant="muted" className="text-sm">
            Adds missing recurring transactions for this month. Existing entries
            are left as-is unless you confirm updates below.
          </Text>
          {plan.toReprice.length > 0 ? (
            <Text variant="muted" className="mt-2 text-sm">
              {`${plan.toReprice.length} ${
                plan.toReprice.length === 1 ? "entry is" : "entries are"
              } priced from the market and still ahead of today. Those follow their instrument on their own — nothing to confirm.`}
            </Text>
          ) : null}

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {hasUpdates ? (
              <View className="gap-2">
                <Text className="text-sm font-medium">
                  {`Update existing (${plan.toUpdate.length})`}
                </Text>
                <Text variant="muted" className="text-xs">
                  These were already applied but the recurring template changed
                  (amount, note, or category).
                </Text>
                {plan.toUpdate.map((item) => (
                  <UpdateRow
                    key={item.transactionId}
                    item={item}
                    selected={isSelected(
                      recurringOccurrenceKey(item.templateId, item.occurredOn),
                    )}
                    onToggle={() =>
                      toggle(
                        recurringOccurrenceKey(
                          item.templateId,
                          item.occurredOn,
                        ),
                      )
                    }
                  />
                ))}
              </View>
            ) : null}

            {hasCreates ? (
              <View className="mt-4 gap-2">
                <Text className="text-sm font-medium">
                  {`Add new (${plan.toCreate.length})`}
                </Text>
                {plan.toCreate.map((item) => {
                  const key = recurringOccurrenceKey(
                    item.templateId,
                    item.occurredOn,
                  );
                  const selected = isSelected(key);
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={item.name}
                      onPress={() => toggle(key)}
                      className={cn(
                        "flex-row items-center gap-3 rounded-lg border border-border px-3 py-2",
                        !selected && "opacity-50",
                      )}
                    >
                      <Checkbox checked={selected} />
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-sm font-medium">
                          {item.name}
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {item.dateLabel}
                        </Text>
                      </View>
                      <PrivateAmount className="text-sm font-semibold">
                        {formatEuro(item.amount)}
                      </PrivateAmount>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          <View className="mt-4 gap-2">
            <Button
              label={
                pending
                  ? "Applying…"
                  : selectedCount === 0
                    ? "Nothing selected"
                    : hasUpdates
                      ? `Apply ${selectedCount} selected`
                      : `Apply ${selectedCount} new`
              }
              size="lg"
              disabled={pending || selectedCount === 0}
              onPress={() => onConfirm(hasUpdates, selectedKeys)}
            />
            {hasUpdates && hasCreates ? (
              <Button
                label="Add new only — skip updates"
                variant="outline"
                size="lg"
                disabled={pending}
                onPress={() => onConfirm(false, selectedKeys)}
              />
            ) : null}
            <Button
              label="Cancel"
              variant="outline"
              size="lg"
              disabled={pending}
              onPress={() => onOpenChange(false)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
