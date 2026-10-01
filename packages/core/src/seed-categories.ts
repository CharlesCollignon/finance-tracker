import { DEFAULT_CATEGORIES, defaultCategoryNames } from "./constants";
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
      !defaultCategoryNames(cat).some((name) =>
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

export interface ExistingCategory extends ExistingCategoryKey {
  id: string;
}

export interface CategoryRename {
  id: string;
  name: string;
}

/**
 * The defaults to rename into the reader's language.
 *
 * A default stored under its other language's name ("Groceries" on a French
 * app) or under a name it no longer has ("PEA monthly DCA") takes the name
 * it has in `locale`. A category the user named themselves is never touched,
 * nor one whose new name another category already has; and of two that
 * would take the same name, only the first does.
 */
export function buildCategoryRenames(
  existing: readonly ExistingCategory[],
  locale: Locale,
): CategoryRename[] {
  const taken = new Set(
    existing.map((cat) => `${cat.type}:${cat.name.trim().toLowerCase()}`),
  );
  const renames: CategoryRename[] = [];

  for (const cat of existing) {
    const lower = cat.name.trim().toLowerCase();
    const match = DEFAULT_CATEGORIES.find(
      (candidate) =>
        candidate.type === cat.type &&
        defaultCategoryNames(candidate).some(
          (name) => name.toLowerCase() === lower,
        ),
    );
    if (!match) {
      continue;
    }
    const target = match.names[locale];
    const key = `${cat.type}:${target.toLowerCase()}`;
    if (target.toLowerCase() === lower || taken.has(key)) {
      continue;
    }
    taken.add(key);
    renames.push({ id: cat.id, name: target });
  }

  return renames;
}
