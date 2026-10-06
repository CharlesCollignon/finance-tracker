import { createClient } from "@/lib/supabase/server";
import {
  hasBankFeed as bankFeeds,
  walletCategoriesTheBankDebits,
} from "@finance/data/bank-feed";
import * as inbox from "@finance/data/bank-inbox";
import type { BankMerchantIndex } from "@finance/core/bank-merchant";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import type { Locale } from "@finance/core/i18n/locale";

/**
 * The review inbox's reads — `@finance/data/bank-inbox`, shared with the
 * phone — with this request's client.
 */

export type { DecidedFeedRow, PendingFeedRow } from "@finance/data/bank-inbox";

export async function getPendingFeedItems(
  userId: string,
  locale: Locale,
): Promise<inbox.PendingFeedRow[]> {
  return inbox.getPendingFeedItems(await createClient(), userId, locale);
}

/** The history a review group takes its suggested category from. */
export async function getBankMerchantIndex(
  userId: string,
): Promise<BankMerchantIndex> {
  return inbox.getBankMerchantIndex(await createClient(), userId);
}

/** What was decided recently, so a decision can be taken back. */
export async function getDecidedFeedItems(
  userId: string,
  limit?: number,
): Promise<inbox.DecidedFeedRow[]> {
  return inbox.getDecidedFeedItems(await createClient(), userId, limit);
}

/** How many bank rows exist at all, to tell a first sync from a routine one. */
export async function countFeedItems(userId: string): Promise<number> {
  return inbox.countFeedItems(await createClient(), userId);
}

/** How many bank rows are waiting for a category, for the Ledger's badge. */
export async function countPendingFeedItems(userId: string): Promise<number> {
  return inbox.countPendingFeedItems(await createClient(), userId);
}

/** How many bank rows an earlier sync merged away without asking. */
export async function countSwallowedFeedItems(userId: string): Promise<number> {
  return inbox.countSwallowedFeedItems(await createClient(), userId);
}

/**
 * Whether this user's ledger is fed by a bank.
 *
 * The one predicate the whole model turns on. With a feed the bank is the
 * record of what happened and recurring templates only forecast what is
 * coming, so nothing applies them and there is no second writer to collide
 * with. Without one, templates are the only way anything gets written, and
 * each month fills itself from them.
 */
export async function hasBankFeed(userId: string): Promise<boolean> {
  return bankFeeds(await createClient(), userId);
}

/**
 * The categories of the wallets the bank debits from the account (Bitstack),
 * as a list a client component can be handed.
 */
export async function getDebitedWalletCategories(
  userId: string,
): Promise<string[]> {
  return [
    ...(await walletCategoriesTheBankDebits(await createClient(), userId)),
  ];
}

/** Standing charges the statement implies but no template covers. */
export async function getRecurringProposals(
  userId: string,
  today: string,
): Promise<RecurringProposal[]> {
  return inbox.getRecurringProposals(await createClient(), userId, today);
}
