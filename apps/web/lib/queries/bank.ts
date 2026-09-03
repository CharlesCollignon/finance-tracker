import { createClient } from "@/lib/supabase/server";
import {
  describeReviewReason,
  type ReviewReason,
} from "@finance/core/bank-feed";
import { bankMerchantKey } from "@finance/core/bank-merchant";
import {
  detectRecurring,
  filterLiveProposals,
  type RecurringProposal,
} from "@finance/core/recurring-detection";
import type { BankFeedItem, CategoryType } from "@finance/core/types/database";

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

/** How many bank rows exist at all, to tell a first sync from a routine one. */
export async function countFeedItems(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
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

/**
 * Whether this user's ledger is fed by a bank.
 *
 * The one predicate the whole model turns on. With a feed the bank is the
 * record of what happened and recurring templates only forecast what is
 * coming, so nothing applies them and there is no second writer to collide
 * with. Without one, templates are the only way anything gets written and
 * applying stays exactly as it was.
 *
 * Answered from the data rather than from configuration, because the mobile
 * app has to reach the same conclusion and it has none of the server's
 * environment. Having synced once is the fact that matters.
 */
export async function hasBankFeed(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}

/* -------------------------------------------------- standing charges seen */

/**
 * Standing charges the statement implies but no template covers.
 *
 * Read from transactions rather than from the raw feed, so it works the same
 * whether the rows came from a bank or from a CSV, and so it sees the
 * categories the user has already put them in.
 */
export async function getRecurringProposals(
  userId: string,
  today: string,
): Promise<RecurringProposal[]> {
  const supabase = await createClient();

  const [{ data: transactions }, { data: templates }, { data: refused }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          "occurred_on, amount, note, category_id, categories!inner(name, type)",
        )
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .limit(3000),
      supabase
        .from("recurring_templates")
        .select("description, instrument_name")
        .eq("user_id", userId),
      supabase
        .from("recurring_proposal_dismissals")
        .select("merchant_key")
        .eq("user_id", userId),
    ]);

  // Covered either by a template that already exists, or by the user having
  // looked at the suggestion and said no. A refusal that does not stick is
  // not a refusal.
  const covered = new Set([
    ...(templates ?? []).flatMap((row) =>
      [row.description, row.instrument_name]
        .map((value) => bankMerchantKey(value as string | null))
        .filter((key) => key !== ""),
    ),
    ...(refused ?? []).map((row) => row.merchant_key as string),
  ]);

  const proposals = detectRecurring(
    (transactions ?? []).map((row) => {
      const category = row.categories as unknown as {
        name: string;
        type: CategoryType;
      };
      return {
        occurredOn: row.occurred_on as string,
        amount: Number(row.amount),
        note: row.note as string | null,
        categoryId: row.category_id as string,
        categoryName: category.name,
        categoryType: category.type,
      };
    }),
  );

  return filterLiveProposals(proposals, today, covered);
}
