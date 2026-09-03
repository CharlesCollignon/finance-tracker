import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

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
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/providers/ToastProvider";
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
  const { toast } = useToast();
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
  const [startsOn, setStartsOn] = useState(template?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(template?.ends_on ?? "");
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
    if (startsOn.trim()) {
      payload.startsOn = startsOn.trim();
    }
    if (endsOn.trim()) {
      payload.endsOn = endsOn.trim();
    }

    const result = await upsertRecurringTemplate(payload);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast(
      "Saved — apply recurring in the Ledger to see the change.",
      "success",
    );
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
    toast("Deleted — apply recurring in the Ledger to see the change.");
    onSaved();
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
              {isEditing ? "Edit recurring item" : "Add recurring item"}
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
            <View className="mb-4 gap-2">
              {groups.map((group) => (
                <View key={group.type} className="gap-1">
                  <Text variant="muted">{group.label}</Text>
                  {group.categories.map((cat) => {
                    const selected = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={cat.name}
                        onPress={() => setCategoryId(cat.id)}
                        className={`rounded-full border px-3 py-2 ${
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

            <Text className="mb-2 text-sm font-medium">Amount (EUR)</Text>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">Description</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">Schedule</Text>
            <View className="mb-4 flex-row gap-2">
              {(["monthly", "weekly", "yearly"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: recurrence === value }}
                  accessibilityLabel={value}
                  onPress={() => setRecurrence(value)}
                  className={`flex-1 rounded-full border py-2 ${
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
                <Text className="mb-2 text-sm font-medium">
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
                    <Text className="mb-2 text-sm font-medium">
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
                <Text className="mb-2 text-sm font-medium">Day of month</Text>
                <Input
                  value={dayOfMonth}
                  onChangeText={setDayOfMonth}
                  keyboardType="number-pad"
                  className="mb-4"
                />
              </>
            )}

            <Text className="mb-1 text-sm font-medium">
              Active period (optional)
            </Text>
            <Text variant="muted" className="mb-3 text-xs">
              Leave empty for open-ended.
            </Text>
            <Text className="mb-2 text-sm font-medium">Starts on</Text>
            <DateField
              value={startsOn}
              onChange={setStartsOn}
              placeholder="No start date"
              clearable
              className="mb-4"
            />
            <Text className="mb-2 text-sm font-medium">Ends on</Text>
            <DateField
              value={endsOn}
              onChange={setEndsOn}
              placeholder="No end date"
              clearable
              className="mb-4"
            />

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
