import type { BankFeedItem, CategoryType } from "@finance/core/types/database";

import { supabase } from "@/lib/supabase";
import { callWebApi, webApiAvailable } from "@/lib/web-api";

/**
 * What the review inbox needs beyond the pending rows themselves: what was
 * decided recently, so a decision can be taken back, and the whole-statement
 * fetch. The web's twins are `getDecidedFeedItems`, `countFeedItems` and
 * `recategoriseFeedItem` (`apps/web/lib/queries/bank.ts`,
 * `apps/web/lib/actions/bank.ts`); errors come back as message keys.
 */

export interface DecidedFeedRow {
  id: string;
  occurredOn: string;
  amount: number;
  direction: "in" | "out";
  counterparty: string | null;
  note: string;
  /** Where it landed, or null when it was left out. */
  categoryId: string | null;
  categoryName: string | null;
  categoryType: CategoryType | null;
  /** The ledger row it became, if it became one. */
  transactionId: string | null;
  status: "imported" | "ignored";
}

/**
 * The last decisions, newest first.
 *
 * Read from the database rather than kept in the sheet, so a decision can be
 * taken back after the sheet has been closed and opened again — or after the
 * app has been. Bounded, as on the web: a means of correcting what you just
 * did, not an archive; the ledger is the archive.
 */
export async function getDecidedFeedRows(
  userId: string,
  limit = 40,
): Promise<DecidedFeedRow[]> {
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*, transactions(category_id, categories(name, type))")
    .eq("user_id", userId)
    .in("status", ["imported", "ignored"])
    .order("occurred_on", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  type Joined = BankFeedItem & {
    transactions: {
      category_id: string;
      categories: { name: string; type: CategoryType } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    amount: Number(row.amount),
    direction: row.direction,
    counterparty: row.counterparty,
    note: row.note,
    categoryId: row.transactions?.category_id ?? null,
    categoryName: row.transactions?.categories?.name ?? null,
    categoryType: row.transactions?.categories?.type ?? null,
    transactionId: row.transaction_id,
    status: row.status === "ignored" ? "ignored" : "imported",
  }));
}

/**
 * Whether the whole statement is still worth fetching. The web offers
 * "Fetch everything" while the feed holds fewer than 400 rows — a first sync
 * reads a recent window, and a year of statement is more than that.
 */
export async function wholeStatementWorthFetching(
  userId: string,
): Promise<boolean> {
  if (!webApiAvailable()) {
    return false;
  }
  const { count, error } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return !error && (count ?? 0) < 400;
}

/**
 * Ask the bank for the whole statement rather than the recent window, on
 * the web server — the key never leaves it. The answer is the server's own
 * summary ("12 added, 4 to review"), already in the reader's words or a key.
 */
export async function fetchWholeStatement(): Promise<
  { message: string } | { error: string }
> {
  const result = await callWebApi<{ message?: string }>("/api/bank/refresh", {
    body: { backfill: true },
  });
  return result.ok
    ? { message: result.message ?? "actions.nothingNew" }
    : { error: result.error };
}

/**
 * Move the ledger entries a group of filed rows became to another category,
 * keeping the bank rows filed. Row level security keeps it to the reader's
 * own rows.
 */
export async function recategoriseDecidedRows(
  itemIds: string[],
  categoryId: string,
): Promise<{ error?: string }> {
  if (itemIds.length === 0) {
    return { error: "errors.nothingSelected" };
  }
  const { data, error: readError } = await supabase
    .from("bank_feed_items")
    .select("transaction_id")
    .in("id", itemIds);
  if (readError) {
    return { error: readError.message };
  }

  const transactionIds = ((data ?? []) as { transaction_id: string | null }[])
    .map((row) => row.transaction_id)
    .filter((id): id is string => id !== null);
  if (transactionIds.length === 0) {
    return { error: "actions.entryNotInLedger" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .in("id", transactionIds);

  return error ? { error: error.message } : {};
}
