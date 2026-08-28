import { Modal, Pressable, ScrollView, View } from "react-native";

import type {
  ApplyRecurringPlan,
  RecurringOccurrenceUpdate,
} from "@finance/core/apply-recurring";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";

interface ApplyRecurringSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ApplyRecurringPlan | null;
  pending: boolean;
  onConfirm: (includeUpdates: boolean) => void;
}

function UpdateRow({ item }: { item: RecurringOccurrenceUpdate }) {
  const formatEuro = useFormatCurrency();
  const amountChanged = Math.abs(item.previousAmount - item.amount) > 0.009;
  const noteChanged =
    (item.previousNote?.trim() ?? "") !== (item.note?.trim() ?? "");

  return (
    <View className="rounded-lg border border-border p-3">
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
    </View>
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

  if (!plan) {
    return null;
  }

  const hasCreates = plan.toCreate.length > 0;
  const hasUpdates = plan.toUpdate.length > 0;

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
          <Text variant="heading" className="mb-2">
            Apply recurring
          </Text>
          <Text variant="muted" className="text-sm">
            Adds missing recurring transactions for this month. Existing entries
            are left as-is unless you confirm updates below.
          </Text>

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
                  <UpdateRow key={item.transactionId} item={item} />
                ))}
              </View>
            ) : null}

            {hasCreates ? (
              <View className="mt-4 gap-2">
                <Text className="text-sm font-medium">
                  {`Add new (${plan.toCreate.length})`}
                </Text>
                {plan.toCreate.map((item) => (
                  <View
                    key={`${item.templateId}:${item.occurredOn}`}
                    className="flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
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
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View className="mt-4 gap-2">
            <Button
              label={
                pending
                  ? "Applying…"
                  : hasUpdates
                    ? "Apply new & update changed"
                    : "Apply new entries"
              }
              size="lg"
              disabled={pending}
              onPress={() => onConfirm(hasUpdates)}
            />
            {hasUpdates && hasCreates ? (
              <Button
                label="Add new only — skip updates"
                variant="outline"
                size="lg"
                disabled={pending}
                onPress={() => onConfirm(false)}
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
