import type { Locale } from "@finance/core/i18n/locale";
import { buildMissingCategorySeeds } from "@finance/core/seed-categories";

import { supabase } from "@/lib/supabase";

/** Insert missing default categories for a user, in their language. Idempotent. */
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

  if (missing.length === 0) {
    return;
  }

  const { error } = await supabase.from("categories").insert(missing);

  if (error) {
    throw error;
  }
}
