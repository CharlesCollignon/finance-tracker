"use server";

import { revalidateApp } from "@/lib/revalidate-paths";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { getBankConnection } from "@/lib/bank/client";
import { getBankAccounts } from "@/lib/queries/bank-balance";
import {
  fileFeedItems,
  leaveOutFeedItems,
  reopenFeedItems,
  type BatchFeedResult,
} from "@finance/data/feed-decisions";
import * as feed from "@finance/data/feed-decisions";
import { asOwner } from "@/lib/actions/as-user";
import { autoCloseMonths } from "@/lib/bank/auto-close";
import { syncBankFeed, type SyncOutcome } from "@/lib/bank/sync";
import * as proposals from "@finance/data/recurring-proposals";
import { fileBankAccount } from "@finance/data/bank-accounts";
import {
  SAVINGS_KINDS,
  SAVINGS_KIND_SHORT_KEYS,
} from "@finance/core/savings-accounts";
import type {
  BankAccountRole,
  SavingsAccountKind,
} from "@finance/core/types/database";
import { todayIsoLocal } from "@finance/core/constants";
import { getT } from "@/lib/locale";

import type { ActionResult } from "@finance/core/action-result";
import { dbError } from "@finance/data/errors";

const uuid = z.string().uuid();

export async function syncBankFeedAction(
  backfill = false,
): Promise<ActionResult & { outcome?: SyncOutcome }> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  try {
    const supabase = await createClient();
    const outcome = await syncBankFeed(supabase, user.id, {
      backfill,
      // Somebody pressed a button, so this is attended access: PSD2 caps the
      // unattended kind at four a day and leaves this one alone.
      pull: "attended",
    });

    // Straight after the statement is filed: the balance a close measures
    // against has just arrived, and waiting for tomorrow's cron to notice
    // would leave the month sitting there asking to be closed by hand.
    const closes = await autoCloseMonths(supabase, user.id);

    revalidateApp();

    // Led with, because it is the thing the press was for. "0 added" after a
    // refused pull reads as "nothing happened"; "asked moments ago" says why.
    const t = await getT();
    const parts: string[] = [];
    if (outcome.pull && !outcome.pull.pulled && outcome.pull.why) {
      parts.push(outcome.pull.why);
    }
    parts.push(t("actions.syncAdded", { count: outcome.imported }));
    if (closes.closed.length > 0) {
      parts.push(
        t("actions.syncMonthsClosed", { count: closes.closed.length }),
      );
    }
    if (outcome.matched > 0) {
      parts.push(t("actions.syncAlreadyRecorded", { count: outcome.matched }));
    }
    if (outcome.pending > 0) {
      parts.push(t("actions.syncToReview", { count: outcome.pending }));
    }
    if (outcome.duplicates > 0) {
      parts.push(t("actions.syncAlreadySeen", { count: outcome.duplicates }));
    }
    if (outcome.needReconnect > 0) {
      parts.push(
        t("actions.syncNeedReconnect", { count: outcome.needReconnect }),
      );
    }

    return { success: true, outcome, message: parts.join(", ") };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "actions.couldNotReachBank",
    };
  }
}

/**
 * Accept one waiting row into the ledger, under the category the user picked.
 *
 * The same duplicate check the sync does, because pressing Add is no less
 * likely to double-record a movement than a sync is: a card fee written by a
 * recurring template days earlier is still there whichever path the bank's
 * copy arrives by. `force` is how the user says they know better — two
 * identical coffees on the same day are two coffees.
 */
export async function importFeedItem(
  itemId: string,
  categoryId: string,
  force = false,
): Promise<ActionResult<{ duplicateOf?: string }>> {
  return asOwner((db, userId) =>
    feed.importFeedItem(db, userId, itemId, categoryId, force),
  );
}

/**
 * Leave one out of the ledger for good.
 *
 * Kept rather than deleted, so the next sync does not offer it again — the
 * provider will keep returning it for as long as it is in the statement
 * window.
 */
export async function ignoreFeedItem(itemId: string): Promise<ActionResult> {
  return asOwner((db, userId) => feed.ignoreFeedItem(db, userId, itemId));
}

