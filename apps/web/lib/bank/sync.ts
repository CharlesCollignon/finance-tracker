import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "@open-banking-io/client";
import { allRows } from "@finance/core/paging";
import {
  indexCategoriesByName,
  planFeed,
  type BankTransaction,
  type DecideOptions,
  type ExistingLedgerRow,
  type FeedPlan,
  type PlannedFeedRow,
} from "@finance/core/bank-feed";
import { intradayIndexes } from "@finance/core/bank-balance";
import { buildMerchantIndex } from "@finance/core/merchant-memory";
import { buildBankMerchantIndex } from "@finance/core/bank-merchant";
import type {
  BankAccountRole,
  Database,
  TransactionWithCategory,
} from "@finance/core/types/database";
import {
  cleanIban,
  isFollowed,
  jointFeeders,
  movementsOwner,
  ownTransferIbans,
} from "@finance/core/bank-accounts";
import type { PullKind } from "@finance/core/bank-pull";
import { getBankConnection } from "@/lib/bank/client";
import { consentByBank } from "@/lib/bank/health";
import { pullFromBank } from "@/lib/bank/pull";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import { cashDateOf } from "@finance/core/cash-date";
import { isPurchaseInsideWallet } from "@finance/core/categories";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";

type Client = SupabaseClient<Database>;

