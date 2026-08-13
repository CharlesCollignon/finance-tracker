import { createClient } from "@/lib/supabase/server";
import { getMonthBounds } from "@finance/core/constants";
import type {
  Budget,
  SavingsGoal,
  Tag,
  WalletTransfer,
} from "@finance/core/types/database";

export async function getBudgets(userId: string): Promise<Budget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getWalletTransfers(
  userId: string,
  year: number,
  month: number,
): Promise<WalletTransfer[]> {
  const supabase = await createClient();
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await supabase
    .from("wallet_transfers")
    .select("*")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false });

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getTags(userId: string): Promise<Tag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getTransactionTagMap(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, Tag[]>> {
  const { start, end } = getMonthBounds(year, month);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transaction_tags")
    .select("transaction_id, tags(*), transactions!inner(user_id, occurred_on)")
    .eq("transactions.user_id", userId)
    .gte("transactions.occurred_on", start)
    .lte("transactions.occurred_on", end);

  if (error) {
    throw error;
  }

  const map: Record<string, Tag[]> = {};
  for (const row of data ?? []) {
    const tag = row.tags as unknown as Tag | null;
    if (!tag || tag.user_id !== userId) {
      continue;
    }
    const list = map[row.transaction_id] ?? [];
    list.push(tag);
    map[row.transaction_id] = list;
  }
  return map;
}

export async function getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    throw error;
  }
  return data ?? [];
}
