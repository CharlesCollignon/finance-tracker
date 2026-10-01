import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface ReviewCategoryChooserProps {
  /** What is being filed — the shop, the row — so the reader keeps their place. */
  title: string;
  categories: Category[];
  /** Most-recently-used category ids, newest first. */
  recentCategoryIds: string[];
  value: string;
  onPick: (categoryId: string) => void;
  onBack: () => void;
}

/**
 * The categories, filling the review sheet while one is being chosen.
 *
 * The web gives every group its own dropdown picker. A phone has no room for
 * a dropdown per card and stacking a second modal over the sheet is fragile,
 * so choosing swaps the sheet's content for this list and a pick swaps it
 * back — the same answer, in the phone's shape.
 */
export function ReviewCategoryChooser({
  title,
  categories,
  recentCategoryIds,
  value,
  onPick,
  onBack,
}: ReviewCategoryChooserProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();
  // Filtered before grouping, so empty groups disappear while searching.
  const visible = trimmed
    ? categories.filter((category) =>
        category.name.toLowerCase().includes(trimmed),
      )
    : categories;
  const groups = groupCategoriesByType(
    visible.filter((category) => !category.archived),
    { locale },
  );
  // One tap instead of scrolling the grouped list, which is the common case:
  // the exceptions still land in the same handful of categories.
  const recent = recentCategoryIds
    .map((id) => categories.find((category) => category.id === id))
    .filter(
      (category): category is Category =>
        category !== undefined && !category.archived,
    )
    .slice(0, 4);

  function pick(categoryId: string) {
    void hapticLight();
    onPick(categoryId);
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("reviewScreens.back")}
          hitSlop={8}
          onPress={onBack}
          className="h-11 w-11 items-center justify-center rounded-full border border-border"
        >
          <Ionicons
            name="chevron-back"
            size={ICON.md}
            color={colors.foreground}
          />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium">
            {t("inboxGroups.whichCategory")}
          </Text>
          <Text variant="muted" numberOfLines={2} className="text-xs">
            {title}
          </Text>
        </View>
      </View>

      {categories.length > 8 ? (
        <View className="flex-row items-center gap-2 rounded-full border border-border bg-background px-3.5">
          <Ionicons
            name="search-outline"
            size={ICON.md}
            color={colors.mutedForeground}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("inbox.filterCategoriesPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t("inbox.filterCategories")}
            returnKeyType="search"
            className="h-11 flex-1 font-sans text-sm text-foreground"
          />
        </View>
      ) : null}

      {recent.length > 0 && !trimmed ? (
        <View className="gap-2">
          <Text variant="label">{t("inboxGroups.recentCategories")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {recent.map((category) => {
              const active = value === category.id;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={category.name}
                  onPress={() => pick(category.id)}
                  className={cn(
                    "min-h-11 flex-row items-center gap-2 rounded-full border px-3 py-2",
                    active ? "border-foreground bg-secondary" : "border-border",
                  )}
                >
                  <CategoryIcon icon={category.icon} className="h-6 w-6" />
                  <Text className="text-sm">{category.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.type} className="gap-1.5">
          <Text variant="label">{group.label}</Text>
          {group.categories.map((category) => {
            const active = value === category.id;
            return (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={category.name}
                onPress={() => pick(category.id)}
                className={cn(
                  "min-h-12 flex-row items-center gap-3 rounded-control border px-3 py-2",
                  active ? "border-foreground bg-secondary" : "border-border",
                )}
              >
                <CategoryIcon icon={category.icon} />
                <Text className="min-w-0 flex-1 text-sm">
                  {formatCategoryOptionLabel(category, locale)}
                </Text>
                {active ? (
                  <Ionicons
                    name="checkmark"
                    size={ICON.md}
                    color={colors.foreground}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