export interface SyncOutcome {
  /** Accounts the provider answered for. */
  accounts: number;
  /**
   * What asking the bank itself came to, or null when it was not asked.
   *
   * Distinct from everything else here, which describes what was done with
   * the statement once we had it. A sync with `pull: null` read the copy the
   * provider already held — correct, and possibly hours old.
   */
  pull: {
    pulled: boolean;
    /** Rows the bank had that the provider did not, when it was asked. */
    newTransactions: number | null;
    /** Why it was not asked, when it was not. */
    why: string | null;
  } | null;
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

/** A day this many days before today, on the app's own calendar (Paris). */
function isoDaysAgo(days: number): string {
  return shiftIsoDate(todayIsoLocal(), -days);
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
  /**
   * Ask the bank for anything new before reading the statement, and say who
   * is asking — the two have different allowances under PSD2, so the caller
   * has to name itself rather than let this guess.
   *
   * Omitted means read the copy the provider already holds, which is what
   * every caller did before pulling existed and is still the right thing for
   * anything that only needs the statement re-planned.
   */
  pull?: PullKind;
  /**
   * Only these accounts. The first import of a whole history runs one
   * account per request, so no single request has to outlast the function's
   * time limit however long the statement is.
   */
  accountIds?: readonly string[];
}

export async function syncBankFeed(
  supabase: Client,
  userId: string,
  { backfill = false, pull, accountIds }: SyncOptions = {},
): Promise<SyncOutcome> {
  const connection = await getBankConnection(userId);
  if (!connection) {
    throw new Error("refresh.noBank");
  }

  // Before the accounts are listed, so the balances and the statement below
  // are read after whatever the bank had to add. A refusal is not an error:
  // the stored statement is still readable, and the outcome says how it was
  // obtained so a screen can be honest about it.
  const pullOutcome = pull ? await pullFromBank(supabase, userId, pull) : null;

  const [allAccounts, consents] = await Promise.all([
    connection.client.getAccounts(),
    // When each bank stops sharing, for the Bank page to say bank by bank.
    // Not knowing it this time is not a failed sync: the dates stay.
    connection.client
      .getConnections()
      .then(consentByBank)
      .catch(() => undefined),
  ]);

  // Every account is recorded, followed or not, readable or not: the Bank
  // page lists them all, a new one is how the user learns a bank was added,
  // and a lapsed one has to be shown to say why it is not counted. What the
  // user said each one is comes back from the same write.
  const remembered = await rememberAccounts(
    supabase,
    userId,
    allAccounts,
    consents,
  );
  const roleOf = (account: { id: string }) =>
    remembered.get(account.id)?.role ?? null;

  // Whose rows each account's movements become: the person's for a current
  // account, their shared space's for a joint one (migration 061), nobody's
  // for a Livret or an account with no role yet — a Livret's movements are
  // the other side of transfers the current account already recorded.
  //
  // A joint account both partners connected feeds the space once: the copy
  // seen first does, the other is left out (`jointFeeders`).
  const feeders = await jointFeedersOf(supabase, [...remembered.values()]);
  const ownerOf = (account: { id: string }): string | null => {
    const known = remembered.get(account.id);
    if (!known) {
      return null;
    }
    const owner = movementsOwner(
      { role: known.role, space_id: known.spaceId },
      userId,
    );
    return known.role === "joint" && !feeders.has(account.id) ? null : owner;
  };

  // A consent that has lapsed answers with an empty statement rather than an
  // error, which would read as "nothing happened this month" — the most
  // dangerous possible lie for a ledger. Skipped and counted instead, so the
  // silence is visible. N26 alone contributes a Space per envelope, most of
  // them empty, so this is not a rare case. Counted only where the user
  // follows the account: one they left aside is not theirs to renew.
  const accounts = allAccounts.filter(
    (account) =>
      !account.needsReconnect &&
      ownerOf(account) !== null &&
      (!accountIds || accountIds.includes(account.id)),
  );
  const needReconnect = allAccounts.filter(
    (account) => account.needsReconnect && isFollowed(roleOf(account)),
  ).length;
  const since = isoDaysAgo(backfill ? BACKFILL_DAYS : LOOKBACK_DAYS);

  const outcome: SyncOutcome = {
    accounts: accounts.length,
    needReconnect,
    pull: pullOutcome
      ? {
          pulled: pullOutcome.pulled,
          newTransactions: pullOutcome.pulled
            ? pullOutcome.newTransactions
            : null,
          why: pullOutcome.pulled ? null : pullOutcome.why,
        }
      : null,
    imported: 0,
    pending: 0,
    duplicates: 0,
    discarded: 0,
    matched: 0,
    balances: [],
  };

  // One owner at a time: what a bank row is matched against — the ledger's
  // own rows, its categories, the bank rows already seen — is that owner's.
  const owners = new Map<string, Account[]>();
  for (const account of accounts) {
    const owner = ownerOf(account)!;
    owners.set(owner, [...(owners.get(owner) ?? []), account]);
  }

  for (const [ownerId, owned] of owners) {
    // Transfers between an owner's own accounts are money that did not move:
    // between the person's current accounts, or the space's joint ones. From
    // every account, not only those this request walks: a first import takes
    // one account at a time.
    const ownIbans = ownTransferIbans(
      allAccounts
        .filter((account) => ownerOf(account) === ownerId)
        .map((account) => ({ iban: account.iban, role: "spending" as const })),
    );
    const context = await ownerContext(supabase, ownerId);
    // The person's money sent to their space's joint account, whoever's
    // connection reads that account: « Versement au compte commun ».
    const jointTransfer =
      ownerId === userId ? await jointTransferFor(supabase, userId) : undefined;

    for (const account of owned) {
      const booked = pickBookedBalance(account);

      if (booked) {
        outcome.balances.push({
          accountId: account.id,
          label: accountLabel(account),
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
        if (
          page.items.length < PAGE_LIMIT ||
          items.length >= MAX_TRANSACTIONS
        ) {
          break;
        }
      }

      const positions = intradayIndexes(
        items.map((tx) => ({
          id: tx.id,
          date: tx.bookingDate ?? tx.valueDate ?? tx.transactionDate,
        })),
      );

      // Written into the stored rows (the note of a row with no description),
      // so in the product's language: a sync often runs with nobody present.
      const plan = planFeed(items, {
        locale: DEFAULT_LOCALE,
        merchants: context.merchants,
        bankMerchants: context.bankMerchants,
        existing: context.existing,
        categoryIdsByName: context.categoryIdsByName,
        seenProviderIds: context.seenProviderIds,
        ownIbans,
        jointTransfer,
      });

      // A row the database already holds is skipped by the planner, which is
      // right for the ledger and wrong for the balance: the running figure is
      // a fact about the account that arrived with this fetch, and the rows
      // that carry it are overwhelmingly ones seen on an earlier sync.
      // Without this, adding the column would have left it null on every row
      // already stored and no amount of syncing would ever fill it.
      await refreshBalances(
        supabase,
        ownerId,
        items,
        context.seenProviderIds,
        positions,
      );

      outcome.duplicates += plan.duplicates;
      outcome.discarded += plan.discarded;

      const written = await writePlan(
        supabase,
        ownerId,
        account.id,
        plan,
        positions,
      );
      outcome.imported += written.imported;
      outcome.pending += written.pending;
      outcome.matched += written.matched;
    }
  }

  return outcome;
}

/** What a bank row is matched against, for one owner. */
interface OwnerContext {
  merchants: ReturnType<typeof buildMerchantIndex>;
  bankMerchants: ReturnType<typeof buildBankMerchantIndex>;
  existing: ExistingLedgerRow[];
  categoryIdsByName: ReturnType<typeof indexCategoriesByName>;
  seenProviderIds: Set<string>;
}

/**
 * The owner's answers — what makes a sync mostly automatic — and the
 * categories an MCC has to resolve against, with the bank rows already seen.
 *
 * Both lists are paged: the server stops at 1,000 rows without saying so,
 * which left a `.limit(2000)` at half of what it asked for, and every bank
 * row past the thousandth looking unseen — its balance never refreshed and
 * the ledger row it had claimed free to be claimed again.
 */
async function ownerContext(
  supabase: Client,
  ownerId: string,
): Promise<OwnerContext> {
  const [history, { data: categories }, seen] = await Promise.all([
    allRows(
      (from, to) =>
        supabase
          .from("transactions")
          .select("*, categories(name, type, icon, counts_toward_summary)")
          .eq("user_id", ownerId)
          .order("occurred_on", { ascending: false })
          .order("id")
          .range(from, to),
      { max: 2000 },
    ),
    supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", ownerId)
      .eq("archived", false),
    allRows((from, to) =>
      supabase
        .from("bank_feed_items")
        .select("provider_id, transaction_id")
        .eq("user_id", ownerId)
        .order("id")
        .range(from, to),
    ),
  ]);

  const past = history as TransactionWithCategory[];
  // Which ledger rows a bank row could be a copy of. A feed item that already
  // points at a transaction has claimed it, so a later sync cannot file a
  // second bank row against the same one.
  const claimedIds = new Set(
    seen
      .map((row) => row.transaction_id)
      .filter((id): id is string => Boolean(id)),
  );
  return {
    merchants: buildMerchantIndex(past),
    // Measured on a real Crédit Agricole statement, the coarse key answers
    // for 85% of card payments against 65% for exact matching: the same shop
    // split across keys by a trailing branch or street was most of the
    // difference.
    bankMerchants: buildBankMerchantIndex(past),
    existing: past.map((tx) => ({
      transactionId: tx.id,
      // The bank dates a row by the day its money moved, so a copy is looked
      // for on that day — not the day an early salary was moved to count for.
      occurredOn: cashDateOf(tx),
      amount: Number(tx.amount),
      isIncome: tx.categories.type === "income",
      fromRecurringTemplate: tx.recurring_template_id !== null,
      alreadyClaimed: claimedIds.has(tx.id),
      categoryId: tx.category_id,
      insideWallet: isPurchaseInsideWallet(tx.categories),
    })),
    categoryIdsByName: indexCategoriesByName(categories ?? []),
    seenProviderIds: new Set(seen.map((row) => row.provider_id as string)),
  };
}

/**
 * Which of this person's joint accounts feed their space: all of them, but a
 * copy of one the partner connected first (same IBAN fingerprint). The
 * partner's copies are readable for exactly this (migration 061).
 */
async function jointFeedersOf(
  supabase: Client,
  mine: readonly RememberedAccount[],
): Promise<Set<string>> {
  const spaces = [
    ...new Set(
      mine
        .filter((account) => account.role === "joint" && account.spaceId)
        .map((account) => account.spaceId!),
    ),
  ];
  if (spaces.length === 0) {
    return new Set();
  }
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      "user_id, provider_account_id, role, space_id, iban_hash, first_seen_at",
    )
    .in("space_id", spaces);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as {
    user_id: string;
    provider_account_id: string;
    role: BankAccountRole | null;
    space_id: string | null;
    iban_hash: string | null;
    first_seen_at: string;
  }[];
  const owner = mine[0]?.userId;
  return new Set(
    jointFeeders(rows)
      .filter((row) => row.user_id === owner)
      .map((row) => row.provider_account_id),
  );
}

/**
 * What files the person's transfers to their space's joint account: the
 * account's fingerprints — theirs or the partner's copy — and the category,
 * made the first time it is needed. Undefined outside a space, or for a
 * space with no joint account yet.
 */
async function jointTransferFor(
  supabase: Client,
  userId: string,
): Promise<DecideOptions["jointTransfer"]> {
  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    return undefined;
  }
  const { data: joint } = await supabase
    .from("bank_accounts")
    .select("iban_hash")
    .eq("space_id", membership.space_id)
    .eq("role", "joint");
  const hashes = new Set(
    (joint ?? [])
      .map((account) => account.iban_hash)
      .filter((hash): hash is string => Boolean(hash)),
  );
  if (hashes.size === 0) {
    return undefined;
  }

  // In the product's language, as the stored notes are: a sync often runs
  // with nobody present.
  const name = translator(DEFAULT_LOCALE)("space.transferCategory");
  const { data: found } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();
  const category =
    found ??
    (
      await supabase
        .from("categories")
        .insert({ user_id: userId, name, type: "expense", icon: "bank" })
        .select("id, name")
        .single()
    ).data;
  if (!category) {
    return undefined;
  }
  return {
    isJoint: (iban) => {
      const hash = ibanHash(iban);
      return hash !== null && hashes.has(hash);
    },
    category,
  };
}

/**
 * A fingerprint of an IBAN, never the IBAN: what tells the second partner's
 * copy of a joint account apart (migration 060).
 */
function ibanHash(iban: string | null | undefined): string | null {
  const clean = cleanIban(iban);
  return clean ? createHash("sha256").update(clean).digest("hex") : null;
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

/** What the provider calls an account, for a list the user can recognise. */
function accountLabel(account: Account): string {
  return (
    account.displayName ??
    account.accountName ??
    account.iban ??
    account.aspspName
  );
}

/**
 * Keep a record of every account the connection exposes, and read back what
 * the user said each one is.
 *
 * The Bank page has to list them before any of their transactions have been
 * stored, and has to be able to show a lapsed connection and say why it is
 * not counted. The role is deliberately not written: it is the user's answer,
 * not the provider's, and an account seen for the first time has none.
 *
 * One request for them all. A failure throws rather than reading as "no
 * account is followed", which would bring nothing in and say nothing.
 */
export interface RememberedAccount {
  /** Whose connection shows it. */
  userId: string;
  role: BankAccountRole | null;
  /** The shared space a « Compte commun » feeds. */
  spaceId: string | null;
  /** When its whole history was brought in, or null while it has not been. */
  historyImportedAt: string | null;
}

export async function rememberAccounts(
  supabase: Client,
  userId: string,
  accounts: readonly Account[],
  /** Each bank's consent end, by name; left as stored when not given. */
  consents?: ReadonlyMap<string, string>,
): Promise<Map<string, RememberedAccount>> {
  if (accounts.length === 0) {
    return new Map();
  }
  // Today in Paris: a sync just after midnight there is still yesterday in
  // UTC, and the balance was read today.
  const today = todayIsoLocal();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("bank_accounts")
    .upsert(
      accounts.map((account) => {
        const booked = pickBookedBalance(account);
        return {
          user_id: userId,
          provider_account_id: account.id,
          label: accountLabel(account),
          bank_name: account.aspspName || null,
          account_type: account.accountType,
          product: account.product,
          currency: account.currency,
          reported_balance: booked?.amount ?? null,
          reported_on: booked ? today : null,
          needs_reconnect: account.needsReconnect,
          iban_hash: ibanHash(account.iban),
          last_seen_at: now,
          ...(consents
            ? { consent_valid_until: consents.get(account.aspspName) ?? null }
            : {}),
        };
      }),
      { onConflict: "user_id,provider_account_id" },
    )
    .select("provider_account_id, role, space_id, history_imported_at");
  if (error) {
    throw error;
  }
  return new Map(
    (data ?? []).map((row) => [
      row.provider_account_id,
      {
        userId,
        role: row.role as BankAccountRole | null,
        spaceId: row.space_id,
        historyImportedAt: row.history_imported_at,
      },
    ]),
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

/** Rows per batched write: well inside a request PostgREST will take. */
const WRITE_CHUNK = 200;

/**
 * Write what the plan decided, in a few requests rather than two or three
 * per row — a first import of a few hundred rows used to be as many
 * round trips, one after another.
 *
 * Every feed row goes in through one upsert that leaves a row already there
 * as it is, so only new rows come back. A match goes in already filed
 * against its transaction. The automatic rows' transactions are created in
 * one insert, with ids made here so that each is known to belong to its
 * row without trusting the order rows come back in, and their feed rows
 * are pointed at them in one more write. A batch the database refuses is
 * retried a row at a time, so one bad row costs itself — it stays in the
 * review inbox — rather than its whole batch.
 */
async function writePlan(
  supabase: Client,
  userId: string,
  providerAccountId: string,
  plan: FeedPlan,
  positions: Map<string, number>,
): Promise<{ imported: number; pending: number; matched: number }> {
  const feedRow = (row: PlannedFeedRow) =>
    feedItemRow(userId, providerAccountId, row, positions);

  const inserted = await insertFeedItems(supabase, [
    ...plan.matched.map(feedRow),
    ...plan.review.map(feedRow),
    ...plan.automatic.map(feedRow),
  ]);
  const isNew = (row: PlannedFeedRow) => inserted.has(row.candidate.providerId);

  const matched = plan.matched.filter(
    (row) => row.decision.kind === "match" && isNew(row),
  ).length;
  const pending = plan.review.filter(isNew).length;

  const automatic = plan.automatic.filter(
    (row) => row.decision.kind === "auto" && isNew(row),
  );
  let imported = 0;
  for (let start = 0; start < automatic.length; start += WRITE_CHUNK) {
    const chunk = automatic.slice(start, start + WRITE_CHUNK);
    const created = await insertTransactions(supabase, userId, chunk);
    if (created.length === 0) {
      continue;
    }
    // The amount went in as the bank's own decimal string; Postgres rounds
    // it into numeric(12,2) exactly, where parsing it here first would not.
    const links = created.map(({ row, transactionId }) => ({
      ...feedRow(row),
      id: inserted.get(row.candidate.providerId)!,
      status: "imported" as const,
      transaction_id: transactionId,
    }));
    const { error } = await supabase
      .from("bank_feed_items")
      .upsert(links, { onConflict: "id" });
    if (error) {
      for (const link of links) {
        const { error: one } = await supabase
          .from("bank_feed_items")
          .update({ status: "imported", transaction_id: link.transaction_id })
          .eq("id", link.id)
          .eq("user_id", userId);
        if (!one) {
          imported += 1;
        }
      }
      continue;
    }
    imported += links.length;
  }

  return { imported, pending, matched };
}

/** A feed row as the table takes it, filed already when it is a match. */
function feedItemRow(
  userId: string,
  providerAccountId: string,
  row: PlannedFeedRow,
  positions: Map<string, number>,
) {
  const { candidate, decision } = row;
  const decidedBy =
    decision.kind === "auto"
      ? `auto:${decision.suggestion.reason}`
      : decision.kind === "match"
        ? "match:recurring"
        : `review:${decision.why}`;

  return {
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
    // Recorded, but nothing new is written: the transaction is already there.
    status:
      decision.kind === "match" ? ("imported" as const) : ("pending" as const),
    transaction_id: decision.kind === "match" ? decision.transactionId : null,
    decided_by: decidedBy,
  };
}

type FeedItemInsert = ReturnType<typeof feedItemRow>;

/**
 * Insert the rows not already there, by provider id. Returns the new rows'
 * ids; a row the bank sent before is left as it is and not returned.
 */
async function insertFeedItems(
  supabase: Client,
  rows: readonly FeedItemInsert[],
): Promise<Map<string, string>> {
  const inserted = new Map<string, string>();
  for (let start = 0; start < rows.length; start += WRITE_CHUNK) {
    const chunk = rows.slice(start, start + WRITE_CHUNK);
    const { data, error } = await supabase
      .from("bank_feed_items")
      .upsert(chunk, {
        onConflict: "user_id,provider_id",
        ignoreDuplicates: true,
      })
      .select("id, provider_id");

    if (!error) {
      for (const item of data ?? []) {
        inserted.set(item.provider_id, item.id);
      }
      continue;
    }
    // One refused row refuses the batch; the rest should still land.
    for (const row of chunk) {
      const { data: one } = await supabase
        .from("bank_feed_items")
        .upsert(row, {
          onConflict: "user_id,provider_id",
          ignoreDuplicates: true,
        })
        .select("id, provider_id")
        .maybeSingle();
      if (one) {
        inserted.set(one.provider_id, one.id);
      }
    }
  }
  return inserted;
}

/**
 * Create the automatic rows' transactions, with ids made here so each is
 * known to be its row's. A refused batch is retried a row at a time; a row
 * that still fails is left out, and its feed row stays pending in the inbox
 * instead of being lost between the two writes.
 */
async function insertTransactions(
  supabase: Client,
  userId: string,
  rows: readonly PlannedFeedRow[],
): Promise<{ row: PlannedFeedRow; transactionId: string }[]> {
  const planned = rows.flatMap((row) =>
    row.decision.kind === "auto"
      ? [
          {
            row,
            transaction: {
              id: crypto.randomUUID(),
              user_id: userId,
              category_id: row.decision.suggestion.categoryId,
              occurred_on: row.candidate.occurredOn,
              amount: row.candidate.amount,
              note: row.candidate.note,
            },
          },
        ]
      : [],
  );
  if (planned.length === 0) {
    return [];
  }

  const { error } = await supabase
    .from("transactions")
    .insert(planned.map((entry) => entry.transaction));
  if (!error) {
    return planned.map(({ row, transaction }) => ({
      row,
      transactionId: transaction.id,
    }));
  }

  const created: { row: PlannedFeedRow; transactionId: string }[] = [];
  for (const { row, transaction } of planned) {
    const { error: one } = await supabase
      .from("transactions")
      .insert(transaction);
    if (!one) {
      created.push({ row, transactionId: transaction.id });
    }
  }
  return created;
}
