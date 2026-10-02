import type { ActionResult } from "@finance/core/action-result";
import { findLedgerMatch } from "@finance/core/bank-feed";
import { z } from "zod";

import type { Db } from "./client";
import { ledgerRowsAround } from "./ledger-duplicates";
import { dbError } from "./errors";

/**
 * Deciding waiting bank rows, one at a time or a group at a time.
 *
 * The bodies behind the web's actions, the phone's `/api/bank/feed` route
 * and the phone's own single-row filing, so there is one duplicate check and
 * one undo rule for all of them. Each takes the client its caller
 * authenticated with — a cookie session, the phone's bearer, the phone's own
 * client — so row level security applies as that user either way, and none
 * of it revalidates: that is the web action's concern, not the phone's.
 *
 * A transaction written for a bank row is taken back when the row then
 * cannot be marked as filed: the two writes are one decision, and a
 * transaction beside a row still pending is how a purchase gets filed twice.
 */

const uuid = z.string().uuid();

/** A group's worth of rows: a shop seen every week for a year and then some. */
export const feedIds = z.array(uuid).min(1).max(500);

export type BatchFeedResult = ActionResult<{
  /** Rows that became new transactions. */
  imported?: number;
  /** Rows filed against a transaction that was already in the ledger. */
  matched?: number;
  /** Rows left out. */
  ignored?: number;
  /** Rows no longer waiting by the time the batch reached them. */
  skipped?: number;
  /** Every row this batch decided, so the whole of it can be undone. */
  decidedIds?: string[];
}>;

/**
 * Whether this row's transaction belongs to something else.
 *
 * `decided_by` records how the row was settled, and two of its three shapes
 * mean "filed against a transaction that was already there": `match:recurring`
 * when the sync paired it with a recurring charge, and `match:ledger` when
 * pressing Add found the movement already recorded. Only `auto:` and a
 * category picked by hand actually write a transaction.
 */
export function matchedExisting(decidedBy: string | null): boolean {
  return decidedBy?.startsWith("match:") ?? false;
}

/**
 * File a whole group of waiting rows under one category.
 *
 * `importFeedItem`, row by row. Each row still gets the duplicate check the
 * single version does — a charge written by a template, or the same coffee
 * typed by hand, is still there whichever path the bank's copy arrives by —
 * with one addition a batch needs: a transaction this batch has just written
 * is not a duplicate of the next row. Two identical coffees on the same day,
 * filed together, are two coffees.
 *
 * Filing is also what teaches the matcher: its memory is rebuilt from the
 * ledger on every sync, so the next Carrefour files itself because these
 * are now in the ledger under the answer given here.
 */
export async function fileFeedItems(
  db: Db,
  userId: string,
  itemIds: unknown,
  categoryId: unknown,
): Promise<BatchFeedResult> {
  const parsed = feedIds.safeParse(itemIds);
  const category = uuid.safeParse(categoryId);
  if (!parsed.success || !category.success) {
    return { error: "errors.invalidInput" };
  }

  const { data: items } = await db
    .from("bank_feed_items")
    .select("id, occurred_on, amount, note, status, direction")
    .eq("user_id", userId)
    .in("id", parsed.data);

  const waiting = (items ?? []).filter((item) => item.status === "pending");
  const written = new Set<string>();
  const decidedIds: string[] = [];
  let imported = 0;
  let matched = 0;

  for (const item of waiting) {
    const existing = (
      await ledgerRowsAround(db, userId, item.occurred_on)
    ).filter((row) => !written.has(row.transactionId));
    const already = findLedgerMatch(
      {
        providerId: "",
        occurredOn: item.occurred_on,
        amount: String(item.amount),
        currency: "EUR",
        direction: item.direction,
        counterparty: null,
        merchantCategoryCode: null,
        balanceAfter: null,
        note: item.note,
      },
      existing,
    );

    if (already) {
      const { error } = await db
        .from("bank_feed_items")
        .update({
          status: "imported",
          transaction_id: already.transactionId,
          // A match, as in `importFeedItem`: undo must not delete a
          // transaction this row did not write.
          decided_by: "match:ledger",
        })
        .eq("id", item.id)
        .eq("user_id", userId);
      if (!error) {
        matched += 1;
        decidedIds.push(item.id);
      }
      continue;
    }

    const { data: transaction, error } = await db
      .from("transactions")
      .insert({
        user_id: userId,
        category_id: category.data,
        occurred_on: item.occurred_on,
        amount: item.amount,
        note: item.note,
      })
      .select("id")
      .single();

    if (error || !transaction) {
      // The category is refused for every row alike — the insert policy
      // checks it belongs to the user — so the first refusal ends the batch.
      if (imported + matched === 0) {
        return { error: error ? dbError(error) : "actions.couldNotAddEntry" };
      }
      break;
    }

    const { error: fileError } = await db
      .from("bank_feed_items")
      .update({ status: "imported", transaction_id: transaction.id })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (fileError) {
      await db
        .from("transactions")
        .delete()
        .eq("id", transaction.id)
        .eq("user_id", userId);
      continue;
    }
    written.add(transaction.id);
    imported += 1;
    decidedIds.push(item.id);
  }

  return {
    success: true,
    imported,
    matched,
    skipped: parsed.data.length - decidedIds.length,
    decidedIds,
  };
}

/**
 * Leave a whole group out, in one write. Kept rather than deleted, so the
 * next sync does not offer the rows again.
 */
