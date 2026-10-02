import { allRows } from "@finance/core/paging";
import type { TransactionWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/**
 * Reads that span the whole of a user's history, for both apps — and so
 * reads that pass the server's 1 000-row cap within a few years of weekly
 * entries, which is why each is paged. The phone's unpaged copies of both
 * were the bug Phase 1 fixed on the web: read oldest first, it was the
 * newest rows that fell off the end.
 */

/** Every investment row ever, oldest first: the order returns are worked out in. */
export async function getInvestmentTransactions(
  db: Db,
  userId: string,
): Promise<TransactionWithCategory[]> {
  const rows = await allRows((from, to) =>
    db
      .from("transactions")
      .select("*, categories!inner(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("categories.type", "investment")
      .order("occurred_on", { ascending: true })
      .order("id")
      .range(from, to),
  );
  return rows as TransactionWithCategory[];
}

/**
 * Everything the user has ever logged as savings, net of withdrawals.
 *
 * The ledger tracks flows rather than balances, so this is a sum of savings
 * rows rather than an account balance. A savings category marked as not
 * counting is a withdrawal, so it comes off the reserve rather than being
 * skipped — skipping it was what made the reserve only ever grow, and the
 * runway it feeds only ever flatter.
 */
export async function getSavingsReserve(
  db: Db,
  userId: string,
): Promise<number> {
  const rows = await allRows((from, to) =>
    db
      .from("transactions")
      .select("amount, categories!inner(type, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("categories.type", "savings")
      .order("id")
      .range(from, to),
  );

  return rows.reduce((sum, row) => {
    const withdrawal = row.categories.counts_toward_summary === false;
    return sum + (withdrawal ? -Number(row.amount) : Number(row.amount));
  }, 0);
}
