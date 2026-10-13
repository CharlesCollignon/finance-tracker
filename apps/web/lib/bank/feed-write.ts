import type { SupabaseClient } from "@supabase/supabase-js";
import { allRows } from "@finance/core/paging";
import {
  indexCategoriesByName,
  type ExistingLedgerRow,
  type FeedPlan,
  type PlannedFeedRow,
  type BankTransaction,
} from "@finance/core/bank-feed";
import { buildMerchantIndex } from "@finance/core/merchant-memory";
import { buildBankMerchantIndex } from "@finance/core/bank-merchant";
import type { Database } from "@finance/core/types/database";
import { cashDateOf } from "@finance/core/cash-date";
import { isPurchaseInsideWallet } from "@finance/core/categories";

/**
 * How a plan of bank lines becomes rows: what an owner's ledger says (the
 * context a line is matched against) and the writes that record the plan.
 * The bank's sync (`sync.ts`) uses it, and so does a statement a person
 * brings themselves (`lib/statements/import.ts`): the same matcher, the
 * same inbox, whichever way the lines arrived. Each line says where it came
 * from (migration 074).
 */

type Client = SupabaseClient<Database>;

/** Where a plan's lines came from, written on each of them. */
export interface FeedOrigin {
  source: "bank" | "file" | "email" | "notification";
  /** The statement import they belong to, for a line brought by hand. */
  importId: string | null;
}

const BANK_ORIGIN: FeedOrigin = { source: "bank", importId: null };

/** What a bank row is matched against, for one owner. */
export interface OwnerContext {
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
export async function ownerContext(
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

  const past = history;
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

/** Rows per batched write: well inside a request PostgREST will take. */
const WRITE_CHUNK = 200;

/**
 * How many balance updates to have in flight at once when they go a row at
 * a time (before migration 067, or after a refused batch). Small on purpose:
 * this runs inside a sixty-second cron alongside a bank fetch, and firing a
 * couple of hundred concurrent requests at PostgREST to save a second is a
 * poor trade against the run finishing at all.
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
export async function refreshBalances(
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

  // One call per batch (`set_feed_balances`, migration 067); before that
  // migration, or when a batch is refused, a row at a time.
  for (let start = 0; start < rows.length; start += WRITE_CHUNK) {
    const batch = rows.slice(start, start + WRITE_CHUNK);
    const { error } = await supabase.rpc("set_feed_balances", {
      target_user: userId,
      updates: batch,
    });
    if (!error) {
      continue;
    }
    for (let one = 0; one < batch.length; one += BALANCE_CHUNK) {
      const chunk = batch.slice(one, one + BALANCE_CHUNK);
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
}

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
export async function writePlan(
  supabase: Client,
  userId: string,
  providerAccountId: string,
  plan: FeedPlan,
  positions: Map<string, number>,
  origin: FeedOrigin = BANK_ORIGIN,
): Promise<{ imported: number; pending: number; matched: number }> {
  const feedRow = (row: PlannedFeedRow) =>
    feedItemRow(userId, providerAccountId, row, positions, origin);

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
  origin: FeedOrigin,
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
    source: origin.source,
    import_id: origin.importId,
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
