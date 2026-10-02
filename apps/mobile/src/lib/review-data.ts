import { supabase } from "@/lib/supabase";
import { callWebApi, webApiAvailable } from "@/lib/web-api";
import {
  getDecidedFeedItems,
  type DecidedFeedRow,
} from "@finance/data/bank-inbox";
import { dbError } from "@finance/data/errors";

/**
 * What the review inbox needs beyond the pending rows themselves: what was
 * decided recently, so a decision can be taken back, and the whole-statement
 * fetch. The decided rows are the shared read; the web's twin of the rest is
 * `recategoriseFeedItem` (`apps/web/lib/actions/bank.ts`). Errors come back
 * as message keys.
 */

export type { DecidedFeedRow } from "@finance/data/bank-inbox";

/**
 * The last decisions, newest first — `@finance/data/bank-inbox`, the read the
 * web makes too. From the database rather than kept in the sheet, so a
 * decision can be taken back after the sheet, or the app, has been closed.
 */
export async function getDecidedFeedRows(
  userId: string,
  limit = 40,
): Promise<DecidedFeedRow[]> {
  // A list to correct from, not something to fail the sheet over.
  return getDecidedFeedItems(supabase, userId, limit).catch(() => []);
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
    return { error: dbError(readError) };
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

  return error ? { error: dbError(error) } : {};
}
