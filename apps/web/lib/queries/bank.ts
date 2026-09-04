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
 * What was decided recently, so a decision can be taken back.
 *
 * The inbox was a one-way door: pick a category, press Add, and the row was
 * gone from the only screen that knew where it came from. Putting a card in
 * the wrong category is the easiest mistake to make here — the list is long
 * and the labels are bank shorthand — and the only way back was to hunt the
 * transaction down in the ledger, where it no longer says which bank line it
 * came from.
 *
 * Bounded rather than complete. This is a means of correcting what you just
 * did, not an archive; the ledger is the archive.
 */
export async function getDecidedFeedItems(
  userId: string,
  limit = 40,
): Promise<DecidedFeedRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*, transactions(category_id, categories(name, type))")
    .eq("user_id", userId)
    .in("status", ["imported", "ignored"])
    .order("occurred_on", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  type Joined = BankFeedItem & {
    transactions: {
      category_id: string;
      categories: { name: string; type: CategoryType } | null;
    } | null;
  };

  return ((data ?? []) as Joined[]).map((row) => ({
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

export interface BankMovement {
  id: string;
  occurredOn: string;
  amount: number;
  direction: "in" | "out";
  /** The merchant, or the payer for money in. Falls back to the bank's note. */
  label: string;
  /** Where it landed, when it has landed anywhere. */
  categoryName: string | null;
  categoryType: CategoryType | null;
  /** Still waiting for a category, so the row can say so and link onward. */
  pending: boolean;
  /** Deliberately kept out of the ledger. */
  ignored: boolean;
}

/**
 * The last movements the account actually saw, whatever became of them.
 *
 * The Month screen's other figures are all derived — sums, projections,
 * reconciliations — and derived figures are exactly what a person doubts when
 * they are wondering whether the app has noticed something yet. This is the
 * one block on the screen that is not a claim about the month: it is the
 * statement, in the bank's own words, newest first.
 *
 * All three statuses on purpose. Filtering to what has been filed would hide
 * the rows the user most wants to see — the coffee from an hour ago that is
 * still waiting for a category is precisely the evidence that the refresh
 * worked.
 */
export async function getRecentBankMovements(
  userId: string,
  limit = 6,
): Promise<BankMovement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*, transactions(categories(name, type))")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    // Newest first within the day, so the most recent movement heads the list
    // rather than whichever of the day's rows the database happened to return.
    .order("intraday_index", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  type Joined = BankFeedItem & {
    transactions: {
      categories: { name: string; type: CategoryType } | null;
    } | null;
  };

  return ((data ?? []) as Joined[]).map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    amount: Number(row.amount),
    direction: row.direction,
    label: row.counterparty ?? row.note,
    categoryName: row.transactions?.categories?.name ?? null,
    categoryType: row.transactions?.categories?.type ?? null,
    pending: row.status === "pending",
    ignored: row.status === "ignored",
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
