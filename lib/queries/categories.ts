import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

export async function seedDefaultCategories(userId: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) {
    return;
  }

  await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map((cat) => ({
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
