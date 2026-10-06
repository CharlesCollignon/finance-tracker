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

/**
 * The categories of the wallets bought straight from the account: purchases
 * inside a wallet (`isPurchaseInsideWallet`) that the bank has brought debits
 * into. Bitstack takes its buys from the account by card, where a DCA PEA is
 * bought with money already sent to the broker, which the bank never sees.
 *
 * Read from what the bank did rather than asked: a category the bank has
 * once debited is one whose purchases leave the account, and nothing needs
 * setting for it. Empty without a bank.
 */
export async function walletCategoriesTheBankDebits(
  db: Db,
  userId: string,
): Promise<Set<string>> {
  const { data: categories, error } = await db
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "investment")
    .eq("counts_toward_summary", false);

  if (error) {
    throw error;
  }

  // One small look per category: there are a handful, and asking whether
  // one has any debit at all cannot be capped across them in one read.
  const debited = await Promise.all(
    (categories ?? []).map(async ({ id }) => {
      const { data, error: feedError } = await db
        .from("bank_feed_items")
        .select("id, transactions!inner(category_id)")
        .eq("user_id", userId)
        .eq("direction", "out")
        .eq("transactions.category_id", id)
        .limit(1);
      if (feedError) {
        throw feedError;
      }
      return (data ?? []).length > 0 ? id : null;
    }),
  );

  return new Set(debited.filter((id): id is string => id !== null));
}