export async function leaveOutFeedItems(
  db: Db,
  userId: string,
  itemIds: unknown,
): Promise<BatchFeedResult> {
  const parsed = feedIds.safeParse(itemIds);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { data, error } = await db
    .from("bank_feed_items")
    .update({ status: "ignored" })
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("id", parsed.data)
    .select("id");

  if (error) {
    return { error: dbError(error) };
  }

  const decidedIds = (data ?? []).map((row) => row.id as string);
  return {
    success: true,
    ignored: decidedIds.length,
    skipped: parsed.data.length - decidedIds.length,
    decidedIds,
  };
}

/**
 * Take back a whole group's decision: `undoFeedDecision` for each row. What
 * the undo after "File all" calls.
 *
 * `decided_by` is cleared with the rest, so a row put back after being
 * matched does not carry `match:` into its next decision — where it would
 * stop a later undo from deleting the transaction that decision wrote.
 */
export async function reopenFeedItems(
  db: Db,
  userId: string,
  itemIds: unknown,
): Promise<ActionResult<{ reopened: number }>> {
  const parsed = feedIds.safeParse(itemIds);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { data: items } = await db
    .from("bank_feed_items")
    .select("id, transaction_id, status, decided_by")
    .eq("user_id", userId)
    .in("id", parsed.data);

  let reopened = 0;
  for (const item of items ?? []) {
    if (item.status === "pending") {
      continue;
    }
    const { error } = await db
      .from("bank_feed_items")
      .update({ status: "pending", transaction_id: null, decided_by: null })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) {
      continue;
    }
    if (item.transaction_id && !matchedExisting(item.decided_by)) {
      await db
        .from("transactions")
        .delete()
        .eq("id", item.transaction_id)
        .eq("user_id", userId);
    }
    reopened += 1;
  }

  return { success: true, reopened };
}

/**
 * File one waiting row under a category, unless the ledger already has it.
 *
 * The duplicate check is skipped only when the user has said, having been
 * told it looks like a copy, that it is not one (`force`). A row filed
 * against a transaction already there is recorded as a match — undo reads
 * that to know the transaction is not its to delete.
 */
export async function importFeedItem(
  db: Db,
  userId: string,
  itemId: string,
  categoryId: string,
  force = false,
): Promise<ActionResult<{ duplicateOf?: string }>> {
  if (!uuid.safeParse(itemId).success || !uuid.safeParse(categoryId).success) {
    return { error: "errors.invalidInput" };
  }

  const { data: item } = await db
    .from("bank_feed_items")
    .select("id, occurred_on, amount, note, status, direction")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!item) {
    return { error: "actions.entryNoLongerWaiting" };
  }
  if (item.status !== "pending") {
    return { error: "actions.entryAlreadyDealtWith" };
  }

  if (!force) {
    const existing = await ledgerRowsAround(db, userId, item.occurred_on);
    const already = findLedgerMatch(
      {
        providerId: "",
        occurredOn: item.occurred_on,
        amount: String(item.amount),
        currency: "EUR",
        direction: item.direction,
        counterparty: null,
        merchantCategoryCode: null,
        balanceAfter: null,
        note: item.note,
      },
      existing,
    );

    if (already) {
      const { error: matchError } = await db
        .from("bank_feed_items")
        .update({
          status: "imported",
          transaction_id: already.transactionId,
          decided_by: "match:ledger",
        })
        .eq("id", itemId)
        .eq("user_id", userId);
      if (matchError) {
        return { error: dbError(matchError) };
      }
      return {
        success: true,
        duplicateOf: already.transactionId,
        message: "actions.alreadyInLedger",
      };
    }
  }

  const { data: transaction, error } = await db
    .from("transactions")
    .insert({
      user_id: userId,
      category_id: categoryId,
      occurred_on: item.occurred_on,
      amount: item.amount,
      note: item.note,
    })
    .select("id")
    .single();

  if (error || !transaction) {
    return { error: error ? dbError(error) : "actions.couldNotAddEntry" };
  }

  const { error: fileError } = await db
    .from("bank_feed_items")
    .update({ status: "imported", transaction_id: transaction.id })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (fileError) {
    await db
      .from("transactions")
      .delete()
      .eq("id", transaction.id)
      .eq("user_id", userId);
    return { error: dbError(fileError) };
  }

  return { success: true, message: "recurringProposals.added" };
}

/**
 * Leave one out of the ledger for good. Kept rather than deleted, so the
 * next sync does not offer it again — the provider will keep returning it
 * for as long as it is in the statement window.
 */
export async function ignoreFeedItem(
  db: Db,
  userId: string,
  itemId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("bank_feed_items")
    .update({ status: "ignored" })
    .eq("id", itemId)
    .eq("user_id", userId)
    .eq("status", "pending");

  return error
    ? { error: dbError(error) }
    : { success: true, message: "actions.leftOut" };
}

/**
 * Put one decided row back in the inbox, and take away the transaction its
 * decision wrote — never one it was matched against.
 */
export async function undoFeedDecision(
  db: Db,
  userId: string,
  itemId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) {
    return { error: "errors.invalidInput" };
  }

  const { data: item } = await db
    .from("bank_feed_items")
    .select("transaction_id, status, decided_by")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!item) {
    return { error: "actions.entryNoLongerHere" };
  }
  if (item.status === "pending") {
    return { error: "actions.entryAlreadyWaiting" };
  }

  // The feed row first: if deleting the transaction succeeded and this then
  // failed, the row would point at a transaction that no longer exists.
  const { error } = await db
    .from("bank_feed_items")
    .update({ status: "pending", transaction_id: null, decided_by: null })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { error: dbError(error) };
  }

  if (item.transaction_id && !matchedExisting(item.decided_by)) {
    const { error: deleteError } = await db
      .from("transactions")
      .delete()
      .eq("id", item.transaction_id)
      .eq("user_id", userId);

    if (deleteError) {
      return { error: dbError(deleteError) };
    }
  }

  return { success: true, message: "actions.backInInbox" };
}
