import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { findLedgerMatch } from "@finance/core/bank-feed";
import type { Database } from "@finance/core/types/database";
import { ledgerRowsAround } from "@/lib/bank/duplicates";

/**
 * Deciding waiting bank rows a group at a time.
 *
 * The bodies behind the web's batch actions and the phone's `/api/bank/feed`
 * route, so there is one duplicate check and one undo rule for both. Each
 * takes the client its caller authenticated with — a cookie session or the
 * phone's bearer — so row level security applies as that user either way,
 * and none of it revalidates: that is the web action's concern, not the
 * phone's.
 */

type Client = SupabaseClient<Database>;

const uuid = z.string().uuid();

/** A group's worth of rows: a shop seen every week for a year and then some. */
export const feedIds = z.array(uuid).min(1).max(500);

export interface BatchFeedResult {
  error?: string;
  success?: boolean;
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
}

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
  supabase: Client,
  userId: string,
  itemIds: unknown,
  categoryId: unknown,
): Promise<BatchFeedResult> {
  const parsed = feedIds.safeParse(itemIds);
  const category = uuid.safeParse(categoryId);
  if (!parsed.success || !category.success) {
    return { error: "errors.invalidInput" };
  }

  const { data: items } = await supabase
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
      await ledgerRowsAround(supabase, userId, item.occurred_on)
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
      const { error } = await supabase
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

    const { data: transaction, error } = await supabase
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
        return { error: error?.message ?? "actions.couldNotAddEntry" };
      }
      break;
    }

    written.add(transaction.id);
    await supabase
      .from("bank_feed_items")
      .update({ status: "imported", transaction_id: transaction.id })
      .eq("id", item.id)
      .eq("user_id", userId);
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
  supabase: Client,
  userId: string,
  itemIds: unknown,
): Promise<BatchFeedResult> {
  const parsed = feedIds.safeParse(itemIds);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { data, error } = await supabase
    .from("bank_feed_items")
    .update({ status: "ignored" })
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("id", parsed.data)
    .select("id");

  if (error) {
    return { error: error.message };
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
  supabase: Client,
  userId: string,
  itemIds: unknown,
): Promise<{ error?: string; success?: boolean; reopened?: number }> {
  const parsed = feedIds.safeParse(itemIds);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { data: items } = await supabase
    .from("bank_feed_items")
    .select("id, transaction_id, status, decided_by")
    .eq("user_id", userId)
    .in("id", parsed.data);

  let reopened = 0;
  for (const item of items ?? []) {
    if (item.status === "pending") {
      continue;
    }
    const { error } = await supabase
      .from("bank_feed_items")
      .update({ status: "pending", transaction_id: null, decided_by: null })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) {
      continue;
    }
    if (item.transaction_id && !matchedExisting(item.decided_by)) {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", item.transaction_id)
        .eq("user_id", userId);
    }
    reopened += 1;
  }

  return { success: true, reopened };
}
