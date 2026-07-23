import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";

type Client = SupabaseClient<Database>;

export async function deleteAllUserData(
  userId: string,
  supabase: Client,
): Promise<void> {
  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId);

  if (txError) {
    throw txError;
  }

  const { error: recurringError } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("user_id", userId);

  if (recurringError) {
    throw recurringError;
  }

  const { error: categoriesError } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", userId);

  if (categoriesError) {
    throw categoriesError;
  }
}
