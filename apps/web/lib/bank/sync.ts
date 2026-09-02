import type { SupabaseClient } from "@supabase/supabase-js";
import {
  indexCategoriesByName,
  planFeed,
  type BankTransaction,
  type FeedPlan,
  type PlannedFeedRow,
} from "@finance/core/bank-feed";
import { buildMerchantIndex } from "@finance/core/merchant-memory";
import { buildBankMerchantIndex } from "@finance/core/bank-merchant";
import type {
  Database,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { getBankConnection } from "@/lib/bank/client";

type Client = SupabaseClient<Database>;

export interface SyncOutcome {
  /** Accounts the provider answered for. */
  accounts: number;
  /** Written straight into the ledger. */
  imported: number;
  /** Waiting in the inbox. */
  pending: number;
  /** Already seen on an earlier run. */
  duplicates: number;
  /** Own transfers, unparseable rows, zero amounts. */
  discarded: number;
  /** Per-account balances, for pre-filling a month close. */
  balances: {
    accountId: string;
    label: string;
    amount: string;
    currency: string;
  }[];
}

/** How far back a sync looks. Enough to cover a missed month, not a history. */
const LOOKBACK_DAYS = 90;
const PAGE_LIMIT = 200;
/** A stop, so a pathological account cannot run the sync out of memory. */
const MAX_TRANSACTIONS = 2000;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Pull what the bank has, decide what to do with it, write the answer.
 *
 * The decisions live in `@finance/core/bank-feed` and are tested there; this
 * is the plumbing around them — what to fetch, what the user's history says,
 * and how a decision becomes rows.
 */
export async function syncBankFeed(
  supabase: Client,
  userId: string,
): Promise<SyncOutcome> {
  const connection = getBankConnection(userId);
  if (!connection) {
    throw new Error("No bank is connected to this account.");
  }

  const accounts = await connection.client.getAccounts();
  const since = isoDaysAgo(LOOKBACK_DAYS);

  // The user's own answers are what make a sync mostly automatic, and the
  // categories are what an MCC has to resolve against.
  const [{ data: history }, { data: categories }, { data: seen }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("*, categories(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .limit(2000),
      supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", userId)
        .eq("archived", false),
      supabase
        .from("bank_feed_items")
        .select("provider_id")
        .eq("user_id", userId),
    ]);

  const past = (history ?? []) as TransactionWithCategory[];
  const merchants = buildMerchantIndex(past);
  // Measured on a real Crédit Agricole statement, the coarse key answers for
  // 85% of card payments against 65% for exact matching: the same shop split
  // across keys by a trailing branch or street was most of the difference.
  const bankMerchants = buildBankMerchantIndex(past);
  const categoryIdsByName = indexCategoriesByName(categories ?? []);
  const seenProviderIds = new Set(
    (seen ?? []).map((row) => row.provider_id as string),
  );
  const ownIbans = new Set(
    accounts
      .map((account) => account.iban?.replace(/\s+/g, "").toUpperCase())
      .filter((iban): iban is string => Boolean(iban)),
  );

  const outcome: SyncOutcome = {
    accounts: accounts.length,
    imported: 0,
    pending: 0,
    duplicates: 0,
    discarded: 0,
    balances: [],
  };

  for (const account of accounts) {
    const booked =
      account.balances.find((b) => b.type === "ITBD") ?? account.balances[0];
    if (booked) {
      outcome.balances.push({
        accountId: account.id,
        label:
          account.displayName ??
          account.accountName ??
          account.iban ??
          account.aspspName,
        amount: booked.amount,
        currency: booked.currency,
      });
    }

    // Paged rather than one shot: a busy current account clears 200
    // transactions in well under the lookback window, and silently keeping
    // only the newest page would leave permanent holes in the ledger.
    const items: BankTransaction[] = [];
    for (let offset = 0; ; offset += PAGE_LIMIT) {
      const page = await connection.client.getTransactions(account.id, {
        from: since,
        limit: PAGE_LIMIT,
        offset,
      });
      items.push(...(page.items as BankTransaction[]));
      if (page.items.length < PAGE_LIMIT || items.length >= MAX_TRANSACTIONS) {
        break;
      }
    }

    const plan = planFeed(items, {
      merchants,
      bankMerchants,
      categoryIdsByName,
      seenProviderIds,
      ownIbans,
    });

    outcome.duplicates += plan.duplicates;
    outcome.discarded += plan.discarded;

    const written = await writePlan(supabase, userId, account.id, plan);
    outcome.imported += written.imported;
    outcome.pending += written.pending;
  }

  return outcome;
}

async function writePlan(
  supabase: Client,
  userId: string,
  providerAccountId: string,
  plan: FeedPlan,
): Promise<{ imported: number; pending: number }> {
  let imported = 0;
  let pending = 0;

  for (const row of plan.review) {
    const inserted = await insertFeedItem(
      supabase,
      userId,
      providerAccountId,
      row,
      "pending",
    );
    if (inserted) {
      pending += 1;
    }
  }

  for (const row of plan.automatic) {
    const item = await insertFeedItem(
      supabase,
      userId,
      providerAccountId,
      row,
      "pending",
    );
    if (!item) {
      continue;
    }

    if (row.decision.kind !== "auto") {
      continue;
    }

    // The amount goes in as the bank's own decimal string. Postgres rounds it
    // into numeric(12,2) exactly; parsing it here first would not.
    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        category_id: row.decision.suggestion.categoryId,
        occurred_on: row.candidate.occurredOn,
        amount: row.candidate.amount,
        note: row.candidate.note,
      })
      .select("id")
      .single();

    if (error || !transaction) {
      // The item stays pending, so the row shows up in the inbox instead of
      // being lost between the two writes.
      continue;
    }

    await supabase
      .from("bank_feed_items")
      .update({ status: "imported", transaction_id: transaction.id })
      .eq("id", item)
      .eq("user_id", userId);

    imported += 1;
  }

  return { imported, pending };
}

/** Returns the new item's id, or null when the row was already there. */
async function insertFeedItem(
  supabase: Client,
  userId: string,
  providerAccountId: string,
  row: PlannedFeedRow,
  status: "pending",
): Promise<string | null> {
  const { candidate, decision } = row;
  const decidedBy =
    decision.kind === "auto"
      ? `auto:${decision.suggestion.reason}`
      : `review:${decision.why}`;

  const { data, error } = await supabase
    .from("bank_feed_items")
    .upsert(
      {
        user_id: userId,
        provider_id: candidate.providerId,
        provider_account_id: providerAccountId,
        occurred_on: candidate.occurredOn,
        amount: candidate.amount,
        currency: candidate.currency,
        direction: candidate.direction,
        counterparty: candidate.counterparty,
        note: candidate.note,
        merchant_category_code: candidate.merchantCategoryCode,
        status,
        decided_by: decidedBy,
      },
      { onConflict: "user_id,provider_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  return error ? null : (data?.id ?? null);
}
