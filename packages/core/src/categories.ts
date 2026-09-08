import { categoryTypeLabels } from "./category-styles";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { Category, CategoryType } from "./types/database";

export const CATEGORY_TYPE_ORDER: CategoryType[] = [
  "income",
  "expense",
  "savings",
  "investment",
];

export interface CategoryGroup {
  type: CategoryType;
  label: string;
  categories: Category[];
}

export function groupCategoriesByType(
  categories: Category[],
  options?: { excludeTypes?: CategoryType[]; locale?: Locale },
): CategoryGroup[] {
  const exclude = new Set(options?.excludeTypes ?? []);
  const labels = categoryTypeLabels(options?.locale ?? DEFAULT_LOCALE);

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
  locale: Locale = DEFAULT_LOCALE,
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
