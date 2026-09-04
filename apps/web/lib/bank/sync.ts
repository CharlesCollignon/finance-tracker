import type { SupabaseClient } from "@supabase/supabase-js";
import {
  indexCategoriesByName,
  planFeed,
  type BankTransaction,
  type ExistingLedgerRow,
  type FeedPlan,
  type PlannedFeedRow,
} from "@finance/core/bank-feed";
import { intradayIndexes } from "@finance/core/bank-balance";
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
  /** Already in the ledger — a recurring template had written them. */
  matched: number;
  /** Accounts whose consent has lapsed and were not read. */
  needReconnect: number;
  /** Per-account balances, for pre-filling a month close. */
  balances: {
    accountId: string;
    label: string;
    amount: string;
    currency: string;
  }[];
}

/** How far back a routine sync looks: enough to cover a missed month. */
const LOOKBACK_DAYS = 90;
/**
 * How far back a backfill looks. Providers keep two years or so; asking for
 * more costs nothing and gets whatever is there.
 */
const BACKFILL_DAYS = 900;
const PAGE_LIMIT = 200;
/** A stop, so a pathological account cannot run the sync out of memory. */
const MAX_TRANSACTIONS = 5000;

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
export interface SyncOptions {
  /**
   * Reach for the whole statement rather than the recent window. Meant for
   * the first sync: the categoriser learns from history, so a year of it
   * makes almost everything after the first session automatic.
   */
  backfill?: boolean;
}

export async function syncBankFeed(
  supabase: Client,
  userId: string,
  { backfill = false }: SyncOptions = {},
): Promise<SyncOutcome> {
  const connection = getBankConnection(userId);
  if (!connection) {
    throw new Error("No bank is connected to this account.");
  }

  const allAccounts = await connection.client.getAccounts();

  // A consent that has lapsed answers with an empty statement rather than an
  // error, which would read as "nothing happened this month" — the most
  // dangerous possible lie for a ledger. Skipped and counted instead, so the
  // silence is visible. N26 alone contributes a Space per envelope, most of
  // them empty, so this is not a rare case.
  const accounts = allAccounts.filter((account) => !account.needsReconnect);
  const needReconnect = allAccounts.length - accounts.length;
  const since = isoDaysAgo(backfill ? BACKFILL_DAYS : LOOKBACK_DAYS);

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
        .select("provider_id, transaction_id")
        .eq("user_id", userId),
    ]);

  const past = (history ?? []) as TransactionWithCategory[];
  const merchants = buildMerchantIndex(past);
  // Measured on a real Crédit Agricole statement, the coarse key answers for
  // 85% of card payments against 65% for exact matching: the same shop split
  // across keys by a trailing branch or street was most of the difference.
  const bankMerchants = buildBankMerchantIndex(past);

  // Which ledger rows a bank row could be a copy of. A feed item that already
  // points at a transaction has claimed it, so a later sync cannot file a
  // second bank row against the same one.
  const claimedIds = new Set(
    (seen ?? [])
      .map((row) => (row as { transaction_id?: string | null }).transaction_id)
      .filter((id): id is string => Boolean(id)),
  );
  const existing: ExistingLedgerRow[] = past.map((tx) => ({
    transactionId: tx.id,
    occurredOn: tx.occurred_on,
    amount: Number(tx.amount),
    isIncome: tx.categories.type === "income",
    fromRecurringTemplate: tx.recurring_template_id !== null,
    alreadyClaimed: claimedIds.has(tx.id),
  }));
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
    needReconnect,
    imported: 0,
    pending: 0,
    duplicates: 0,
    discarded: 0,
    matched: 0,
    balances: [],
  };

  for (const account of accounts) {
    const label =
      account.displayName ??
      account.accountName ??
      account.iban ??
      account.aspspName;
    const booked = pickBookedBalance(account);

    if (booked) {
      outcome.balances.push({
        accountId: account.id,
        label,
        amount: booked.amount,
        currency: booked.currency,
      });
    }

    // Recorded whether or not it can be read, so the account picker can list
    // a lapsed connection and say why it is not counted.
    await rememberAccount(supabase, userId, account, label, booked);

    if (account.needsReconnect) {
      continue;
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

    const positions = intradayIndexes(
      items.map((tx) => ({
        id: tx.id,
        date: tx.bookingDate ?? tx.valueDate ?? tx.transactionDate,
      })),
    );

    const plan = planFeed(items, {
      merchants,
      bankMerchants,
      existing,
      categoryIdsByName,
      seenProviderIds,
      ownIbans,
    });

    // A row the database already holds is skipped by the planner, which is
    // right for the ledger and wrong for the balance: the running figure is a
    // fact about the account that arrived with this fetch, and the rows that
    // carry it are overwhelmingly ones seen on an earlier sync. Without this,
    // adding the column would have left it null on every row already stored
    // and no amount of syncing would ever fill it.
    await refreshBalances(supabase, userId, items, seenProviderIds, positions);

    outcome.duplicates += plan.duplicates;
    outcome.discarded += plan.discarded;

    const written = await writePlan(
      supabase,
      userId,
      account.id,
      plan,
      positions,
    );
    outcome.imported += written.imported;
    outcome.pending += written.pending;
    outcome.matched += written.matched;
  }

  return outcome;
}

