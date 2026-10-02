import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";
import * as categories from "@finance/data/categories";

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

/** Put the defaults a user has under their language's names. */
export function renameDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<number> {
  return categories.renameDefaultCategories(supabase, userId, locale);
}

/**
 * Insert missing default categories for a user, in their language, and name
 * the ones they have in it. Idempotent.
 */
export function seedDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  return categories.seedDefaultCategories(supabase, userId, locale);
}
