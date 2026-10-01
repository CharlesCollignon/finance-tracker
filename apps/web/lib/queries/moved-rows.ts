import type { SupabaseClient } from "@supabase/supabase-js";

import { movedBetween } from "@finance/core/cash-date";
import type {
  Database,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * Rows whose money moved in a range but that count for another day — an
 * income paid early for next month (`cash_on`, migration 045).
 *
 * Only what pairs the ledger with a balance reads these: the month close and
 * the balance curve. Everything else goes by `occurred_on` and never needs
 * them. Empty, rather than an error, before 045 has run.
 */
export async function getMovedBetween(
  userId: string,
  from: string,
  to: string,
  client?: SupabaseClient<Database>,
): Promise<TransactionWithCategory[]> {
  if (from > to) {
    return [];
  }
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .gte("cash_on", from)
    .lte("cash_on", to);

  if (error) {
    if (error.code === "42703") {
      return [];
    }
    throw error;
  }
  return (data ?? []) as TransactionWithCategory[];
}

/**
 * The rows whose money moved between `from` and `to`, out of rows fetched by
 * the day they count for plus the moved ones: each once, kept by the day its
 * money moved.
 */
export function rowsByCashDate(
  fetched: readonly TransactionWithCategory[],
  moved: readonly TransactionWithCategory[],
  from: string,
  to: string,
): TransactionWithCategory[] {
  const byId = new Map(fetched.map((row) => [row.id, row] as const));
  for (const row of moved) {
    byId.set(row.id, row);
  }
  return [...byId.values()].filter((row) => movedBetween(row, from, to));
}