/**
 * File a whole group of waiting rows under one category, with one
 * revalidation at the end rather than one per row. The rows are decided in
 * `fileFeedItems`, which the phone's route shares.
 */
export async function importFeedItems(
  itemIds: string[],
  categoryId: string,
): Promise<BatchFeedResult> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const result = await fileFeedItems(
    await createClient(),
    user.id,
    itemIds,
    categoryId,
  );
  if (!result.error) {
    revalidateApp();
  }
  return result;
}

/** Leave a whole group out, in one write. See `ignoreFeedItem`. */
export async function ignoreFeedItems(
  itemIds: string[],
): Promise<BatchFeedResult> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const result = await leaveOutFeedItems(
    await createClient(),
    user.id,
    itemIds,
  );
  if (!result.error) {
    revalidateApp();
  }
  return result;
}

/**
 * Take back a whole group's decision: `undoFeedDecision` for each row, with
 * one revalidation. What the undo toast after "File all" calls.
 */
export async function undoFeedDecisions(
  itemIds: string[],
): Promise<ActionResult<{ reopened: number }>> {
  return asOwner((db, userId) => reopenFeedItems(db, userId, itemIds));
}

/**
 * Move an already-filed bank row to a different category.
 *
 * Edits the ledger row it became rather than unpicking and refiling it, so
 * the transaction keeps its id — anything pointing at it, a tag or a month
 * already closed against it, stays pointing at the same thing.
 */
