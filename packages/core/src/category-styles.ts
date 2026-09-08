import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { CategoryType } from "./types/database";

/**
 * What each of the four category types is called.
 *
 * A function of the locale rather than the constant record it used to be. The
 * database stores the lowercase enum values (`income`, `expense`, `savings`,
 * `investment`), so only the display strings move with the language and no
 * migration is involved.
 */
export function categoryTypeLabels(
  locale: Locale = DEFAULT_LOCALE,
): Record<CategoryType, string> {
  const t = translator(locale);
  return {
    income: t("categoryType.income"),
    expense: t("categoryType.expense"),
    savings: t("categoryType.savings"),
    investment: t("categoryType.investment"),
  };
}

export const CATEGORY_TYPE_BADGE_CLASS: Record<CategoryType, string> = {
  income: "bg-success/15 text-success",
  expense: "bg-destructive/15 text-destructive",
  savings: "bg-primary/15 text-primary",
  investment: "bg-info/15 text-info",
};

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Semantic allocation colors for Sankey / pies. */
export const ALLOCATION_COLORS = {
  income: "var(--success)",
  expenses: "var(--destructive)",
  savings: "var(--primary)",
  investments: "var(--info)",
  remaining: "var(--chart-5)",
} as const;

export const TYPE_AMOUNT_CLASS: Record<CategoryType, string> = {
  income: "text-success",
  expense: "text-destructive",
  savings: "text-primary",
  investment: "text-info",
};
