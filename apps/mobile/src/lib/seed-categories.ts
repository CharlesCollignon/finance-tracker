import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";
import {
  buildCategoryRenames,
  buildMissingCategorySeeds,
} from "@finance/core/seed-categories";

import { fetchStoredLocale, loadLocale } from "@/lib/locale";
import { supabase } from "@/lib/supabase";

/**
 * The language to name categories in, before `LocaleProvider` has settled
 * it: the account's choice, else this device's, else French.
 */
export async function categoryLocale(userId: string): Promise<Locale> {
  try {
    return (
      (await fetchStoredLocale(userId)) ??
      (await loadLocale()) ??
      DEFAULT_LOCALE
    );
  } catch {
    return (await loadLocale()) ?? DEFAULT_LOCALE;
  }
}

/**
 * Put the defaults a user has under their language's names: an account
 * seeded in English on a French app, or under a name a default no longer has
 * ("PEA monthly DCA"). A name the user chose is never touched. Returns how
 * many were renamed.
 */
export async function renameDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<number> {
  const { data: existing, error } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const renames = buildCategoryRenames(existing ?? [], locale);
  for (const rename of renames) {
    const { error: renameError } = await supabase
      .from("categories")
      .update({ name: rename.name })
      .eq("id", rename.id)
      .eq("user_id", userId);
    if (renameError) {
      throw renameError;
    }
  }
  return renames.length;
}

/**
 * Insert missing default categories for a user, in their language, and name
 * the ones they have in it. Idempotent.
 */
export async function seedDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("categories")
    .select("name, type")
    .eq("user_id", userId);

  if (existingError) {
    throw existingError;
  }

  const missing = buildMissingCategorySeeds(userId, existing ?? [], locale);

  if (missing.length > 0) {
    const { error } = await supabase.from("categories").insert(missing);
    if (error) {
      throw error;
    }
  }

  await renameDefaultCategories(userId, locale);
}
