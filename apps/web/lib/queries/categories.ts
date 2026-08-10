import { createClient } from "@/lib/supabase/server";
import { buildMissingCategorySeeds } from "@finance/core/seed-categories";

export async function seedDefaultCategories(userId: string) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("categories")
    .select("name, type")
    .eq("user_id", userId);

  if (existingError) {
    throw existingError;
  }

  const missing = buildMissingCategorySeeds(userId, existing ?? []);

  if (missing.length === 0) {
    return;
  }

  const { error } = await supabase.from("categories").insert(missing);

  if (error) {
    throw error;
  }
}

export async function getCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
) {
  const supabase = await createClient();

  let query = supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("type")
    .order("name");

  if (!options.includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}
