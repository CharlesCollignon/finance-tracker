import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@finance/core/action-result";
import { ownTransferIbans } from "@finance/core/bank-accounts";
import { intradayIndexes } from "@finance/core/bank-balance";
import { planFeed, type BankTransaction } from "@finance/core/bank-feed";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";
import type { Database } from "@finance/core/types/database";
import type {
  StatementImportInput,
  StatementOutcome,
} from "@finance/core/validations/statements";
import { markTransactionsDeleted } from "@finance/data/deletions";
import {
  ownerContext,
  refreshBalances,
  writePlan,
} from "@/lib/bank/feed-write";

/**
 * A statement a person brought, through the bank feed's own pipeline: the
 * same matcher decides each line — a known charge filed on its own, a line
 * the ledger already holds paired with it, the rest « À vérifier » — and
 * the same writes record it, each line marked as brought (`source: 'file'`)
 * and tied to its import, so that the import can be said and undone whole.
 *
 * The device reads the file (`@finance/core/statement`); this decides and
 * writes, as the person — row level security applies as for every write —
 * and for whoever owns the money on screen: the person, or their shared
 * space under « Commun ».
 */

type Client = SupabaseClient<Database>;

/** How long an import can be undone. */
export const UNDO_DAYS = 30;

interface Who {
  /** The person importing. */
  userId: string;
  /** Whose money: the person's, or their space's under « Commun ». */
  ownerId: string;
}

/** The account the lines are on, made now if it is new. */
async function accountFor(
  db: Client,
  who: Who,
  input: StatementImportInput,
  write: boolean,
): Promise<
  | { providerAccountId: string; role: string | null; isNew: boolean }
  | { error: string }
> {
  if (input.account.kind === "existing") {
    const { data } = await db
      .from("bank_accounts")
      .select("provider_account_id, role")
      .eq("user_id", who.userId)
      .eq("provider_account_id", input.account.providerAccountId)
      .eq("source", "file")
      .maybeSingle();
    return data
      ? {
          providerAccountId: data.provider_account_id,
          role: data.role,
          isNew: false,
        }
      : { error: "errors.notFound" };
  }

  const fresh = input.account;
  // A key already known is that account, whatever the person typed.
  if (fresh.key) {
    const { data } = await db
      .from("bank_accounts")
      .select("provider_account_id, role")
      .eq("user_id", who.userId)
      .eq("statement_key", fresh.key)
      .maybeSingle();
    if (data) {
      return {
        providerAccountId: data.provider_account_id,
        role: data.role,
        isNew: false,
      };
    }
  }

  const providerAccountId = `statement:${fresh.key ?? crypto.randomUUID()}`;
  const joint = who.ownerId !== who.userId;
  const role = joint && fresh.role === "spending" ? "joint" : fresh.role;
  if (write) {
    const { error } = await db.from("bank_accounts").insert({
      user_id: who.userId,
      provider_account_id: providerAccountId,
      label: fresh.label,
      bank_name: fresh.bank,
      currency: fresh.currency,
      source: "file",
      statement_key: fresh.key,
      role,
      space_id: role === "joint" ? who.ownerId : null,
    });
    if (error) {
      return { error: "errors.couldNotSave" };
    }
  }
  return { providerAccountId, role, isNew: true };
}

/** The IBANs of the owner's current accounts known from their files. */
async function ownIbansOf(db: Client, who: Who): Promise<Set<string>> {
  const { data } = await db
    .from("bank_accounts")
    .select("statement_key, role")
    .eq("user_id", who.userId)
    .eq("source", "file");
  return ownTransferIbans(
    (data ?? []).map((row) => ({
      iban: /^[A-Z]{2}\d{2}/.test(row.statement_key ?? "")
        ? row.statement_key
        : null,
      role: row.role,
    })),
  );
}

/**
 * Decide the statement's lines, and write them when `write` is set: what
 * the import's summary shows before « Importer », and what « Importer »
 * then does — the same decisions, from the same ledger.
 */
