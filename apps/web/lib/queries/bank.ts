import { createClient } from "@/lib/supabase/server";
import { hasBankFeed as bankFeeds } from "@finance/data/bank-feed";
import { allRows } from "@finance/core/paging";
import {
  describeReviewReason,
  type ReviewReason,
} from "@finance/core/bank-feed";
import {
  bankMerchantKey,
  buildBankMerchantIndex,
  type BankMerchantIndex,
} from "@finance/core/bank-merchant";
import {
  detectRecurring,
  filterLiveProposals,
  type RecurringProposal,
} from "@finance/core/recurring-detection";
import type { BankFeedItem, CategoryType } from "@finance/core/types/database";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

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
function reasonOf(decidedBy: string | null, locale: Locale): string {
  const why = decidedBy?.startsWith("review:")
    ? (decidedBy.slice("review:".length) as ReviewReason)
    : null;
  return why
    ? describeReviewReason(why, locale)
    : translator(locale)("bankReview.waiting");
}

export async function getPendingFeedItems(
  userId: string,
  locale: Locale,
): Promise<PendingFeedRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("occurred_on", { ascending: false })
    // A first sync over a whole statement can leave hundreds waiting, and
    // the review groups them by shop — which only works when a shop's rows
    // are all in hand. A hundred used to be enough for a flat list read top
    // to bottom; it would split a year of weekly shopping across the cut.
    .limit(1000);

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
    why: reasonOf(row.decided_by, locale),
    suggestedCategoryId: null,
  }));
}

/**
 * The user's own history, keyed the way the bank matcher keys a shop — what
 * the review's groups take their suggested category from.
 *
 * The same read the sync makes before filing (`lib/bank/sync`), so a group is
 * offered the answer the sync would have given had the vote been unanimous.
 */
export async function getBankMerchantIndex(
  userId: string,
): Promise<BankMerchantIndex> {
  const supabase = await createClient();
  // Paged, because `.limit(2000)` alone is 1,000 under the server's cap. A
  // failed read leaves the groups without a suggestion rather than the page
  // without a review.
  const data = await allRows(
    (from, to) =>
      supabase
        .from("transactions")
        .select("note, category_id, occurred_on, categories(name, type)")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .order("id")
        .range(from, to),
    { max: 2000 },
  ).catch(() => []);

  type Row = {
    note: string | null;
    category_id: string;
    occurred_on: string;
    categories: { name: string; type: string } | null;
  };

  return buildBankMerchantIndex(
    (data as unknown as Row[]).flatMap((row) =>
      row.categories ? [{ ...row, categories: row.categories }] : [],
    ),
  );
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
 * with. Without one, templates are the only way anything gets written, and
 * each month fills itself from them.
 *
 * Answered from the data rather than from configuration, because the mobile
 * app has to reach the same conclusion and it has none of the server's
 * environment. Having synced once is the fact that matters.
 */
export async function hasBankFeed(userId: string): Promise<boolean> {
  return bankFeeds(await createClient(), userId);
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

  const [transactions, { data: templates }, { data: refused }] =
    await Promise.all([
      // Paged: `.limit(3000)` alone stops at the server's 1,000. A failed
      // read proposes nothing, as it always has.
      allRows(
        (from, to) =>
          supabase
            .from("transactions")
            .select(
              "occurred_on, amount, note, category_id, categories!inner(name, type)",
            )
            .eq("user_id", userId)
            .order("occurred_on", { ascending: false })
            .order("id")
            .range(from, to),
        { max: 3000 },
      ).catch(() => []),
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
    transactions.map((row) => {
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
