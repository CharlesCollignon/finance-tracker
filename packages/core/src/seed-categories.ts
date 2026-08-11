import { DEFAULT_CATEGORIES } from "./constants";
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

/** Build the default category rows a user is still missing. */
export function buildMissingCategorySeeds(
  userId: string,
  existing: ExistingCategoryKey[],
): CategorySeedRow[] {
  const existingKeys = new Set(
    existing.map((cat) => `${cat.type}:${cat.name}`),
  );

  return DEFAULT_CATEGORIES.filter(
    (cat) => !existingKeys.has(`${cat.type}:${cat.name}`),
  ).map((cat) => ({
    user_id: userId,
    name: cat.name,
    type: cat.type,
    icon: cat.icon,
    counts_toward_summary:
      "countsTowardSummary" in cat ? (cat.countsTowardSummary ?? true) : true,
  }));
}
