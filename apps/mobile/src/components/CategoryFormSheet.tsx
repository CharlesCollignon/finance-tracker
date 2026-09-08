import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { categoryTypeLabels } from "@finance/core/category-styles";
import type { Category, CategoryType } from "@finance/core/types/database";

import { CATEGORY_ICONS, CategoryIcon } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { cn } from "@/lib/cn";
import { upsertCategory } from "@/lib/mutations";
import { useToast } from "@/providers/ToastProvider";
import { useT } from "@/providers/LocaleProvider";

interface CategoryFormSheetProps {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: CategoryType[] = ["income", "expense", "savings", "investment"];

const ICON_KEYS = Object.keys(CATEGORY_ICONS);

/** Create or rename a category, pick its type, icon and summary behaviour. */
export function CategoryFormSheet({
  open,
  category,
  onClose,
  onSaved,
}: CategoryFormSheetProps) {
  const t = useT();
  const { toast } = useToast();
  const isEditing = category !== null;
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<CategoryType>(category?.type ?? "expense");
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [countsToward, setCountsToward] = useState(
    category?.counts_toward_summary ?? true,
  );
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    const result = await upsertCategory({
      id: category?.id,
      name,
      type,
      icon,
      countsTowardSummary: countsToward,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(
      isEditing ? t("categories.updated") : t("categories.added"),
      "success",
    );
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
          accessibilityLabel={t("categories.close")}
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-3xl border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {isEditing
                ? t("categories.editCategory")
                : t("categories.newCategory")}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t("categories.close")}
              hitSlop={8}
            >
              <Text variant="muted">{t("categories.close")}</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-2 text-sm font-medium">
              {t("categories.name")}
            </Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t("categories.namePlaceholder")}
              className="mb-4"
            />

            <Text className="mb-2 text-sm font-medium">
              {t("categories.type")}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {TYPES.map((value) => {
                const selected = type === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setType(value)}
                    className={cn(
                      "rounded-full border px-4 py-2",
                      selected
                        ? "border-foreground bg-foreground"
                        : "border-border bg-background",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-sm font-semibold",
                        selected ? "text-background" : "text-muted-foreground",
                      )}
                    >
                      {categoryTypeLabels()[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 text-sm font-medium">
              {t("categories.icon")}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {ICON_KEYS.map((key) => {
                const selected = icon === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                    accessibilityState={{ selected }}
                    onPress={() => setIcon(selected ? null : key)}
                    className={cn(
                      "rounded-lg border",
                      selected ? "border-primary" : "border-transparent",
                    )}
                  >
                    <CategoryIcon icon={key} />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: countsToward }}
              onPress={() => setCountsToward((value) => !value)}
              className="mb-4 flex-row items-center gap-3 rounded-lg border border-border px-3 py-3"
            >
              <View
                className={cn(
                  "h-5 w-5 rounded border",
                  countsToward
                    ? "border-primary bg-primary"
                    : "border-border bg-background",
                )}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium">
                  Counts toward totals
                </Text>
                <Text variant="muted" className="text-xs">
                  Off for transfers you don&apos;t want in the monthly summary.
                </Text>
              </View>
            </Pressable>

            <Button
              label={
                pending ? t("categories.saving") : t("categories.saveCategory")
              }
              size="lg"
              disabled={pending || !name.trim()}
              onPress={handleSave}
            />
            <View className="h-10" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
