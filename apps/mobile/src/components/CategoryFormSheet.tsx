import { useState } from "react";
import { Pressable, Switch, View } from "react-native";

import type { Category, CategoryType } from "@finance/core/types/database";

import { KIND_INK } from "@/components/add/kind-ink";
import { KindSwitch } from "@/components/add/KindSwitch";
import { CATEGORY_ICONS, CategoryGlyph } from "@/components/CategoryIcon";
import {
  EntrySheet,
  Field,
  SaveButton,
} from "@/components/sheet/EntrySheet";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { upsertCategory } from "@/lib/mutations";
import { useToast } from "@/providers/ToastProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface CategoryFormSheetProps {
  open: boolean;
  category: Category | null;
  onClose: () => void;
}

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
}: CategoryFormSheetProps) {
  const t = useT();
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
    onClose();
  }

  const ink = colors[KIND_INK[type]];

  return (
    <EntrySheet
      visible={open}
      onClose={onClose}
      title={
        isEditing ? t("categories.editCategory") : t("categories.newCategory")
      }
      closeLabel={t("categories.close")}
      ink={ink}
      footer={
        <SaveButton
          label={
            pending
              ? t("categories.saving")
              : name.trim()
                ? t("categories.saveCategory")
                : t("entry.gap.name")
          }
          disabled={pending || !name.trim()}
          onPress={() => void handleSave()}
        />
      }
    >
      {/* What the category will look like wherever it is listed, as it is
          being made: its glyph on a disc in its kind's colour, its name. */}
      <View className="items-center gap-2.5 pb-2 pt-5">
        <View
          className="h-16 w-16 items-center justify-center rounded-[22px]"
          style={{ backgroundColor: ink }}
        >
          <CategoryGlyph icon={icon} color={colors.background} size={ICON.hero} />
        </View>
        <Text
          numberOfLines={1}
          className={name.trim() ? "font-semibold" : "font-semibold text-muted-foreground"}
          style={{ fontSize: 20 }}
        >
          {name.trim() || t("categories.namePlaceholder")}
        </Text>
      </View>

      <View className="mt-4 gap-4">
        <Field label={t("categories.name")}>
          <Input
            tone="sheet"
            value={name}
            onChangeText={setName}
            placeholder={t("categories.namePlaceholder")}
          />
        </Field>

        <Field label={t("categories.type")}>
          <KindSwitch value={type} onChange={setType} />
        </Field>

        <Field label={t("categories.icon")}>
          <View className="flex-row flex-wrap gap-2">
            {ICON_KEYS.map((key) => {
              const selected = icon === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={t(iconLabelKey(key))}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void hapticSelection();
                    setIcon(selected ? null : key);
                  }}
                  style={{
                    backgroundColor: selected ? ink : `${colors.foreground}0f`,
                  }}
                  className="h-12 w-12 items-center justify-center rounded-2xl active:opacity-70"
                >
                  <CategoryGlyph
                    icon={key}
                    color={selected ? colors.background : colors.foreground}
                  />
                </Pressable>
              );
            })}
          </View>
        </Field>

        <View className="flex-row items-start gap-3 border-t border-border pt-3">
          <View className="flex-1">
            <Text className="font-medium">
              {t("categories.countsTowardBudget")}
            </Text>
            <Text variant="muted" className="mt-0.5 text-xs">
              {t(COUNTS_HINT[type])}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("categories.countsTowardBudget")}
            value={countsToward}
            onValueChange={(next) => {
              void hapticSelection();
              setCountsToward(next);
            }}
            trackColor={{ false: colors.secondary, true: ink }}
            thumbColor={countsToward ? colors.background : colors.foreground}
          />
        </View>
      </View>
    </EntrySheet>
  );
}
