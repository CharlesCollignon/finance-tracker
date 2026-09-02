import { createClient } from "@/lib/supabase/server";
import {
  describeReviewReason,
  MATCH_WINDOW_DAYS,
  type ReviewReason,
} from "@finance/core/bank-feed";
import type { BankFeedItem } from "@finance/core/types/database";

export interface PendingFeedRow {
  id: string;
  occurredOn: string;
  amount: number;
  direction: "in" | "out";
  counterparty: string | null;
  note: string;
  /** Why it is waiting, in words. */
  why: string;
  /** The category the sync would have chosen, if it had one. */
  suggestedCategoryId: string | null;
}

/** Parses `review:<reason>` / `auto:<reason>` back out of `decided_by`. */
function reasonOf(decidedBy: string | null): string {
  const why = decidedBy?.startsWith("review:")
    ? (decidedBy.slice("review:".length) as ReviewReason)
    : null;
  return why ? describeReviewReason(why) : "Waiting";
}

export async function getPendingFeedItems(
  userId: string,
): Promise<PendingFeedRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("occurred_on", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return ((data ?? []) as BankFeedItem[]).map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    amount: Number(row.amount),
    direction: row.direction,
    counterparty: row.counterparty,
    note: row.note,
    why: reasonOf(row.decided_by),
    suggestedCategoryId: null,
  }));
}

/* ------------------------------------------------------------- duplicates */

export interface DuplicatePair {
  /** The feed item that produced the copy. */
  feedItemId: string;
  /** The transaction the feed created, and which would be dropped. */
  bankTransactionId: string;
  bankNote: string;
  bankOccurredOn: string;
  /** The row that was already there. */
  keptTransactionId: string;
  keptNote: string | null;
  keptOccurredOn: string;
  keptCategoryName: string;
  keptFromRecurring: boolean;
  amount: number;
}

function daysApart(left: string, right: string): number {
  return (
    Math.abs(
      Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`),
    ) / 86_400_000
  );
}

/**
 * Transactions the feed created that something already accounted for.
 *
 * These exist because the duplicate check arrived after the first syncs, and
 * because accepting a row from the inbox used to bypass it. Both are fixed,
 * so this list should only ever shrink — but it has to exist, because
 * nothing else can tell the two copies apart once they are both sitting in
 * the ledger looking identical.
 */
export async function getDuplicatePairs(
  userId: string,
): Promise<DuplicatePair[]> {
  const supabase = await createClient();

  const [{ data: items }, { data: transactions }] = await Promise.all([
    supabase
      .from("bank_feed_items")
      .select("id, transaction_id, note, occurred_on, amount")
      .eq("user_id", userId)
      .eq("status", "imported")
      .not("transaction_id", "is", null),
    supabase
      .from("transactions")
      .select(
        "id, occurred_on, amount, note, recurring_template_id, categories!inner(name, type)",
      )
      .eq("user_id", userId),
  ]);

  const rows = transactions ?? [];
  // Every transaction the feed is responsible for; the survivor of a pair
  // must not be one of these, or two bank rows would pair with each other.
  const feedOwned = new Set(
    (items ?? [])
      .map((item) => item.transaction_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  const pairs: DuplicatePair[] = [];
  const spokenFor = new Set<string>();

  for (const item of items ?? []) {
    const bankId = item.transaction_id as string;
    const bank = rows.find((row) => row.id === bankId);
    if (!bank) {
      continue;
    }

    const amount = Number(bank.amount);
    const match = rows.find((row) => {
      if (row.id === bankId || feedOwned.has(row.id) || spokenFor.has(row.id)) {
        return false;
      }
      if (Math.abs(Number(row.amount) - amount) > 0.009) {
        return false;
      }
      return daysApart(row.occurred_on, bank.occurred_on) <= MATCH_WINDOW_DAYS;
    });

    if (!match) {
      continue;
    }

    spokenFor.add(match.id);
    pairs.push({
      feedItemId: item.id,
      bankTransactionId: bankId,
      bankNote: (item.note as string) ?? "",
      bankOccurredOn: bank.occurred_on,
      keptTransactionId: match.id,
      keptNote: match.note,
      keptOccurredOn: match.occurred_on,
      keptCategoryName: (match.categories as unknown as { name: string }).name,
      keptFromRecurring: match.recurring_template_id !== null,
      amount,
    });
  }

  return pairs.sort((a, b) => b.bankOccurredOn.localeCompare(a.bankOccurredOn));
}
