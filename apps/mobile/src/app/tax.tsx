import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  incomeYearFor,
  taxReturnBoxes,
  taxRulesFor,
  type TaxBoxFigure,
  type TaxBoxId,
  type TaxBoxSource,
} from "@finance/core/tax-return";
import { getCategories } from "@finance/data/categories";
import { getTaxBoxes, readTaxRows, setTaxBox } from "@finance/data/tax-return";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** How many years back the screen offers. */
const YEARS_BACK = 3;

const SOURCE_KEYS: Record<
  Exclude<TaxBoxSource, "categories">,
  "tax.fromPer" | "tax.fromRentBare" | "tax.fromRentFurnished"
> = {
  per: "tax.fromPer",
  "rent-bare": "tax.fromRentBare",
  "rent-furnished": "tax.fromRentFurnished",
};

/**
 * « Déclaration de revenus » on the phone, the twin of the web's `/tax`: one
 * card a box, its amount counting up, its rows a tap away, and the person's
 * categories to file in the boxes that take them. Their own money only.
 */
export default function TaxScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const latest = incomeYearFor(todayIsoLocal());
  const years = Array.from({ length: YEARS_BACK }, (_, index) => latest - index);
  const [year, setYear] = useState(latest);

  const { data, reload } = useRefreshable(
    async () => {
      if (!user) {
        return null;
      }
      const [rows, filed, categories] = await Promise.all([
        readTaxRows(supabase, user.id, year),
        getTaxBoxes(supabase, user.id),
        getCategories(supabase, user.id),
      ]);
      const { rules, provisional } = taxRulesFor(year);
      return {
        rules,
        provisional,
        boxes: taxReturnBoxes(rules, rows, filed),
        filed,
        categories: categories
          .filter((category) => category.type === "expense")
          .map(({ id, name }) => ({ id, name })),
      };
    },
    [user?.id, year],
    { reads: ["transactions", "categories", "properties"] },
  );

  return (
    <Screen
      title={t("tax.title")}
      back={{
        label: t("nav.profile"),
        onPress: () =>
          router.canGoBack() ? router.back() : router.replace("/" as Href),
      }}
    >
      <ScrollView
        contentContainerClassName="gap-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row justify-center gap-1">
          {years.map((each) => (
            <Pressable
              key={each}
              accessibilityRole="button"
              accessibilityState={{ selected: each === year }}
              onPress={() => {
                void hapticSelection();
                setYear(each);
              }}
              className={cn(
                "rounded-full px-3 py-1.5",
                each === year && "bg-muted",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  each === year ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t("tax.year", { year: each })}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text variant="muted" className="text-center text-sm">
          {t("tax.intro", { year })}
        </Text>
        {data ? (
          <Text variant="micro" className="text-center">
            {data.provisional
              ? t("tax.provisional", {
                  forms: year + 1,
                  known: data.rules.formsYear,
                })
              : t("tax.forms", { forms: data.rules.formsYear })}
          </Text>
        ) : null}

        {data?.boxes.map((box, index) => (
          <Animated.View
            key={`${year}-${box.rule.id}`}
            entering={FadeInDown.delay(40 * index).springify().damping(18)}
          >
            <TaxBox
              box={box}
              year={year}
              filed={data.filed}
              categories={data.categories}
              onFiled={() => void reload()}
            />
          </Animated.View>
        ))}

        <Text variant="micro">{t("tax.footer")}</Text>
      </ScrollView>
    </Screen>
  );
}

function TaxBox({
  box,
  year,
  filed,
  categories,
  onFiled,
}: {
  box: TaxBoxFigure;
  year: number;
  filed: ReadonlyMap<string, TaxBoxId>;
  categories: { id: string; name: string }[];
  onFiled: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { rule } = box;
  const words = `tax.boxes.${rule.id}` as const;

  async function toggle(categoryId: string) {
    if (!user) {
      return;
    }
    void hapticSelection();
    const filedHere = box.categoryIds.includes(categoryId);
    const result = await setTaxBox(
      supabase,
      user.id,
      categoryId,
      filedHere ? null : rule.id,
    );
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
    }
    onFiled();
  }

  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm font-medium">{t(`${words}.label`)}</Text>
          <Text variant="micro">
            {t(`${words}.rule`, {
              ceiling: rule.ceiling === null ? "" : format(rule.ceiling),
            })}
          </Text>
          {rule.id === "7UD" && year === 2025 ? (
            <Text variant="micro">{t("tax.note7UD2025")}</Text>
          ) : null}
        </View>
        <View className="rounded-control border border-border px-2 py-0.5">
          <Text className="font-mono text-sm font-semibold">
            {rule.id}
            {rule.verify ? "*" : ""}
          </Text>
        </View>
      </View>

      <AnimatedAmount
        value={box.amount}
        startFrom={0}
        format={format}
        style={TYPE.figure}
        numberOfLines={1}
        adjustsFontSizeToFit
      />

      {rule.source === "categories" ? (
        <View className="gap-1.5">
          <Text variant="micro">
            {categories.length > 0
              ? t("tax.categoriesHint")
              : t("tax.noCategory")}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {categories
              .filter(
                (category) =>
                  !filed.has(category.id) || filed.get(category.id) === rule.id,
              )
              .map((category) => {
                const on = box.categoryIds.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => void toggle(category.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1",
                      on ? "border-foreground bg-foreground" : "border-border",
                    )}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: on ? colors.background : colors.mutedForeground,
                      }}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        </View>
      ) : (
        <Text variant="micro">{t(SOURCE_KEYS[rule.source])}</Text>
      )}

      {box.rows.length > 0 ? (
        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((current) => !current)}
            className="flex-row items-center gap-1"
          >
            <Text variant="muted" className="text-xs font-medium">
              {t("tax.rows", { count: box.rows.length })}
            </Text>
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={ICON.sm}
              color={colors.mutedForeground}
            />
          </Pressable>
          {open ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              className="rounded-control border border-border"
            >
              {box.rows.map((row, index) => (
                <View
                  key={row.id}
                  className={cn(
                    "flex-row items-center justify-between gap-3 px-3 py-2",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm">
                      {row.note || row.categoryName}
                    </Text>
                    <Text variant="micro">
                      {`${formatShortDate(row.occurredOn, locale)} · ${row.categoryName}`}
                    </Text>
                  </View>
                  <PrivateAmount className="text-sm">
                    {format(row.amount)}
                  </PrivateAmount>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </View>
      ) : (
        <Text variant="micro">{t("tax.none", { year })}</Text>
      )}
    </View>
  );
}