/**
 * The account's own figure for what it holds, in preference order.
 *
 * ISO 20022 defines several and banks publish different ones. CLBD is the
 * closing booked balance and ITBD the interim booked; either is the money
 * that is actually there. XPCD — "expected" — is not: on a lapsed connection
 * this provider returns XPCD 0.00, and taking the first balance in the list
 * would read that as an empty account rather than as an unreadable one.
 */
function pickBookedBalance(account: {
  balances: { type: string; amount: string; currency: string }[];
}) {
  for (const type of ["CLBD", "ITBD", "ITAV", "CLAV"]) {
    const found = account.balances.find((b) => b.type === type);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Keep a record of the accounts a connection exposes.
 *
 * The picker that decides which balances a month close counts has to list
 * them before any of their transactions have been stored, and has to be able
 * to show a lapsed connection and say why it is not counted. `counts_as_cash`
 * is deliberately left alone on update: it is the user's answer, not the
 * provider's.
 */
async function rememberAccount(
  supabase: Client,
  userId: string,
  account: { id: string; currency: string; needsReconnect: boolean },
  label: string,
  booked: { amount: string; currency: string } | null,
): Promise<void> {
  await supabase.from("bank_accounts").upsert(
    {
      user_id: userId,
      provider_account_id: account.id,
      label,
      currency: account.currency,
      reported_balance: booked?.amount ?? null,
      reported_on: booked ? new Date().toISOString().slice(0, 10) : null,
      needs_reconnect: account.needsReconnect,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider_account_id" },
  );
}

/**
 * How many balance updates to have in flight at once. Small on purpose: this
 * runs inside a sixty-second cron alongside a bank fetch, and firing a couple
 * of hundred concurrent requests at PostgREST to save a second is a poor
 * trade against the run finishing at all.
 */
const BALANCE_CHUNK = 25;

/**
 * Fill in the running balance on rows the ledger already has.
 *
 * Only the two balance columns are the point, but PostgREST needs a payload
 * that would be valid as an insert, so the row's own unchanging facts go with
 * it. Deliberately absent: `status`, `transaction_id` and `decided_by`. Those
 * carry decisions the user or an earlier sync made, and resending them would
 * push an imported row back to pending.
 */
async function refreshBalances(
  supabase: Client,
  userId: string,
  items: BankTransaction[],
  seenProviderIds: ReadonlySet<string>,
  positions: Map<string, number>,
): Promise<void> {
  const rows = items
    .filter((tx) => seenProviderIds.has(tx.id))
    .map((tx) => {
      const balance = tx.balanceAfterTransaction?.trim() || null;
      const index = positions.get(tx.id);
      if (balance === null || index === undefined) {
        return null;
      }
      return {
        provider_id: tx.id,
        balance_after: balance,
        intraday_index: index,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  for (let start = 0; start < rows.length; start += BALANCE_CHUNK) {
    const chunk = rows.slice(start, start + BALANCE_CHUNK);
    await Promise.all(
      chunk.map((row) =>
        supabase
          .from("bank_feed_items")
          .update({
            balance_after: row.balance_after,
            intraday_index: row.intraday_index,
          })
          .eq("user_id", userId)
          .eq("provider_id", row.provider_id),
      ),
    );
  }
}

async function writePlan(
  supabase: Client,
  userId: string,
  providerAccountId: string,
  plan: FeedPlan,
  positions: Map<string, number>,
): Promise<{ imported: number; pending: number; matched: number }> {
  let imported = 0;
  let pending = 0;
  let matched = 0;

  // Recorded, but nothing new is written: the transaction is already there.
  for (const row of plan.matched) {
    if (row.decision.kind !== "match") {
      continue;
    }
    const item = await insertFeedItem(
      supabase,
      userId,
      providerAccountId,
      row,
      "pending",
      positions,
    );
    if (!item) {
      continue;
    }
    await supabase
      .from("bank_feed_items")
      .update({
        status: "imported",
        transaction_id: row.decision.transactionId,
      })
      .eq("id", item)
      .eq("user_id", userId);
    matched += 1;
  }

  for (const row of plan.review) {
    const inserted = await insertFeedItem(
      supabase,
      userId,
      providerAccountId,
      row,
      "pending",
      positions,
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
      positions,
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

  return { imported, pending, matched };
}

/** Returns the new item's id, or null when the row was already there. */
async function insertFeedItem(
  supabase: Client,
  userId: string,
  providerAccountId: string,
  row: PlannedFeedRow,
  status: "pending",
  positions: Map<string, number>,
): Promise<string | null> {
  const { candidate, decision } = row;
  const decidedBy =
    decision.kind === "auto"
      ? `auto:${decision.suggestion.reason}`
      : decision.kind === "match"
        ? "match:recurring"
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
        balance_after: candidate.balanceAfter,
        intraday_index: positions.get(candidate.providerId) ?? 0,
        status,
        decided_by: decidedBy,
      },
      { onConflict: "user_id,provider_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  return error ? null : (data?.id ?? null);
}
