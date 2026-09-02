import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MATCH_WINDOW_DAYS,
  type ExistingLedgerRow,
} from "@finance/core/bank-feed";
import type { Database } from "@finance/core/types/database";

type Client = SupabaseClient<Database>;

/** ISO date `days` either side of `isoDate`. */
function shift(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Ledger rows close enough in time that one could be a copy of the other.
 *
 * Bounded to the matching window rather than loading a history: the question
 * is only ever about a few days either side, and a wider net would make the
 * check slower without making it better.
 */
export async function ledgerRowsAround(
  supabase: Client,
  userId: string,
  isoDate: string,
): Promise<ExistingLedgerRow[]> {
  const [{ data: rows }, { data: claimed }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, occurred_on, amount, recurring_template_id, categories!inner(type)",
      )
      .eq("user_id", userId)
      .gte("occurred_on", shift(isoDate, -MATCH_WINDOW_DAYS))
      .lte("occurred_on", shift(isoDate, MATCH_WINDOW_DAYS)),
    supabase
      .from("bank_feed_items")
      .select("transaction_id")
      .eq("user_id", userId)
      .not("transaction_id", "is", null),
  ]);

  const claimedIds = new Set(
    (claimed ?? [])
      .map((row) => row.transaction_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  return (rows ?? []).map((row) => ({
    transactionId: row.id as string,
    occurredOn: row.occurred_on as string,
    amount: Number(row.amount),
    isIncome: (row.categories as unknown as { type: string }).type === "income",
    fromRecurringTemplate: row.recurring_template_id !== null,
    // A row the feed already answers for cannot also be the thing a second
    // bank row duplicates.
    alreadyClaimed: claimedIds.has(row.id as string),
  }));
}
