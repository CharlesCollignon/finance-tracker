import type { Db } from "./client";

/**
 * Whether this user's ledger is fed by a bank.
 *
 * A fact about the data rather than about configuration: having synced once
 * is what matters, and it stays true after a disconnect that kept the rows.
 * With a bank feeding the ledger, recurring templates only forecast — the
 * bank is the record — so the fill and the template save both ask this
 * before writing.
 */
export async function hasBankFeed(db: Db, userId: string): Promise<boolean> {
  const { count } = await db
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}
