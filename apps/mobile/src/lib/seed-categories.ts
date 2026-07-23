import { DEFAULT_CATEGORIES } from "@finance/core/constants";

import { supabase } from "@/lib/supabase";

/**
 * Insert the default category set for a user if missing. Ported from the web
 * app's seedDefaultCategories (lib/queries/categories.ts). Idempotent: only
 * inserts categories the user does not already have.
 */
export async function seedDefaultCategories(userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("categories")
    .select("name, type")
    .eq("user_id", userId);

  const existingKeys = new Set(
    (existing ?? []).map((cat) => `${cat.type}:${cat.name}`),
  );

  const missing = DEFAULT_CATEGORIES.filter(
    (cat) => !existingKeys.has(`${cat.type}:${cat.name}`),
  );

  if (missing.length === 0) {
    return;
  }

  await supabase.from("categories").insert(
    missing.map((cat) => ({
      user_id: userId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      counts_toward_summary:
        "countsTowardSummary" in cat ? cat.countsTowardSummary : true,
    })),
  );
}
