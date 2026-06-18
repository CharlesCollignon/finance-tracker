import { CATEGORY_TYPE_LABELS } from "@/lib/category-styles";
import type { Category, CategoryType } from "@/lib/types/database";

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
  options?: { excludeTypes?: CategoryType[] },
): CategoryGroup[] {
  const exclude = new Set(options?.excludeTypes ?? []);

  return CATEGORY_TYPE_ORDER.filter((type) => !exclude.has(type))
    .map((type) => ({
      type,
      label: CATEGORY_TYPE_LABELS[type],
      categories: categories.filter((cat) => cat.type === type),
    }))
    .filter((group) => group.categories.length > 0);
}

export function formatCategoryOptionLabel(category: Category): string {
  if (
    category.type === "investment" &&
    category.counts_toward_summary === false
  ) {
    return `${category.name} · tracking`;
  }

  return category.name;
}
