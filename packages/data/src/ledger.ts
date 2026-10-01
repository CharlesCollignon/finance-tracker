import { firstIssue, type ActionResult } from "@finance/core/action-result";
import {
  deleteTransactionsSchema,
  importTransactionsSchema,
  moveTransactionsSchema,
  parseUuid,
  transactionSchema,
  updateTransactionSchema,
} from "@finance/core/validations/finance";
import type { z } from "zod";

import type { Db } from "./client";
import { skipOccurrences, skipWhatTemplatesWrote } from "./recurring-apply";

/**
 * Writing transactions, for both apps.
 *
 * Each function validates its own input with the schema core already has,
 * so neither app can skip a check the other makes — which is how the phone's
 * import came to accept a category the user did not own, and its delete an
 * id that was not one. Every write filters on `user_id` as well as relying
 * on row level security.
 *
 * Revalidating is the caller's: the web redraws its pages, the phone's
 * client has already announced the write.
 */

/** A transaction to record, as either app's form hands it over. */
export type NewTransaction = z.input<typeof transactionSchema>;
/** The same, for one already recorded. */
export type TransactionChange = z.input<typeof updateTransactionSchema>;
/** One row of a reviewed import. */
export type ImportedRow = z.input<
  typeof importTransactionsSchema
>["rows"][number];

export async function createTransaction(
  db: Db,
  userId: string,
  input: NewTransaction,
): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse({
    ...input,
    note: input.note?.trim() || undefined,
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { error } = await db.from("transactions").insert({
    user_id: userId,
    category_id: parsed.data.categoryId,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note ?? null,
  });

  return error ? { error: error.message } : { success: true };
}

export async function updateTransaction(
  db: Db,
  userId: string,
  input: TransactionChange,
): Promise<ActionResult> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  // A row a template wrote, moved to another day, leaves the day it came
  // from unwritten — and the month fills itself, so that day would be written
  // again. Skipping it is what makes the move stick.
  const { data: before } = await db
    .from("transactions")
    .select("recurring_template_id, occurred_on")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    before?.recurring_template_id &&
    before.occurred_on !== parsed.data.occurredOn
  ) {
    const skipError = await skipOccurrences(db, userId, [
      {
        templateId: before.recurring_template_id,
        occurredOn: before.occurred_on,
      },
    ]);
    if (skipError) {
      return { error: skipError };
    }
  }

  const { error } = await db
    .from("transactions")
    .update({
      category_id: parsed.data.categoryId,
      amount: parsed.data.amount,
      occurred_on: parsed.data.occurredOn,
      note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", userId);

  return error ? { error: error.message } : { success: true };
}

/**
 * Delete one transaction. A charge's row first records a skip, so the month
 * filling itself does not write that occurrence straight back.
 */
export async function deleteTransaction(
  db: Db,
  userId: string,
  id: string,
): Promise<ActionResult> {
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const skipError = await skipWhatTemplatesWrote(db, userId, [id]);
  if (skipError) {
    return { error: skipError };
  }

  const { error } = await db
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return error ? { error: error.message } : { success: true };
}

/** Delete several at once, with the same skips as one at a time. */
export async function deleteTransactions(
  db: Db,
  userId: string,
  ids: readonly string[],
): Promise<ActionResult<{ deleted: number }>> {
  const parsed = deleteTransactionsSchema.safeParse({ ids });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const skipError = await skipWhatTemplatesWrote(db, userId, parsed.data.ids);
  if (skipError) {
    return { error: skipError };
  }

  const { error, count } = await db
    .from("transactions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .in("id", parsed.data.ids);

  return error
    ? { error: error.message }
    : { success: true, deleted: count ?? parsed.data.ids.length };
}

/**
 * Put several transactions in another category.
 *
 * The target category is a caller-supplied foreign key, and the row-level
 * policy on `transactions` polices which rows may be written, not what they
 * may point at — so it is confirmed to belong to this user first, rather
 * than trusting an id that arrived from a browser or a phone.
 *
 * Nothing here touches `bank_feed_items`: a feed row carries no category of
 * its own, only a `transaction_id`, so moving the transaction is the whole
 * change. And there is no merchant memory to rewrite — it is derived from
 * the transactions on every bank sync, which is what makes this correction
 * stick.
 */
export async function moveTransactions(
  db: Db,
  userId: string,
  ids: readonly string[],
  categoryId: string,
): Promise<ActionResult<{ moved: number }>> {
  const parsed = moveTransactionsSchema.safeParse({ ids, categoryId });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { data: category, error: categoryError } = await db
    .from("categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (categoryError) {
    return { error: categoryError.message };
  }
  if (!category) {
    return { error: "actions.categoryMissing" };
  }

  const { error, count } = await db
    .from("transactions")
    .update({ category_id: parsed.data.categoryId }, { count: "exact" })
    .eq("user_id", userId)
    .in("id", parsed.data.ids);

  return error
    ? { error: error.message }
    : { success: true, moved: count ?? parsed.data.ids.length };
}

/**
 * Commit a reviewed CSV import.
 *
 * The rows arriving here have already been parsed, de-duplicated and
 * categorised in the review step — this only re-validates and writes, so a
 * tampered payload cannot bypass the schema. Every row must belong to one of
 * the user's own categories; row level security covers the insert, but
 * checking here turns a database error into a clear message.
 */
export async function importTransactions(
  db: Db,
  userId: string,
  rows: readonly ImportedRow[],
): Promise<ActionResult<{ imported: number }>> {
  const parsed = importTransactionsSchema.safeParse({ rows });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const categoryIds = [
    ...new Set(parsed.data.rows.map((row) => row.categoryId)),
  ];
  const { data: owned, error: categoryError } = await db
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .in("id", categoryIds);

  if (categoryError) {
    return { error: categoryError.message };
  }
  if ((owned?.length ?? 0) !== categoryIds.length) {
    return { error: "actions.oneCategoryMissing" };
  }

  const { error } = await db.from("transactions").insert(
    parsed.data.rows.map((row) => ({
      user_id: userId,
      category_id: row.categoryId,
      amount: row.amount,
      occurred_on: row.occurredOn,
      note: row.note?.trim() || null,
    })),
  );

  return error
    ? { error: error.message }
    : { success: true, imported: parsed.data.rows.length };
}
