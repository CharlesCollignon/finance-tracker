import { createClient } from "@/lib/supabase/server";
import {
  describeReviewReason,
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

/** How many bank rows an earlier sync merged away without asking. */
export async function countSwallowedFeedItems(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("decided_by", "match:recurring");

  return count ?? 0;
}
