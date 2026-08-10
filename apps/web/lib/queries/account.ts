import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";

type Client = SupabaseClient<Database>;

export async function deleteAllUserData(
  userId: string,
  supabase: Client,
): Promise<void> {
  const { data: txs } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId);
  const txIds = (txs ?? []).map((t) => t.id);
  if (txIds.length > 0) {
    const { error } = await supabase
      .from("transaction_tags")
      .delete()
      .in("transaction_id", txIds);
    if (error) {
      throw error;
    }
  }

  const { error: tagsError } = await supabase
    .from("tags")
    .delete()
    .eq("user_id", userId);
  if (tagsError) {
    throw tagsError;
  }

  const { error: budgetsError } = await supabase
    .from("budgets")
    .delete()
    .eq("user_id", userId);
  if (budgetsError) {
    throw budgetsError;
  }

  const { error: transfersError } = await supabase
    .from("wallet_transfers")
    .delete()
    .eq("user_id", userId);
  if (transfersError) {
    throw transfersError;
  }

  const { error: goalsError } = await supabase
    .from("savings_goals")
    .delete()
    .eq("user_id", userId);
  if (goalsError) {
    throw goalsError;
  }

  const { error: skipsError } = await supabase
    .from("recurring_skips")
    .delete()
    .eq("user_id", userId);
  if (skipsError) {
    throw skipsError;
  }

  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId);

  if (txError) {
    throw txError;
  }

  const { error: positionsError } = await supabase
    .from("investment_positions")
    .delete()
    .eq("user_id", userId);

  if (positionsError) {
    throw positionsError;
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
