import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import type { Category, CategoryType } from "@finance/core/types/database";

import { CategoryGlyph } from "@/components/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { KIND_INK } from "./kind-ink";

const QUESTION_KEY = {
  expense: "entry.whereFrom.expense",
  income: "entry.whereFrom.income",
  savings: "entry.whereFrom.savings",
  investment: "entry.whereFrom.investment",
} as const;

interface CategoryGridProps {
  kind: CategoryType;
  /** The kind's categories, the ones used lately first. */
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  /** Closes the sheet before going to Catégories. */
  onLeave: () => void;
}

/**
 * The kind's categories laid out four to a row, each a glyph on a disc with
 * its name under it: the list a finger scans, not a picker to open. The
 * chosen one fills in the kind's colour.
 */
export function CategoryGrid({
  kind,
  categories,
  value,
  onChange,
  onLeave,
}: CategoryGridProps) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  const ink = colors[KIND_INK[kind]];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 8 }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-muted-foreground">
          {t(QUESTION_KEY[kind])}
        </Text>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => {
            onLeave();
            router.push("/categories");
          }}
        >
          <Text className="text-[13px] font-medium">{t("entry.manage")}</Text>
        </Pressable>
      </View>

      {categories.length === 0 ? (
        <Text variant="muted">{t("entry.noCategory")}</Text>
      ) : (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("entry.category")}
          className="flex-row flex-wrap"
        >
          {categories.map((category) => {
            const selected = category.id === value;
            return (
              <Pressable
                key={category.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={category.name}
                onPress={() => {
                  void hapticSelection();
                  onChange(category.id);
                }}
                style={{ width: "25%" }}
                className="items-center gap-1.5 px-0.5 pb-3 active:opacity-70"
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: selected ? ink : `${colors.foreground}0f`,
                  }}
                >
                  <CategoryGlyph
                    icon={category.icon}
                    color={selected ? colors.background : colors.foreground}
                  />
                </View>
                <Text
                  numberOfLines={2}
                  className={
                    selected
                      ? "text-center text-xs font-medium text-foreground"
                      : "text-center text-xs text-muted-foreground"
                  }
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
