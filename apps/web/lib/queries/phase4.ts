import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMonthBounds } from "@finance/core/constants";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { allRows } from "@finance/core/paging";
import type { GoalLedger } from "@finance/core/savings-goals";
import type {
  Budget,
  Database,
  SavingsGoal,
  Tag,
  TransactionWithCategory,
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

/**
 * Everything a goal's running total is counted from, between two days.
 *
 * Three reads, each paged past the 1,000-row cap: the savings transactions,
 * the applied occurrences of any type (so a re-filed one is not counted as
 * still due), and the skips. Soft-deleted transactions are already hidden by
 * RLS.
 *
 * Takes the caller's client when there is one: the phone's month-read route
 * authenticates with a bearer token, and the cookie client has no session
 * there.
 */
export async function getGoalLedger(
  userId: string,
  from: string,
  to: string,
  client?: SupabaseClient<Database>,
): Promise<GoalLedger> {
  const supabase = client ?? (await createClient());
  const [transactions, applied, skipped] = await Promise.all([
    allRows<TransactionWithCategory>((start, end) =>
      supabase
        .from("transactions")
        .select("*, categories!inner(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .eq("categories.type", "savings")
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("id")
        .range(start, end)
        .then(({ data, error }) => ({
          data: data as TransactionWithCategory[] | null,
          error,
        })),
    ),
    allRows<{ recurring_template_id: string | null; occurred_on: string }>(
      (start, end) =>
        supabase
          .from("transactions")
          .select("recurring_template_id, occurred_on")
          .eq("user_id", userId)
          .not("recurring_template_id", "is", null)
          .gte("occurred_on", from)
          .lte("occurred_on", to)
          .order("id")
          .range(start, end),
    ),
    allRows<{ template_id: string; occurred_on: string }>((start, end) =>
      supabase
        .from("recurring_skips")
        .select("template_id, occurred_on")
        .eq("user_id", userId)
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("id")
        .range(start, end),
    ),
  ]);

  return {
    transactions,
    appliedKeys: new Set(
      applied.flatMap((row) =>
        row.recurring_template_id
          ? [recurringOccurrenceKey(row.recurring_template_id, row.occurred_on)]
          : [],
      ),
    ),
    skippedKeys: new Set(
      skipped.map((row) =>
        recurringOccurrenceKey(row.template_id, row.occurred_on),
      ),
    ),
  };
}
