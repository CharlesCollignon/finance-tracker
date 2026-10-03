import { Fragment, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { findingIsGoodNews } from "@finance/core/category-findings";
import type { CategoryCard } from "@finance/core/category-screen";
import type { Key } from "@finance/core/i18n/t";
import type { CategoryType } from "@finance/core/types/database";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Which colour a category type is drawn in: the colours its amounts carry
 * everywhere else — income green, spending red, savings gold, investments
 * blue — as the web's `TONE` reads them off the allocation colours.
 */
export function useCategoryTone(): Record<CategoryType, string> {
  const colors = useThemeColors();
  return {
    income: colors.success,
    expense: colors.destructive,
    savings: colors.primary,
    investment: colors.info,
  };
}

/** The four groups, in the order money moves through them. */
const GROUPS: { type: CategoryType; labelKey: Key }[] = [
  { type: "expense", labelKey: "categoryScreen.groupExpense" },
  { type: "income", labelKey: "categoryScreen.groupIncome" },
  { type: "savings", labelKey: "categoryScreen.groupSavings" },
  { type: "investment", labelKey: "categoryScreen.groupInvestment" },
];

/**
 * Every category at once, two to a row, and the panel that opens inside
 * the grid — on its own row, right under the pair it was opened from, as
 * the web's opens under its tile's row.
 */
export function CategoryGrid({
  cards,
  openId,
  onOpen,
  panel,
}: {
  cards: CategoryCard[];
  openId: string | null;
  onOpen: (categoryId: string) => void;
  /** Drawn full width under the open tile's row. */
  panel: ReactNode;
}) {
  const t = useT();

  return (
    <View className="gap-6">
      {GROUPS.map(({ type, labelKey }) => {
        const group = cards.filter((card) => card.history.type === type);
        if (group.length === 0) {
          return null;
        }
        const rows: CategoryCard[][] = [];
        for (let index = 0; index < group.length; index += 2) {
          rows.push(group.slice(index, index + 2));
        }
        return (
          <View key={type} className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(labelKey)}
            </Text>
            {rows.map((row) => (
              <Fragment key={row[0]!.history.categoryId}>
                <View className="flex-row gap-2">
                  {row.map((card) => (
                    <CategoryTile
                      key={card.history.categoryId}
                      card={card}
                      open={card.history.categoryId === openId}
                      onOpen={onOpen}
                    />
                  ))}
                  {/* An odd last tile keeps its half, so it does not
                      stretch into a different shape from the rest. */}
                  {row.length === 1 ? <View className="flex-1" /> : null}
                </View>
                {row.some((card) => card.history.categoryId === openId)
                  ? panel
                  : null}
              </Fragment>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/**
 * One category's run, small enough that twenty fit on a screen. Scaled
 * against its own months rather than every category's, so what shows is the
 * shape of this run, not that the rent is bigger than the coffee.
 */
function CategoryTile({
  card,
  open,
  onOpen,
}: {
  card: CategoryCard;
  open: boolean;
  onOpen: (categoryId: string) => void;
}) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const tone = useCategoryTone();
  const { history, normal, drawn, findings } = card;
  const peak = drawn.reduce((max, point) => Math.max(max, point.total), 0) || 1;
  const heaviest = findings[0] ?? null;
  // What the sign means comes from the category type, not from the sign.
  const heaviestIsGood = heaviest ? findingIsGoodNews(heaviest) : false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={t("categoryScreen.open", { name: history.name })}
      onPress={() => {
        void hapticLight();
        onOpen(history.categoryId);
      }}
      className={cn(
        "min-w-0 flex-1 gap-1 rounded-card border p-row",
        open ? "bg-muted/40" : "",
      )}
      style={{ borderColor: open ? colors.hairlineStrong : colors.border }}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium">
          {history.name}
        </Text>
        {heaviest ? (
          <View
            className={cn(
              "rounded-full px-2 py-0.5",
              heaviestIsGood ? "bg-success/15" : "bg-destructive/15",
            )}
          >
            <PrivateAmount
              className={cn(
                "font-semibold",
                heaviestIsGood ? "text-success" : "text-destructive",
              )}
              style={{ fontSize: 10 }}
            >
              {formatMoney(heaviest.severity)}
            </PrivateAmount>
          </View>
        ) : null}
      </View>
      <PrivateAmount className="text-xs text-muted-foreground">
        {formatMoney(normal)}
      </PrivateAmount>
      <View className="mt-1 h-10 flex-row items-end gap-0.5">
        {drawn.map((point) => (
          <View
            key={point.monthKey}
            className="flex-1"
            style={{
              height: point.empty
                ? 1
                : `${Math.max((point.total / peak) * 100, 2)}%`,
              backgroundColor: point.empty ? colors.border : tone[history.type],
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}
