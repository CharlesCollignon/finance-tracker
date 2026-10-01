import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { categoryTypeLabels } from "@finance/core/category-styles";
import type { Category, CategoryType } from "@finance/core/types/database";

import { CATEGORY_ICONS, CategoryIcon } from "@/components/CategoryIcon";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { cn } from "@/lib/cn";
import { upsertCategory } from "@/lib/mutations";
import { useToast } from "@/providers/ToastProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface CategoryFormSheetProps {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: CategoryType[] = ["income", "expense", "savings", "investment"];

const ICON_KEYS = Object.keys(CATEGORY_ICONS);

/** What each icon shows, for a screen reader: the keys are code names. */
const ICON_LABEL = {
  wallet: "formPickers.iconWallet",
  lightning: "formPickers.iconLightning",
  wifi: "formPickers.iconWifi",
  buildings: "formPickers.iconBuildings",
  house: "formPickers.iconHouse",
  bank: "formPickers.iconBank",
  "credit-card": "formPickers.iconCreditCard",
  shield: "formPickers.iconShield",
  "shopping-cart": "formPickers.iconShoppingCart",
  barbell: "formPickers.iconBarbell",
  car: "formPickers.iconCar",
  television: "formPickers.iconTelevision",
  "dots-three": "formPickers.iconDotsThree",
  "piggy-bank": "formPickers.iconPiggyBank",
  "chart-line": "formPickers.iconChartLine",
  "currency-btc": "formPickers.iconCurrencyBtc",
  "trend-up": "formPickers.iconTrendUp",
} as const satisfies Record<string, string>;

function iconLabelKey(key: string) {
  return key in ICON_LABEL
    ? ICON_LABEL[key as keyof typeof ICON_LABEL]
    : "formPickers.iconDotsThree";
}

/** What unticking "counts" means, which depends on the kind of money. */
const COUNTS_HINT = {
  income: "categories.countsHintIncome",
  expense: "categories.countsHintExpense",
  savings: "categories.countsHintSavings",
  investment: "categories.countsHintInvestment",
} as const satisfies Record<CategoryType, string>;

/** Create or rename a category, pick its type, icon and summary behaviour. */
export function CategoryFormSheet({
  open,
  category,
  onClose,
  onSaved,
}: CategoryFormSheetProps) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const colors = useThemeColors();
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
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
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
            <ChoiceChips
              label={t("categories.type")}
              className="mb-4"
              options={TYPES.map((value) => ({
                value,
                label: categoryTypeLabels(locale)[value],
              }))}
              value={type}
              onChange={setType}
            />

            <Text className="mb-2 text-sm font-medium">
              {t("categories.icon")}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {ICON_KEYS.map((key) => {
                const selected = icon === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityLabel={t(iconLabelKey(key))}
                    accessibilityState={{ selected }}
                    onPress={() => setIcon(selected ? null : key)}
                    className={cn(
                      "h-12 w-12 items-center justify-center rounded-control border",
                      selected
                        ? "border-foreground bg-secondary"
                        : "border-transparent",
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
              className="mb-4 min-h-12 flex-row items-center gap-3 rounded-control border border-border px-3 py-3"
            >
              <View
                className={cn(
                  "h-6 w-6 items-center justify-center rounded-control border",
                  countsToward
                    ? "border-foreground bg-foreground"
                    : "border-border bg-background",
                )}
              >
                {countsToward ? (
                  <Ionicons
                    name="checkmark"
                    size={ICON.sm}
                    color={colors.background}
                  />
                ) : null}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium">
                  {t("categories.countsTowardBudget")}
                </Text>
                <Text variant="muted" className="text-xs">
                  {t(COUNTS_HINT[type])}
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
