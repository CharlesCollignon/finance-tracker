import { DEFAULT_CATEGORIES } from "./constants";
import type { Locale } from "./i18n/locale";
import type { CategoryType } from "./types/database";

export interface ExistingCategoryKey {
  name: string;
  type: CategoryType | string;
}

export interface CategorySeedRow {
  user_id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  counts_toward_summary: boolean;
}

/**
 * Build the default category rows a user is still missing, named in their
 * language.
 *
 * A default counts as present under either of its names, so an account seeded
 * in English before the defaults were French — or seeded in the other
 * language — is never handed a second "Courses" beside its "Groceries".
 */
export function buildMissingCategorySeeds(
  userId: string,
  existing: ExistingCategoryKey[],
  locale: Locale,
): CategorySeedRow[] {
  const existingKeys = new Set(
    existing.map((cat) => `${cat.type}:${cat.name.trim().toLowerCase()}`),
  );

  return DEFAULT_CATEGORIES.filter(
    (cat) =>
      !Object.values(cat.names).some((name) =>
        existingKeys.has(`${cat.type}:${name.toLowerCase()}`),
      ),
  ).map((cat) => ({
    user_id: userId,
    name: cat.names[locale],
    type: cat.type,
    icon: cat.icon,
    counts_toward_summary:
      "countsTowardSummary" in cat ? (cat.countsTowardSummary ?? true) : true,
  }));
}
