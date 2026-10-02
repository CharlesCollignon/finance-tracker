import {
  describeReviewReason,
  type ReviewReason,
} from "@finance/core/bank-feed";
import {
  bankMerchantKey,
  buildBankMerchantIndex,
  type BankMerchantIndex,
} from "@finance/core/bank-merchant";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import { allRows } from "@finance/core/paging";
import {
  detectRecurring,
  filterLiveProposals,
  type RecurringProposal,
} from "@finance/core/recurring-detection";
import type { BankFeedItem, CategoryType } from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * The review inbox's reads, for both apps: what waits, what was just
 * decided, the history a shop's category is suggested from, and the
 * standing charges a statement implies.
 *
 * The two apps carried a copy each, and they had drifted: the phone asked
 * for 2 000 and 3 000 transactions with a plain `.limit`, which the
 * server's 1 000-row cap cut short, so its suggestions and its recurring
 * detection only ever saw the latest thousand. Paged here, for both.
 *
 * Every read here is bank-feed-adjacent and optional: a deployment that
 * has not run the feed's migrations has an empty inbox, not a broken
 * screen.
 */

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

/** Parses `review:<reason>` back out of `decided_by`. */
function reasonOf(decidedBy: string | null, locale: Locale): string {
  const why = decidedBy?.startsWith("review:")
    ? (decidedBy.slice("review:".length) as ReviewReason)
    : null;
  return why
    ? describeReviewReason(why, locale)
    : translator(locale)("bankReview.waiting");
}

export async function getPendingFeedItems(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<PendingFeedRow[]> {
  const { data, error } = await db
    .from("bank_feed_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("occurred_on", { ascending: false })
    // A first sync over a whole statement can leave hundreds waiting, and
    // the review groups them by shop — which only works when a shop's rows
    // are all in hand. A year of weekly shopping is past a hundred.
    .limit(1000);

  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
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
 * the review's groups take their suggested category from, and the same read
 * the sync makes before filing. A failed read leaves the groups without a
 * suggestion rather than the screen without a review.
 */
export async function getBankMerchantIndex(
  db: Db,
  userId: string,
): Promise<BankMerchantIndex> {
  const data = await allRows(
    (from, to) =>
      db
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

/**
 * What was decided recently, so a decision can be taken back. Filing a card
 * payment under the wrong category is the easiest mistake to make here, and
 * without this the row vanishes from the only screen that knows which bank
 * line it came from. Bounded: this undoes what was just done, and the
 * ledger is the archive.
 */
export async function getDecidedFeedItems(
  db: Db,
  userId: string,
  limit = 40,
): Promise<DecidedFeedRow[]> {
  const { data, error } = await db
    .from("bank_feed_items")
    .select("*, transactions(category_id, categories(name, type))")
    .eq("user_id", userId)
    .in("status", ["imported", "ignored"])
    .order("occurred_on", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
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

/** How many bank rows match, or nothing when the feed is not set up here. */
async function countFeed(
  db: Db,
  userId: string,
  narrow: (query: ReturnType<typeof feedCount>) => ReturnType<typeof feedCount>,
): Promise<number> {
  const { count, error } = await narrow(feedCount(db, userId));
  if (error) {
    if (isMissingSchema(error)) {
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

function feedCount(db: Db, userId: string) {
  return db
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
}

/** How many bank rows exist at all, to tell a first sync from a routine one. */
export function countFeedItems(db: Db, userId: string): Promise<number> {
  return countFeed(db, userId, (query) => query);
}

/** How many bank rows are still waiting for a category. */
export function countPendingFeedItems(db: Db, userId: string): Promise<number> {
  return countFeed(db, userId, (query) => query.eq("status", "pending"));
}

/** How many bank rows an earlier sync merged away without asking. */
export function countSwallowedFeedItems(
  db: Db,
  userId: string,
): Promise<number> {
  return countFeed(db, userId, (query) =>
    query.eq("decided_by", "match:recurring"),
  );
}

/**
 * Standing charges the statement implies but no template covers.
 *
 * Read from transactions rather than from the raw feed, so it works the same
 * whether the rows came from a bank or from a CSV, and so it sees the
 * categories the user has already put them in. A suggestion is optional: a
 * failed read proposes nothing.
 */
export async function getRecurringProposals(
  db: Db,
  userId: string,
  today: string,
): Promise<RecurringProposal[]> {
  const [transactions, templates, refused] = await Promise.all([
    allRows(
      (from, to) =>
        db
          .from("transactions")
          .select(
            "occurred_on, amount, note, category_id, categories!inner(name, type)",
          )
          .eq("user_id", userId)
          .order("occurred_on", { ascending: false })
          .order("id")
          .range(from, to),
      { max: 3000 },
    ).catch(() => null),
    db
      .from("recurring_templates")
      .select("description, instrument_name")
      .eq("user_id", userId),
    db
      .from("recurring_proposal_dismissals")
      .select("merchant_key")
      .eq("user_id", userId),
  ]);

  if (!transactions || templates.error || refused.error) {
    return [];
  }

  // Covered either by a template that already exists, or by the user having
  // looked at the suggestion and said no. A refusal that does not stick is
  // not a refusal.
  const covered = new Set([
    ...(templates.data ?? []).flatMap((row) =>
      [row.description, row.instrument_name]
        .map((value) => bankMerchantKey(value))
        .filter((key) => key !== ""),
    ),
    ...(refused.data ?? []).map((row) => row.merchant_key),
  ]);

  const proposals = detectRecurring(
    transactions.map((row) => {
      const category = row.categories as unknown as {
        name: string;
        type: CategoryType;
      };
      return {
        occurredOn: row.occurred_on,
        amount: Number(row.amount),
        note: row.note,
        categoryId: row.category_id,
        categoryName: category.name,
        categoryType: category.type,
      };
    }),
  );

  return filterLiveProposals(proposals, today, covered);
}
