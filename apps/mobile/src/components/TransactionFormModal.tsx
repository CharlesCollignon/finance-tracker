import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { todayIsoLocal } from "@finance/core/constants";
import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type { Category, Transaction } from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { createTransaction, updateTransaction } from "@/lib/mutations";

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  transaction?: Transaction | null;
  defaultDate?: string;
}

export function TransactionFormModal({
  open,
  onClose,
  onSaved,
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

  const groups = groupCategoriesByType(categories);

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

  return (
    <Modal visible={open} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[90%] border border-border bg-background">
          <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-3">
            <Text className="font-bold">
              {isEditing ? "Edit transaction" : "Add transaction"}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <Text className="font-bold">Close</Text>
            </Pressable>
          </View>
          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <Text variant="label" className="mb-2">
              Category
            </Text>
            <View className="mb-4 gap-2">
              {groups.map((group) => (
                <View key={group.type} className="gap-1">
                  <Text variant="muted">{group.label}</Text>
                  {group.categories.map((cat) => {
                    const selected = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setCategoryId(cat.id)}
                        className={`border px-3 py-2 ${
                          selected
                            ? "border-foreground bg-primary"
                            : "border-border bg-background"
                        }`}
                      >
                        <Text>{formatCategoryOptionLabel(cat)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Text variant="label" className="mb-2">
              Amount (EUR)
            </Text>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              className="mb-4"
            />

            <Text variant="label" className="mb-2">
              Date (YYYY-MM-DD)
            </Text>
            <Input
              value={occurredOn}
              onChangeText={setOccurredOn}
              autoCapitalize="none"
              className="mb-4"
            />

            <Text variant="label" className="mb-2">
              Note (optional)
            </Text>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Description"
              className="mb-4"
            />

            {error ? (
              <Text className="mb-3 text-destructive">{error}</Text>
            ) : null}

            <Button
              label={pending ? "Saving…" : "Save transaction"}
              disabled={pending}
              onPress={handleSave}
              className="mb-8"
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
