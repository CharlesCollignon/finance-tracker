import { categoryTypeLabels } from "./category-styles";
import { FALLBACK_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { Category, CategoryType } from "./types/database";

export const CATEGORY_TYPE_ORDER: CategoryType[] = [
  "income",
  "expense",
  "savings",
  "investment",
];

/**
 * A purchase inside a wallet: an investment in a category that does not count
 * toward the summary (the « suivi » ones) — a DCA PEA, a DCA CTO. Its money
 * moves inside the broker, so no bank feeding the current account ever sees
 * it.
 */
export function isPurchaseInsideWallet(
  category: Pick<Category, "type" | "counts_toward_summary">,
): boolean {
  return (
    category.type === "investment" && category.counts_toward_summary === false
  );
}

export interface CategoryGroup {
  type: CategoryType;
  label: string;
  categories: Category[];
}

export function groupCategoriesByType(
  categories: Category[],
  options: { excludeTypes?: CategoryType[]; locale: Locale },
): CategoryGroup[] {
  const exclude = new Set(options?.excludeTypes ?? []);
  const labels = categoryTypeLabels(options?.locale ?? FALLBACK_LOCALE);

  return CATEGORY_TYPE_ORDER.filter((type) => !exclude.has(type))
    .map((type) => ({
      type,
      label: labels[type],
      categories: categories.filter((cat) => cat.type === type),
    }))
    .filter((group) => group.categories.length > 0);
}

export function formatCategoryOptionLabel(
  category: Category,
  locale: Locale,
): string {
  if (
    category.type === "investment" &&
    category.counts_toward_summary === false
  ) {
    // The category's own name is the user's and is never touched; only the
    // suffix the app adds to it is translated.
    return translator(locale)("fallback.trackingSuffix", {
      name: category.name,
    });
  }

  return category.name;
}

/**
 * The categories a bank line can be filed under, by which way its money
 * went. Money in is income — or a refund, or savings coming back, both
 * categories that do not count; money out is anything but income. Filing a
 * refund under « Restaurants » used to record it as more spending.
 */
export function categoriesFor<
  C extends {
    type: CategoryType;
    counts_toward_summary?: boolean | null;
  },
>(direction: "in" | "out", categories: readonly C[]): C[] {
  return categories.filter((category) =>
    direction === "in"
      ? category.type === "income" ||
        (category.type === "savings" &&
          category.counts_toward_summary === false)
      : category.type !== "income",
  );
}

/** The refund category, by either of its names, when the user has it. */
export function refundCategoryOf<C extends { name: string; type: string }>(
  categories: readonly C[],
): C | null {
  return (
    categories.find(
      (category) =>
        category.type === "income" &&
        ["remboursements", "refunds"].includes(
          category.name.trim().toLowerCase(),
        ),
    ) ?? null
  );
}
