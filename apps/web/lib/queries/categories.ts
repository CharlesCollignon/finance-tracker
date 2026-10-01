import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  buildCategoryRenames,
  buildMissingCategorySeeds,
} from "@finance/core/seed-categories";
import type { Locale } from "@finance/core/i18n/locale";

/**
 * Give a user every default they are missing, and the ones they have in
 * their own language. Run at each sign-in, so a default seeded in English
 * before the app spoke French — or under a name it no longer has — reads in
 * the reader's language from the next visit.
 */
export async function seedDefaultCategories(userId: string, locale: Locale) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("categories")
    .select("id, name, type")
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

  await applyCategoryRenames(userId, existing ?? [], locale);
}

/**
 * Rename the user's defaults into `locale` — at sign-in, and when they
 * change language. A category they named themselves is never touched.
 */
export async function renameDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  await applyCategoryRenames(userId, existing ?? [], locale);
}

async function applyCategoryRenames(
  userId: string,
  existing: { id: string; name: string; type: string }[],
  locale: Locale,
): Promise<void> {
  const renames = buildCategoryRenames(existing, locale);
  if (renames.length === 0) {
    return;
  }

  const supabase = await createClient();
  const results = await Promise.all(
    renames.map((rename) =>
      supabase
        .from("categories")
        .update({ name: rename.name })
        .eq("id", rename.id)
        .eq("user_id", userId),
    ),
  );

  // One rename failing (a name taken in between) leaves the rest done and
  // the category under its old name, which is where it already was.
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("Category rename failed", failed.error.code);
  }
}

const getCategoriesCached = cache(
  async (userId: string, includeArchived: boolean) => {
    const supabase = await createClient();

    let query = supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("type")
      .order("name");

    if (!includeArchived) {
      query = query.eq("archived", false);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data ?? [];
  },
);

export async function getCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
) {
  return getCategoriesCached(userId, options.includeArchived ?? false);
}
