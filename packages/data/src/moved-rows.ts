import type { TransactionWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/**
 * Rows whose money moved in a range but that count for another day — an
 * income paid early for next month (`cash_on`, migration 045).
 *
 * Only what pairs the ledger with a balance reads these: the month close and
 * the balance curve. Everything else goes by `occurred_on` and never needs
 * them. Empty, rather than an error, before 045 has run.
 */
export async function getMovedBetween(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<TransactionWithCategory[]> {
  if (from > to) {
    return [];
  }
  const { data, error } = await db
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
