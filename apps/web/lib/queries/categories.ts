import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import * as categories from "@finance/data/categories";
import type { Locale } from "@finance/core/i18n/locale";

/**
 * Categories — `@finance/data/categories`, shared with the phone — with
 * this request's client.
 */

/**
 * Give a user every default they are missing, and the ones they have in
 * their own language. Run at each sign-in, so a default seeded in English
 * before the app spoke French reads in the reader's language from the next
 * visit.
 */
export async function seedDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  await categories.seedDefaultCategories(await createClient(), userId, locale);
}

/** Rename the user's defaults into `locale`, when they change language. */
export async function renameDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  await categories.renameDefaultCategories(
    await createClient(),
    userId,
    locale,
  );
}

const getCategoriesCached = cache(
  async (userId: string, includeArchived: boolean) =>
    categories.getCategories(await createClient(), userId, {
      includeArchived,
    }),
);

export async function getCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
) {
  return getCategoriesCached(userId, options.includeArchived ?? false);
}