export async function planStatement(
  db: Client,
  who: Who,
  input: StatementImportInput,
  { write }: { write: boolean },
): Promise<ActionResult<StatementOutcome & { importId: string | null }>> {
  const account = await accountFor(db, who, input, write);
  if ("error" in account) {
    return { error: account.error };
  }

  // A line's id is the account's and the file's: the same coffee on two
  // accounts is two coffees.
  const lines: BankTransaction[] = input.lines.map((line) => ({
    ...line,
    id: `${account.providerAccountId}:${line.id}`,
    balanceAfterTransaction: line.balanceAfterTransaction ?? null,
  }));
  const kept = account.role === "spending" || account.role === "joint";

  if (input.closing && write) {
    await db
      .from("bank_accounts")
      .update({
        reported_balance: Number(input.closing.amount),
        reported_on: input.closing.date ?? input.to,
      })
      .eq("user_id", who.userId)
      .eq("provider_account_id", account.providerAccountId);
  }

  if (!kept) {
    // An Épargne account gives its balance, and a « Ne pas suivre » one
    // nothing: their movements are the other side of what the current
    // account already says.
    return {
      success: true,
      importId: null,
      total: lines.length,
      known: 0,
      matched: 0,
      filed: 0,
      waiting: 0,
      likelyTyped: 0,
      left: lines.length,
      kept: false,
    };
  }

  const [context, ownIbans] = await Promise.all([
    ownerContext(db, who.ownerId),
    ownIbansOf(db, who),
  ]);
  const plan = planFeed(lines, {
    locale: DEFAULT_LOCALE,
    merchants: context.merchants,
    bankMerchants: context.bankMerchants,
    existing: context.existing,
    categoryIdsByName: context.categoryIdsByName,
    seenProviderIds: context.seenProviderIds,
    ownIbans,
  });

  const likelyTyped = plan.review.filter(
    (row) =>
      row.decision.kind === "review" &&
      row.decision.why === "possible-duplicate",
  ).length;

  if (!write) {
    return {
      success: true,
      importId: null,
      total: lines.length,
      known: plan.duplicates,
      matched: plan.matched.length,
      filed: plan.automatic.length,
      waiting: plan.review.length,
      likelyTyped,
      left: plan.discarded,
      kept: true,
    };
  }

  const { data: imported, error } = await db
    .from("statement_imports")
    .insert({
      user_id: who.ownerId,
      provider_account_id: account.providerAccountId,
      source: input.source,
      format: input.format,
      bank: input.bank,
      file_name: input.fileName,
      period_from: input.from,
      period_to: input.to,
      lines_total: lines.length,
    })
    .select("id")
    .single();
  if (error || !imported) {
    return { error: "errors.couldNotSave" };
  }

  const positions = intradayIndexes(
    lines.map((tx) => ({
      id: tx.id,
      date: tx.bookingDate ?? tx.valueDate ?? tx.transactionDate,
    })),
  );
  await refreshBalances(
    db,
    who.ownerId,
    lines,
    context.seenProviderIds,
    positions,
  );
  const written = await writePlan(
    db,
    who.ownerId,
    account.providerAccountId,
    plan,
    positions,
    { source: "file", importId: imported.id },
  );

  const outcome: StatementOutcome = {
    total: lines.length,
    known: plan.duplicates,
    matched: written.matched,
    filed: written.imported,
    waiting: written.pending,
    likelyTyped: Math.min(likelyTyped, written.pending),
    left: plan.discarded,
    kept: true,
  };
  await db
    .from("statement_imports")
    .update({
      lines_new: outcome.matched + outcome.filed + outcome.waiting,
      lines_known: outcome.known,
      lines_filed: outcome.matched + outcome.filed,
      lines_waiting: outcome.waiting,
    })
    .eq("id", imported.id);

  return { success: true, importId: imported.id, ...outcome };
}

/**
 * Take an import back, whole: the transactions it wrote — filed on their
 * own, or from « À vérifier » since — and its lines go; a row it was only
 * paired with (`match:`) was there before it, and stays. Within
 * `UNDO_DAYS`.
 */
export async function undoStatement(
  db: Client,
  ownerId: string,
  importId: string,
): Promise<ActionResult<{ removed: number }>> {
  const { data: imported } = await db
    .from("statement_imports")
    .select("id, created_at, undone_at")
    .eq("id", importId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!imported || imported.undone_at) {
    return { error: "errors.notFound" };
  }
  const age = Date.now() - new Date(imported.created_at).getTime();
  if (age > UNDO_DAYS * 86_400_000) {
    return { error: "statements.undoTooLate" };
  }

  const { data: items } = await db
    .from("bank_feed_items")
    .select("id, transaction_id, decided_by")
    .eq("user_id", ownerId)
    .eq("import_id", importId);
  const written = (items ?? [])
    .filter(
      (item) =>
        item.transaction_id && !(item.decided_by ?? "").startsWith("match:"),
    )
    .map((item) => item.transaction_id as string);

  // Marked deleted as the Journal deletes (migration 036), so whatever a
  // transaction was tied to since is let go of properly; the sweep removes
  // them for good after a month.
  let removed = 0;
  for (let start = 0; start < written.length; start += 200) {
    const slice = written.slice(start, start + 200);
    const marked = await markTransactionsDeleted(db, ownerId, slice);
    if (marked === "unsupported") {
      const { count } = await db
        .from("transactions")
        .delete({ count: "exact" })
        .eq("user_id", ownerId)
        .in("id", slice);
      removed += count ?? 0;
    } else if (!("error" in marked)) {
      removed += slice.length;
    }
  }
  const ids = (items ?? []).map((item) => item.id);
  for (let start = 0; start < ids.length; start += 200) {
    await db
      .from("bank_feed_items")
      .delete()
      .eq("user_id", ownerId)
      .in("id", ids.slice(start, start + 200));
  }
  await db
    .from("statement_imports")
    .update({ undone_at: new Date().toISOString() })
    .eq("id", importId);
  return { success: true, removed };
}
