import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type {
  Category,
  Recurrence,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import {
  deleteRecurringTemplate,
  upsertRecurringTemplate,
} from "@/lib/mutations";

interface RecurringFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
}

export function RecurringFormModal({
  open,
  onClose,
  onSaved,
  categories,
  template = null,
}: RecurringFormModalProps) {
  const isEditing = template !== null;
  const [categoryId, setCategoryId] = useState(template?.category_id ?? "");
  const [amount, setAmount] = useState(
    template ? String(Number(template.amount)) : "",
  );
  const [description, setDescription] = useState(template?.description ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>(
    template?.recurrence ?? "monthly",
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    String(template?.day_of_month ?? 1),
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    String(template?.day_of_week ?? 1),
  );
  const [monthOfYear, setMonthOfYear] = useState(
    String(template?.month_of_year ?? 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const groups = useMemo(
    () => groupCategoriesByType(categories, { excludeTypes: ["income"] }),
    [categories],
  );

  async function handleSave() {
    setPending(true);
    setError(null);
    const payload: Record<string, unknown> = {
      ...(isEditing ? { id: template.id } : {}),
      categoryId,
      amount,
      description: description || undefined,
      recurrence,
      pricingType: "fixed",
      active: template?.active !== false,
    };
    if (recurrence === "monthly") {
      payload.dayOfMonth = dayOfMonth;
    } else if (recurrence === "weekly") {
      payload.dayOfWeek = dayOfWeek;
    } else {
      payload.monthOfYear = monthOfYear;
      payload.dayOfMonth = dayOfMonth;
    }

    const result = await upsertRecurringTemplate(payload);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!template) {
      return;
    }
    setPending(true);
    const result = await deleteRecurringTemplate(template.id);
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
        <View className="max-h-[90%] border-2 border-border bg-background">
          <View className="flex-row items-center justify-between border-b-2 border-border bg-primary px-4 py-3">
            <Text className="font-bold">
              {isEditing ? "Edit recurring" : "Add recurring"}
            </Text>
            <Pressable onPress={onClose}>
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
                        className={`border-2 px-3 py-2 ${
                          selected
                            ? "border-foreground bg-primary"
                            : "border-border"
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
              className="mb-4"
            />

            <Text variant="label" className="mb-2">
              Description
            </Text>
            <Input
              value={description}
              onChangeText={setDescription}
              className="mb-4"
            />

            <Text variant="label" className="mb-2">
              Schedule
            </Text>
            <View className="mb-4 flex-row gap-2">
              {(["monthly", "weekly", "yearly"] as const).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRecurrence(value)}
                  className={`flex-1 border-2 py-2 ${
                    recurrence === value
                      ? "border-foreground bg-primary"
                      : "border-border"
                  }`}
                >
                  <Text className="text-center text-xs font-semibold capitalize">
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>

            {recurrence === "weekly" ? (
              <>
                <Text variant="label" className="mb-2">
                  Day of week (1=Mon … 7=Sun)
                </Text>
                <Input
                  value={dayOfWeek}
                  onChangeText={setDayOfWeek}
                  keyboardType="number-pad"
                  className="mb-4"
                />
              </>
            ) : (
              <>
                {recurrence === "yearly" ? (
                  <>
                    <Text variant="label" className="mb-2">
                      Month (1–12)
                    </Text>
                    <Input
                      value={monthOfYear}
                      onChangeText={setMonthOfYear}
                      keyboardType="number-pad"
                      className="mb-4"
                    />
                  </>
                ) : null}
                <Text variant="label" className="mb-2">
                  Day of month
                </Text>
                <Input
                  value={dayOfMonth}
                  onChangeText={setDayOfMonth}
                  keyboardType="number-pad"
                  className="mb-4"
                />
              </>
            )}

            {error ? (
              <Text className="mb-3 text-destructive">{error}</Text>
            ) : null}

            <Button
              label={pending ? "Saving…" : "Save"}
              disabled={pending}
              onPress={handleSave}
              className="mb-3"
            />
            {isEditing ? (
              <Button
                label="Delete"
                variant="outline"
                disabled={pending}
                onPress={handleDelete}
                className="mb-8 border-destructive"
              />
            ) : (
              <View className="mb-8" />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
