import {
  MATCH_WINDOW_DAYS,
  type ExistingLedgerRow,
} from "@finance/core/bank-feed";
import { shiftIsoDate } from "@finance/core/constants";

import type { Db } from "./client";

/**
 * Ledger rows close enough in time that one could be a copy of the other.
 *
 * Bounded to the matching window rather than loading a history: the question
 * is only ever about a few days either side, and a wider net would make the
 * check slower without making it better. The judgement itself —
 * what counts as a copy — is `findLedgerMatch` in core; this is the rows it
 * is asked about, once for both apps where each used to keep a copy.
 */
export async function ledgerRowsAround(
  db: Db,
  userId: string,
  isoDate: string,
): Promise<ExistingLedgerRow[]> {
  const [{ data: rows }, { data: claimed }] = await Promise.all([
    db
      .from("transactions")
      .select(
        "id, occurred_on, amount, recurring_template_id, categories!inner(type)",
      )
      .eq("user_id", userId)
      .gte("occurred_on", shiftIsoDate(isoDate, -MATCH_WINDOW_DAYS))
      .lte("occurred_on", shiftIsoDate(isoDate, MATCH_WINDOW_DAYS)),
    db
      .from("bank_feed_items")
      .select("transaction_id")
      .eq("user_id", userId)
      .not("transaction_id", "is", null),
  ]);

  const claimedIds = new Set(
    (claimed ?? [])
      .map((row) => row.transaction_id)
      .filter((id): id is string => Boolean(id)),
  );

  return (rows ?? []).map((row) => ({
    transactionId: row.id,
    occurredOn: row.occurred_on,
    amount: Number(row.amount),
    isIncome: row.categories.type === "income",
    fromRecurringTemplate: row.recurring_template_id !== null,
    // A row the feed already answers for cannot also be the thing a second
    // bank row duplicates.
    alreadyClaimed: claimedIds.has(row.id),
  }));
}
