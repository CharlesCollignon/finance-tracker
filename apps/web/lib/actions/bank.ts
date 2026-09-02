"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { findLedgerMatch } from "@finance/core/bank-feed";
import { getBankConnection } from "@/lib/bank/client";
import { ledgerRowsAround } from "@/lib/bank/duplicates";
import { getDuplicatePairs } from "@/lib/queries/bank";
import { syncBankFeed, type SyncOutcome } from "@/lib/bank/sync";

type ActionResult = { error?: string; success?: boolean; message?: string };

const uuid = z.string().uuid();

function revalidateFeedDependents(): void {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/budgets");
}

export async function syncBankFeedAction(): Promise<
  ActionResult & { outcome?: SyncOutcome }
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const outcome = await syncBankFeed(await createClient(), user.id);
    revalidateFeedDependents();

    const parts = [`${outcome.imported} added`];
    if (outcome.matched > 0) {
      parts.push(`${outcome.matched} already recorded`);
    }
    if (outcome.pending > 0) {
      parts.push(`${outcome.pending} to review`);
    }
    if (outcome.duplicates > 0) {
      parts.push(`${outcome.duplicates} already seen`);
    }

    return { success: true, outcome, message: parts.join(", ") };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not reach the bank.",
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
): Promise<ActionResult & { duplicateOf?: string }> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }
  if (!uuid.safeParse(itemId).success || !uuid.safeParse(categoryId).success) {
    return { error: "Invalid selection" };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("bank_feed_items")
    .select("id, occurred_on, amount, note, status, direction")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) {
    return { error: "That entry is no longer waiting" };
  }
  if (item.status !== "pending") {
    return { error: "That entry has already been dealt with" };
  }

  if (!force) {
    const existing = await ledgerRowsAround(
      supabase,
      user.id,
      item.occurred_on,
    );
    const already = findLedgerMatch(
      {
        providerId: "",
        occurredOn: item.occurred_on,
        amount: String(item.amount),
        currency: "EUR",
        direction: item.direction,
        counterparty: null,
        merchantCategoryCode: null,
        note: item.note,
      },
      existing,
    );

    if (already) {
      await supabase
        .from("bank_feed_items")
        .update({ status: "imported", transaction_id: already.transactionId })
        .eq("id", itemId)
        .eq("user_id", user.id);

      revalidateFeedDependents();
      return {
        success: true,
        duplicateOf: already.transactionId,
        message: "Already in your ledger — filed against the entry you had",
      };
    }
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      category_id: categoryId,
      occurred_on: item.occurred_on,
      amount: item.amount,
      note: item.note,
    })
    .select("id")
    .single();

  if (error || !transaction) {
    return { error: error?.message ?? "Could not add that entry" };
  }

  await supabase
    .from("bank_feed_items")
    .update({ status: "imported", transaction_id: transaction.id })
    .eq("id", itemId)
    .eq("user_id", user.id);

  revalidateFeedDependents();
  return { success: true, message: "Added" };
}

/**
 * Leave one out of the ledger for good.
 *
 * Kept rather than deleted, so the next sync does not offer it again — the
 * provider will keep returning it for as long as it is in the statement
 * window.
 */
export async function ignoreFeedItem(itemId: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }
  if (!uuid.safeParse(itemId).success) {
    return { error: "Invalid selection" };
  }

  const { error } = await (
    await createClient()
  )
    .from("bank_feed_items")
    .update({ status: "ignored" })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    return { error: error.message };
  }

  revalidateFeedDependents();
  return { success: true, message: "Left out" };
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
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const connection = getBankConnection(user.id);
  if (!connection) {
    return { success: true };
  }

  try {
    const accounts = await connection.client.getAccounts();
    // Summed as whole cents, so the provider's care with decimal strings is
    // not undone at the last step. A balance in cents is at most about 1e12,
    // which an integer double holds exactly — no BigInt needed.
    let cents = 0;
    let currency = "EUR";
    let counted = 0;

    for (const account of accounts) {
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

/**
 * Drop the copy the feed made, keeping the one that was already there.
 *
 * The feed item is not deleted but re-filed against the survivor, which is
 * what stops the next sync offering the same bank row again — the provider
 * will keep returning it for as long as it sits in the statement window.
 */
export async function dropFeedDuplicate(
  feedItemId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }
  if (!uuid.safeParse(feedItemId).success) {
    return { error: "Invalid selection" };
  }

  const pairs = await getDuplicatePairs(user.id);
  const pair = pairs.find((candidate) => candidate.feedItemId === feedItemId);
  if (!pair) {
    return { error: "That pair is no longer there" };
  }

  const supabase = await createClient();

  // Pointed at the survivor before the copy goes, so a failure between the
  // two leaves the feed item attached to something real rather than dangling.
  const { error: relinkError } = await supabase
    .from("bank_feed_items")
    .update({ transaction_id: pair.keptTransactionId })
    .eq("id", feedItemId)
    .eq("user_id", user.id);

  if (relinkError) {
    return { error: relinkError.message };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", pair.bankTransactionId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateFeedDependents();
  return { success: true, message: "Duplicate removed" };
}

/** The same, for every pair at once. */
export async function dropAllFeedDuplicates(): Promise<
  ActionResult & { removed?: number }
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const pairs = await getDuplicatePairs(user.id);
  let removed = 0;

  for (const pair of pairs) {
    const result = await dropFeedDuplicate(pair.feedItemId);
    if (result.success) {
      removed += 1;
    }
  }

  revalidateFeedDependents();
  return {
    success: true,
    removed,
    message:
      removed === 1 ? "1 duplicate removed" : `${removed} duplicates removed`,
  };
}
