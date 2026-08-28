import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { todayIsoLocal } from "@finance/core/constants";
import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type {
  Category,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import {
  createTransaction,
  deleteTransaction,
  skipRecurringOccurrence,
  updateTransaction,
} from "@/lib/mutations";

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  categories: Category[];
  transaction?: TransactionWithCategory | null;
  defaultDate?: string;
}

/**
 * Transaction sheet mirroring the web TransactionForm: category, amount, date
 * and note, then — when editing — the skip and delete actions behind inline
 * confirmations rather than a system alert.
 */
export function TransactionFormModal({
  open,
  onClose,
  onSaved,
  onDeleted,
  categories,
  transaction = null,
  defaultDate = todayIsoLocal(),
}: TransactionFormModalProps) {
  const isEditing = transaction !== null;
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [amount, setAmount] = useState(
    transaction ? String(Number(transaction.amount)) : "",
  );
  const [occurredOn, setOccurredOn] = useState(
    transaction?.occurred_on ?? defaultDate,
  );
  const [note, setNote] = useState(transaction?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const groups = groupCategoriesByType(categories);
  const templateId = transaction?.recurring_template_id ?? null;
  const canSkip = isEditing && Boolean(templateId);

  async function handleSave() {
    setPending(true);
    setError(null);
    const payload = {
      ...(isEditing ? { id: transaction.id } : {}),
      categoryId,
      amount,
      occurredOn,
      note: note || undefined,
    };
    const result = isEditing
      ? await updateTransaction(payload)
      : await createTransaction(payload);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!transaction) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await deleteTransaction(transaction.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    (onDeleted ?? onSaved)();
    onClose();
  }

  async function handleSkip() {
    if (!transaction || !templateId) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await skipRecurringOccurrence(
      templateId,
      transaction.occurred_on,
      transaction.id,
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    (onDeleted ?? onSaved)();
    onClose();
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel="Close"
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-3xl border border-border bg-card">
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-hairline-strong" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {isEditing ? "Edit transaction" : "Add transaction"}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <Text variant="muted">Close</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-2 text-sm font-medium">Category</Text>
            <View className="mb-4 gap-3">
              {groups.map((group) => (
                <View key={group.type} className="gap-1.5">
                  <Text variant="muted" className="text-xs">
                    {group.label}
                  </Text>
                  {group.categories.map((cat) => {
                    const selected = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setCategoryId(cat.id)}
                        className={cn(
                          "flex-row items-center gap-3 rounded-lg border px-3 py-2",
                          selected
                            ? "border-primary bg-primary/15"
                            : "border-border bg-background",
                        )}
                      >
                        <CategoryIcon icon={cat.icon} />
                        <Text className="flex-1 text-sm">
                          {formatCategoryOptionLabel(cat)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Text className="mb-2 text-sm font-medium">Amount (EUR)</Text>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">Date</Text>
            <DateField
              value={occurredOn}
              onChange={setOccurredOn}
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">Note (optional)</Text>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Description"
              className="mb-4"
            />

            {error ? (
              <Text className="mb-3 text-sm text-destructive">{error}</Text>
            ) : null}

            <Button
              label={pending ? "Saving…" : "Save transaction"}
              size="lg"
              disabled={pending}
              onPress={handleSave}
            />

            {isEditing ? (
              <View className="mt-6 gap-3 border-t border-border pt-4">
                {canSkip ? (
                  confirmSkip ? (
                    <View className="gap-2">
                      <Text variant="muted" className="text-sm">
                        Skip this date only? The entry will be removed and Apply
                        won&apos;t recreate it. The recurring rule stays active
                        for later months.
                      </Text>
                      <View className="flex-row gap-2">
                        <Button
                          label={pending ? "Skipping…" : "Yes, skip this date"}
                          variant="outline"
                          className="flex-1"
                          disabled={pending}
                          onPress={handleSkip}
                        />
                        <Button
                          label="Cancel"
                          variant="outline"
                          className="flex-1"
                          disabled={pending}
                          onPress={() => setConfirmSkip(false)}
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      label="Skip this month / date"
                      variant="outline"
                      disabled={pending}
                      onPress={() => {
                        setConfirmDelete(false);
                        setConfirmSkip(true);
                      }}
                    />
                  )
                ) : null}

                {confirmDelete ? (
                  <View className="gap-2">
                    <Text variant="muted" className="text-sm">
                      Delete this transaction permanently? (Apply may recreate
                      it if the recurring rule is still active.)
                    </Text>
                    <View className="flex-row gap-2">
                      <Button
                        label={pending ? "Deleting…" : "Yes, delete"}
                        variant="outline"
                        className="flex-1 border-destructive"
                        disabled={pending}
                        onPress={handleDelete}
                      />
                      <Button
                        label="Cancel"
                        variant="outline"
                        className="flex-1"
                        disabled={pending}
                        onPress={() => setConfirmDelete(false)}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    label="Delete transaction"
                    variant="outline"
                    className="border-destructive"
                    disabled={pending}
                    onPress={() => {
                      setConfirmSkip(false);
                      setConfirmDelete(true);
                    }}
                  />
                )}
              </View>
            ) : null}

            <View className="h-10" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
