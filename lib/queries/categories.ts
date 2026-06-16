import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

export async function seedDefaultCategories(userId: string) {
  const supabase = await createClient();

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

export async function getCategories(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("type")
    .order("name");

  if (error) {
    throw error;
  }

  return data ?? [];
}
