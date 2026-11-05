import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  lookupMerchant,
  suggestMerchants,
  type MerchantIndex,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type { Category } from "@finance/core/types/database";

import { CategoryGlyph } from "@/components/CategoryIcon";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** Enough to choose from without pushing the field off a small screen. */
const SHOWN = 4;

interface NotePanelProps {
  value: string;
  onChange: (value: string) => void;
  /** The remembered shops of the kind being entered, and only those. */
  merchants: MerchantIndex;
  categories: Category[];
  label: string;
  placeholder: string;
  onPick: (rule: MerchantRule) => void;
  onSubmit: () => void;
}

/**
 * The shop or the label. Before anything is typed it lists the shops used
 * last for this kind of money; typing narrows them. Picking one brings its
 * category, and its last amount when none is typed yet.
 */
export function NotePanel({
  value,
  onChange,
  merchants,
  categories,
  label,
  placeholder,
  onPick,
  onSubmit,
}: NotePanelProps) {
  const t = useT();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();

  const suggestions = useMemo(() => {
    if (value.trim() === "") {
      return [...merchants.values()]
        .sort((a, b) => b.lastUsedOn.localeCompare(a.lastUsedOn))
        .slice(0, SHOWN);
    }
    return suggestMerchants(merchants, value, SHOWN);
  }, [merchants, value]);

  const known = lookupMerchant(merchants, value);
  const iconOf = (id: string) =>
    categories.find((category) => category.id === id)?.icon ?? null;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Input
        autoFocus
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        accessibilityLabel={label}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        tone="sheet"
      />

      {value.trim() === "" && suggestions.length > 0 ? (
        <Text variant="muted" className="mt-3 text-xs">
          {t("entry.knownShopHint")}
        </Text>
      ) : null}
      {value.trim() !== "" && !known && suggestions.length === 0 ? (
        <Text variant="muted" className="mt-3 text-xs">
          {t("entry.newShop")}
        </Text>
      ) : null}

      <View className="mt-1">
        {suggestions.map((rule, index) => (
          <Pressable
            key={rule.key}
            accessibilityRole="button"
            accessibilityLabel={t("formPickers.useSuggestion", {
              label: rule.label,
              category: rule.categoryName,
            })}
            onPress={() => onPick(rule)}
            className={
              index === 0
                ? "min-h-14 flex-row items-center gap-3 py-2 active:opacity-70"
                : "min-h-14 flex-row items-center gap-3 border-t border-border py-2 active:opacity-70"
            }
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-foreground/5">
              <CategoryGlyph
                icon={iconOf(rule.categoryId)}
                color={colors.foreground}
                size={18}
              />
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="font-medium">
                {rule.label}
              </Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {t("entry.lastTime", { category: rule.categoryName })}
              </Text>
            </View>
            <Text variant="amount" className="text-sm text-muted-foreground">
              {formatEuro(rule.lastAmount)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