export async function recategoriseFeedItem(
  itemId: string,
  categoryId: string,
): Promise<ActionResult> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!uuid.safeParse(itemId).success || !uuid.safeParse(categoryId).success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("bank_feed_items")
    .select("transaction_id, status")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item?.transaction_id) {
    return { error: "actions.entryNotInLedger" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", item.transaction_id)
    .eq("user_id", user.id);

  if (error) {
    return { error: dbError(error) };
  }

  revalidateApp();
  return { success: true, message: "actions.moved" };
}

/**
 * Take back a decision and put the row back in the inbox.
 *
 * For something this row added, the ledger row it created goes with it:
 * leaving the transaction behind while the bank row returns to the inbox is
 * how the same expense gets recorded twice. For something left out, there is
 * nothing to remove and it simply comes back.
 *
 * But not every decided row wrote a transaction. A row can be filed *against*
 * one that was already there — the sync does it when a recurring charge looks
 * to be the same movement, and pressing Add does it when the duplicate check
 * finds the amount already recorded, which is the "Already in your ledger"
 * message. This deleted whatever `transaction_id` pointed at either way, so
 * undoing one of those took out a transaction the user had entered themselves
 * and the bank row went back to pending — the ledger quietly a row short,
 * with nothing to say it had happened. `reopenSwallowedFeedItems` knew this
 * about the sync's matches and nulled them out; undo did not.
 */
export async function undoFeedDecision(itemId: string): Promise<ActionResult> {
  return asOwner((db, userId) => feed.undoFeedDecision(db, userId, itemId));
}

/**
 * The balance the bank reports right now, for pre-filling a month close.
 *
 * Deliberately not stored: a balance is only meaningful at the instant it is
 * read, and a stale one pre-filled into a close would be worse than an empty
 * field the user has to go and look up.
 */
export async function getBankBalanceSuggestion(): Promise<
  ActionResult & { total?: string; currency?: string; accounts?: number }
> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const connection = await getBankConnection(user.id);
  if (!connection) {
    return { success: true };
  }

  try {
    // The current accounts only: a Livret's balance is savings, and an
    // account the user does not follow is not their spending money.
    const [accounts, known] = await Promise.all([
      connection.client.getAccounts(),
      getBankAccounts(user.id),
    ]);
    const spending = new Set(
      known
        .filter((account) => account.role === "spending")
        .map((account) => account.provider_account_id),
    );
    // Summed as whole cents, so the provider's care with decimal strings is
    // not undone at the last step. A balance in cents is at most about 1e12,
    // which an integer double holds exactly — no BigInt needed.
    let cents = 0;
    let currency = "EUR";
    let counted = 0;

    for (const account of accounts) {
      // A lapsed consent reports zero, and a zero folded into a total reads
      // as money that is not there.
      if (account.needsReconnect || !spending.has(account.id)) {
        continue;
      }
      const booked =
        account.balances.find((b) => b.type === "ITBD") ?? account.balances[0];
      if (!booked) {
        continue;
      }
      const match = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(
        booked.amount.trim(),
      );
      if (!match) {
        continue;
      }
      const [, sign, whole, frac = "0"] = match;
      const value = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
      cents += sign === "-" ? -value : value;
      currency = booked.currency;
      counted += 1;
    }

    if (counted === 0) {
      return { success: true };
    }

    const negative = cents < 0;
    const abs = Math.abs(cents);
    const total = `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;

    return { success: true, total, currency, accounts: counted };
  } catch {
    // A bank that cannot be reached should not stop a month being closed.
    return { success: true };
  }
}

/** Put back every bank row an earlier sync merged away on its own. */
export async function reopenSwallowedFeedItems(): Promise<
  ActionResult & { reopened?: number }
> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const result = await feed.reopenSwallowedFeedItems(
    await createClient(),
    user.id,
  );
  if (!result.success) {
    return { error: result.error };
  }

  revalidateApp();
  const t = await getT();
  return {
    success: true,
    reopened: result.reopened,
    message: t("actions.entriesBackInInbox", { count: result.reopened }),
  };
}

/**
 * Turn one proposal into a real recurring template.
 *
 * Only ever from an explicit press. A template nobody agreed to joins every
 * projection, every runway figure and every month-end view, and is invisible
 * once it is there.
 */
export async function acceptRecurringProposal(
  key: string,
): Promise<ActionResult> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const result = await proposals.acceptRecurringProposal(
    await createClient(),
    user.id,
    key,
    todayIsoLocal(),
  );
  if (result.error) {
    return { error: result.error };
  }

  revalidateApp();
  const t = await getT();
  return {
    success: true,
    message: t("actions.proposalAdded", { name: result.name ?? "" }),
  };
}

/** Refuse one suggestion for good. */
export async function dismissRecurringProposal(
  key: string,
): Promise<ActionResult> {
  const owner = await getOwner();
  const user = owner ? { id: owner.ownerId } : null;
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const result = await proposals.dismissRecurringProposal(
    await createClient(),
    user.id,
    key,
  );
  if (result.success) {
    revalidateApp();
  }
  return result;
}

const filingSchema = z
  .array(
    z.object({
      accountId: z.string().min(1).max(200),
      role: z.enum(["spending", "savings", "ignored"]),
      savingsKind: z
        .enum(SAVINGS_KINDS as [SavingsAccountKind, ...SavingsAccountKind[]])
        .nullish(),
    }),
  )
  .min(1)
  .max(50);

/**
 * Say what bank accounts are — one, from its row on the Bank page, or every
 * new one at once, from « C'est bon ». See `fileBankAccount`.
 *
 * Nothing is counted until it is said. A connection can expose accounts
 * nobody spends from, and one whose consent has lapsed reads as an empty
 * account rather than an unreadable one — so counting by default is how a
 * month close ends up explaining a phantom hole with invented spending.
 *
 * What comes back names the Livrets that already read another account, for
 * the page to say so: the account was filed as Épargne all the same.
 */
export async function fileBankAccounts(
  filings: {
    accountId: string;
    role: BankAccountRole;
    savingsKind?: SavingsAccountKind | null;
  }[],
): Promise<ActionResult<{ taken: string[] }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = filingSchema.safeParse(filings);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const t = await getT();
  const supabase = await createClient();
  const taken: string[] = [];
  for (const filing of parsed.data) {
    const kind = filing.savingsKind ?? null;
    const livretName = kind ? t(SAVINGS_KIND_SHORT_KEYS[kind]) : undefined;
    const result = await fileBankAccount(supabase, user.id, {
      accountId: filing.accountId,
      role: filing.role,
      savingsKind: kind,
      livretName,
    });
    if (result.error !== undefined) {
      revalidateApp();
      return { error: result.error };
    }
    if (result.livret === "taken" && livretName) {
      taken.push(livretName);
    }
  }

  // A current account ticked can make a month closable that was not before.
  try {
    await autoCloseMonths(supabase, user.id);
  } catch {
    // A close that cannot be worked out is not a reason to refuse the answer.
  }

  revalidateApp();
  return { success: true, taken };
}
