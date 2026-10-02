import type { ActionResult } from "@finance/core/action-result";
import { parseUuid } from "@finance/core/validations/finance";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchemaOrFunction } from "./schema";

/**
 * Taking a delete back — migration 036, for both apps.
 *
 * A transaction or a category deleted is marked rather than removed, and the
 * delete hands back a token the toast's Undo can spend. The marking, the
 * links a delete breaks and their restoring are the database's
 * (`soft_delete_transactions`, `soft_delete_category`, `restore_deletion`);
 * a sweep removes for good what is still marked after a month.
 *
 * A database that has not run 036 deletes for good, as before, and hands
 * back no token, so the toast offers nothing it could not do.
 */

/** What Undo spends: null when this delete cannot be taken back. */
export type UndoToken = string | null;

/**
 * Mark transactions deleted. `unsupported` before migration 036, for the
 * caller to delete for good instead.
 */
export async function markTransactionsDeleted(
  db: Db,
  userId: string,
  ids: readonly string[],
): Promise<{ undo: UndoToken } | { error: string } | "unsupported"> {
  const { data, error } = await db.rpc("soft_delete_transactions", {
    target_user: userId,
    ids: [...ids],
  });
  if (error) {
    return isMissingSchemaOrFunction(error)
      ? "unsupported"
      : { error: dbError(error) };
  }
  return { undo: data ?? null };
}

/**
 * Mark a category deleted, refused like a hard delete was while anything
 * still uses it. `unsupported` before migration 036.
 */
export async function markCategoryDeleted(
  db: Db,
  userId: string,
  id: string,
): Promise<{ undo: UndoToken } | { error: string } | "unsupported"> {
  const { data, error } = await db.rpc("soft_delete_category", {
    target_user: userId,
    target_category: id,
  });
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return "unsupported";
    }
    return {
      error: error.code === "23503" ? "actions.categoryInUse" : dbError(error),
    };
  }
  return { undo: data ?? null };
}

/**
 * Put back what one delete took: the rows, the fulfilments it cleared, the
 * bank rows it unpointed — and the skips the delete wrote so the month would
 * not refill a charge, which would otherwise leave the restored charge's
 * occurrence marked as skipped.
 */
export async function restoreDeletion(
  db: Db,
  userId: string,
  token: string,
): Promise<ActionResult<{ restored: number }>> {
  if (!parseUuid(token)) {
    return { error: "errors.invalidInput" };
  }

  // Read before the restore, which removes the record.
  const { data: record } = await db
    .from("deletion_undo")
    .select("transaction_ids")
    .eq("token", token)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: restored, error } = await db.rpc("restore_deletion", {
    target_user: userId,
    undo_token: token,
  });
  if (error) {
    return { error: dbError(error) };
  }
  if (!record) {
    // Swept, or already taken back from another device.
    return { error: "errors.undoGone" };
  }

  const ids = record.transaction_ids ?? [];
  if (ids.length > 0) {
    const { data: charges } = await db
      .from("transactions")
      .select("recurring_template_id, occurred_on")
      .eq("user_id", userId)
      .in("id", ids)
      .not("recurring_template_id", "is", null);
    for (const charge of charges ?? []) {
      await db
        .from("recurring_skips")
        .delete()
        .eq("user_id", userId)
        .eq("template_id", charge.recurring_template_id!)
        .eq("occurred_on", charge.occurred_on);
    }
  }

  return { success: true, restored: restored ?? 0 };
}
