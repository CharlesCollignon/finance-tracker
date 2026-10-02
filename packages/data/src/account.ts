import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * Wipe the user's ledger and keep their account: what "Delete all data"
 * does on both apps, which used to carry a copy each.
 *
 * What was deleted and could still be taken back is put back first, then
 * rows that point at others go first — a transaction's tags before the
 * transaction, the transactions before the templates and categories they
 * belong to. A table only some deployments have yet (`savings_accounts`,
 * migration 046; `properties`, 049, whose loans go with them) is skipped
 * where it is missing rather than stopping the rest. Throws on the first
 * refusal, leaving what came before it deleted.
 */
export async function deleteAllUserData(db: Db, userId: string): Promise<void> {
  // Rows deleted but not yet swept (migration 036) are hidden from this
  // client, and a hidden transaction would keep its category from being
  // deleted below. Put each one back first, so the wipe takes them too.
  const { data: pending, error: pendingError } = await db
    .from("deletion_undo")
    .select("token")
    .eq("user_id", userId);
  if (pendingError && !isMissingSchema(pendingError)) {
    throw pendingError;
  }
  for (const { token } of pending ?? []) {
    const { error } = await db.rpc("restore_deletion", {
      target_user: userId,
      undo_token: token,
    });
    if (error) {
      throw error;
    }
  }

  const { data: txs } = await db
    .from("transactions")
    .select("id")
    .eq("user_id", userId);
  const txIds = (txs ?? []).map((tx) => tx.id);
  if (txIds.length > 0) {
    const { error } = await db
      .from("transaction_tags")
      .delete()
      .in("transaction_id", txIds);
    if (error) {
      throw error;
    }
  }

  for (const table of [
    "tags",
    "budgets",
    "wallet_transfers",
    "savings_goals",
    "recurring_skips",
    "transactions",
    "investment_positions",
  ] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) {
      throw error;
    }
  }

  for (const table of ["savings_accounts", "properties"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error && !isMissingSchema(error)) {
      throw error;
    }
  }

  for (const table of ["recurring_templates", "categories"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) {
      throw error;
    }
  }
}
