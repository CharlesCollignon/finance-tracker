import {
  hasBankFeed as bankFeeds,
  walletCategoriesTheBankDebits,
} from "@finance/data/bank-feed";
import * as fulfilment from "@finance/data/fulfilment";
import * as closes from "@finance/data/month-close";
import { isMissingSchema } from "@finance/data/schema";
import * as categories from "@finance/data/categories";
import * as history from "@finance/data/history";
import * as positions from "@finance/data/positions";
import * as monthLedger from "@finance/data/month-ledger";
import * as templates from "@finance/data/templates";
import * as inbox from "@finance/data/bank-inbox";
import type { PendingFeedRow } from "@finance/data/bank-inbox";
import * as bankBalance from "@finance/data/bank-balance";
import * as preferences from "@finance/data/preferences";
import * as aiConnection from "@finance/data/ai-connection";
import {
  getCurrentMonth,
  getMonthBounds,
  shiftIsoDate,
  type BudgetViewMode,
} from "@finance/core/constants";

import type { Locale } from "@finance/core/i18n/locale";
import type { BankMerchantIndex } from "@finance/core/bank-merchant";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import {
  type BankForecast,
  type FulfilmentProposal,
} from "@finance/core/recurring-fulfilment";
import {
  type MonthCloseResult,
  type RecordedCashFlows,
} from "@finance/core/month-close";
import {
  buildInvestmentPortfolio,
  portfolioQuoteSymbols,
} from "@finance/core/investment-positions";
import { todayIsoLocal } from "@finance/core/constants";
import {
  fetchMonthlyClosesBySymbolInEur,
  fetchQuotesInEur,
} from "@finance/core/market/fx";
import {
  buildMerchantIndex,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type { CashBalance } from "@finance/core/bank-balance";
import type {
  BankAccount,
  BankFeedItem,
  Category,
  MonthClose,
  MonthlySummary,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
  WalletPlan,
} from "@finance/core/types/database";
import type {
  InvestmentPortfolioSummary,
  InvestmentPositionRow,
} from "@finance/core/investment-positions";

import { supabase } from "@/lib/supabase";
import { cashDateOf, movedBetween } from "@finance/core/cash-date";

export type { PendingFeedRow } from "@finance/data/bank-inbox";

export function getCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Category[]> {
  return categories.getCategories(supabase, userId, options);
}

export function getTransactions(
  userId: string,
  year: number,
  month: number,
): Promise<TransactionWithCategory[]> {
  return monthLedger.getMonthTransactions(supabase, userId, year, month);
}

export async function getRecurringTemplates(
  userId: string,
): Promise<RecurringTemplateWithCategory[]> {
  return templates.getRecurringTemplates(supabase, userId);
}

/**
 * The days each charge has already been recorded on this month, today
 * included — what "apply this change to this month too" would reach.
 *
 * Only this month: past months are never offered, and the months ahead hold
 * nothing to rewrite because their occurrences are planned, not stored.
 */
export async function getRecordedChargeDates(
  userId: string,
): Promise<Map<string, string[]>> {
  const { year, month } = getCurrentMonth();
  const { start } = getMonthBounds(year, month);
  const { data, error } = await supabase
    .from("transactions")
    .select("recurring_template_id, occurred_on")
    .eq("user_id", userId)
    .not("recurring_template_id", "is", null)
    .gte("occurred_on", start)
    .lte("occurred_on", todayIsoLocal())
    .order("occurred_on", { ascending: true });

  if (error) {
    throw error;
  }

  const byTemplate = new Map<string, string[]>();
  for (const row of data ?? []) {
    const templateId = row.recurring_template_id as string | null;
    if (!templateId) {
      continue;
    }
    const dates = byTemplate.get(templateId) ?? [];
    dates.push(row.occurred_on as string);
    byTemplate.set(templateId, dates);
  }
  return byTemplate;
}

export interface SkippedOccurrence {
  templateId: string;
  occurredOn: string;
  name: string;
}

/** Skipped occurrences for a month, so they can be surfaced and restored. */
export async function getSkippedOccurrences(
  userId: string,
  year: number,
  month: number,
): Promise<SkippedOccurrence[]> {
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await supabase
    .from("recurring_skips")
    .select("template_id, occurred_on, recurring_templates(categories(name))")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    templateId: row.template_id,
    occurredOn: row.occurred_on,
    // Empty rather than an English word; the screen names it.
    name: row.recurring_templates?.categories?.name ?? "",
  }));
}

export function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode = "current",
): Promise<MonthlySummary> {
  return monthLedger.getMonthlySummary(supabase, userId, year, month, view);
}

/** Every investment row ever, oldest first — paged past the row cap. */
export function getInvestmentTransactions(
  userId: string,
): Promise<TransactionWithCategory[]> {
  return history.getInvestmentTransactions(supabase, userId);
}

export function getInvestmentPositions(
  userId: string,
): Promise<InvestmentPositionRow[]> {
  return positions.getInvestmentPositions(supabase, userId);
}

export async function getWalletPortfolio(
  userId: string,
  locale: Locale,
  options: { includeHistory?: boolean } = {},
): Promise<InvestmentPortfolioSummary> {
  // History is off by default: mobile screens show totals, not charts.
  const includeHistory = options.includeHistory === true;
  const [categories, transactions, positionRows, recurringTemplates] =
    await Promise.all([
      getCategories(userId, { includeArchived: true }),
      getInvestmentTransactions(userId),
      getInvestmentPositions(userId),
      getRecurringTemplates(userId),
    ]);

  const symbolList = portfolioQuoteSymbols(positionRows, recurringTemplates);
  const [liveQuotes, historicalQuotes] = await Promise.all([
    fetchQuotesInEur(symbolList),
    includeHistory
      ? fetchMonthlyClosesBySymbolInEur(symbolList)
      : Promise.resolve({} as Record<string, Record<string, number>>),
  ]);

  return buildInvestmentPortfolio(
    categories,
    transactions,
    positionRows,
    recurringTemplates,
    liveQuotes,
    locale,
    todayIsoLocal(),
    historicalQuotes,
  );
}

/**
 * How far back the app looks to learn habits — far enough that a monthly
 * merchant is seen several times, short enough that a year-old choice does not
 * outvote how the user files things now.
 */
const QUICK_ENTRY_HISTORY_LIMIT = 400;

/** Chips offered before the user searches. Four fits one row on a phone. */
const RECENT_CATEGORY_COUNT = 4;

export interface QuickEntryContext {
  categories: Category[];
  /** Most recently used category ids, newest first. */
  recentCategoryIds: string[];
  merchants: MerchantRule[];
}

/** Everything the quick-add sheet needs, in one round trip. */
export async function getQuickEntryContext(
  userId: string,
): Promise<QuickEntryContext> {
  const [categories, history] = await Promise.all([
    getCategories(userId),
    supabase
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(QUICK_ENTRY_HISTORY_LIMIT),
  ]);

  if (history.error) {
    throw history.error;
  }

  const rows = (history.data ?? []) as TransactionWithCategory[];

  const recentCategoryIds: string[] = [];
  for (const tx of rows) {
    if (!recentCategoryIds.includes(tx.category_id)) {
      recentCategoryIds.push(tx.category_id);
    }
    if (recentCategoryIds.length >= RECENT_CATEGORY_COUNT) {
      break;
    }
  }

  return {
    categories,
    recentCategoryIds,
    merchants: [...buildMerchantIndex(rows).values()],
  };
}

/**
 * The user's plan for each wallet: target weights and opening dates.
 *
 * Rows are created lazily, so a user who has never set a target simply has
 * none — the right default, since drift against an unstated target is not
 * worth showing.
 */
export function getWalletPlans(userId: string): Promise<WalletPlan[]> {
  return positions.getWalletPlans(supabase, userId);
}

/**
 * The ledger rows overlapping an import's date range, for the duplicate check.
 * Only the three fields that identify a line are fetched.
 */
export async function getExistingKeysForRange(
  userId: string,
  from: string,
  to: string,
): Promise<{ occurredOn: string; amount: number; note: string | null }[]> {
  // By the day the money moved, as a statement dates it; a row counted for
  // next month sits up to a month after that day, hence the wider read.
  // `*` rather than naming `cash_on`, which does not exist before 045.
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("occurred_on", from)
    .lte("occurred_on", shiftIsoDate(to, 31));

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => movedBetween(row, from, to))
    .map((row) => ({
      occurredOn: cashDateOf(row),
      amount: Number(row.amount),
      note: (row.note as string | null) ?? null,
    }));
}

/** Everything logged as savings, net of withdrawals — paged past the row cap. */
export function getSavingsReserve(userId: string): Promise<number> {
  return history.getSavingsReserve(supabase, userId);
}

/* ------------------------------------------------------------ closing a month */

/**
 * The month close's reads — `@finance/data/month-close`, the same as the
 * web's, with the phone's client. Paged past the server's row cap now, as
 * the web's already were: a year of closes is a year of rows.
 */

export {
  DEFAULT_CLOSE_DAY,
  type ClosedMonthRow,
  type MonthCloseOverview,
} from "@finance/data/month-close";

export function getMonthCloseSettings(
  userId: string,
): Promise<closes.CloseSettings> {
  return closes.getMonthCloseSettings(supabase, userId);
}

export function getMonthCloses(userId: string): Promise<MonthClose[]> {
  return closes.getMonthCloses(supabase, userId);
}

export function getMonthCloseOverview(
  userId: string,
  today: string,
  locale: Locale,
): Promise<closes.MonthCloseOverview> {
  return closes.getMonthCloseOverview(supabase, userId, today, locale);
}

export function previewMonthClose(
  userId: string,
  year: number,
  month: number,
  closingBalance: number,
): Promise<MonthCloseResult> {
  return closes.previewMonthClose(
    supabase,
    userId,
    year,
    month,
    closingBalance,
  );
}

export function getRecordedCashFlows(
  userId: string,
  year: number,
  month: number,
): Promise<RecordedCashFlows> {
  return closes.getRecordedCashFlows(supabase, userId, year, month);
}

/* --------------------------------------------------------- the bank feed */

/** Every account the connection has ever shown, ticked or not. */
export function getBankAccounts(userId: string): Promise<BankAccount[]> {
  return bankBalance.getBankAccounts(supabase, userId);
}

/** What the counted accounts held at the end of a given day. */
export function readCashBalance(
  userId: string,
  date: string,
): Promise<CashBalance | null> {
  return bankBalance.readCashBalance(supabase, userId, date);
}

export interface BankMovement {
  id: string;
  occurredOn: string;
  amount: number;
  direction: "in" | "out";
  /** The merchant, or the payer for money in. Falls back to the bank's note. */
  label: string;
  categoryName: string | null;
  pending: boolean;
  ignored: boolean;
}

/**
 * The last movements the account actually saw, whatever became of them.
 *
 * Pending rows included on purpose: the card payment from an hour ago that is
 * still waiting for a category is precisely the evidence that a refresh
 * worked, and filtering to what has been filed would hide it.
 */
export async function getRecentBankMovements(
  userId: string,
  limit = 6,
): Promise<BankMovement[]> {
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*, transactions(categories(name))")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    .order("intraday_index", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }

  type Joined = BankFeedItem & {
    transactions: { categories: { name: string } | null } | null;
  };

  return ((data ?? []) as Joined[]).map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    amount: Number(row.amount),
    direction: row.direction,
    label: row.counterparty ?? row.note,
    categoryName: row.transactions?.categories?.name ?? null,
    pending: row.status === "pending",
    ignored: row.status === "ignored",
  }));
}

/* ------------------------------------------ charges the bank already paid */

/**
 * Which recurring charges the bank looks to have already delivered — the
 * reads are `@finance/data/fulfilment`, the same as the web's, with the
 * phone's client.
 */

export type { FulfilmentReport } from "@finance/data/fulfilment";

export function getFulfilledKeys(userId: string): Promise<Set<string>> {
  return fulfilment.getFulfilledKeys(supabase, userId);
}

export function getConfirmedTransactionIds(
  userId: string,
): Promise<Set<string>> {
  return fulfilment.getConfirmedTransactionIds(supabase, userId);
}

export function getFulfilmentReport(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<fulfilment.FulfilmentReport> {
  return fulfilment.getFulfilmentReport(
    supabase,
    userId,
    templates,
    categories,
    year,
    month,
  );
}

export function getFulfilmentProposals(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<FulfilmentProposal[]> {
  return fulfilment.getFulfilmentProposals(
    supabase,
    userId,
    templates,
    categories,
    year,
    month,
  );
}

/**
 * What the bank has and has not brought of the charges around today, or
 * null for a ledger no bank feeds — where the day alone decides, because a
 * charge is written on it.
 */
export async function getBankForecast(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  bankFed: boolean,
  today: string,
): Promise<BankForecast | null> {
  return bankFed
    ? fulfilment.getBankForecast(supabase, userId, templates, today)
    : null;
}

/** How many are waiting, for the Journal's badge. */
export async function countFulfilmentProposals(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const [templates, categories] = await Promise.all([
    getRecurringTemplates(userId),
    getCategories(userId),
  ]);
  return fulfilment.countFulfilmentProposals(
    supabase,
    userId,
    templates,
    categories,
    year,
    month,
  );
}

/* ------------------------------------------------------ the review inbox */




export function getPendingFeedItems(
  userId: string,
  locale: Locale,
): Promise<PendingFeedRow[]> {
  return inbox.getPendingFeedItems(supabase, userId, locale);
}

/** The history a review group takes its suggested category from. */
export function getBankMerchantIndex(
  userId: string,
): Promise<BankMerchantIndex> {
  return inbox.getBankMerchantIndex(supabase, userId);
}


/** How many bank rows are still waiting for a category. */
export function countPendingFeedItems(userId: string): Promise<number> {
  return inbox.countPendingFeedItems(supabase, userId);
}

/**
 * Whether this user's ledger is fed by a bank — `@finance/data/bank-feed`,
 * with the phone's client.
 */
export function hasBankFeed(userId: string): Promise<boolean> {
  return bankFeeds(supabase, userId);
}

/**
 * The categories of the wallets the bank debits from the account
 * (Bitstack) — `@finance/data/bank-feed`, with the phone's client.
 */
export function getDebitedWalletCategories(
  userId: string,
): Promise<Set<string>> {
  return walletCategoriesTheBankDebits(supabase, userId);
}

/** How many bank rows an earlier sync merged away without asking. */
export function countSwallowedFeedItems(userId: string): Promise<number> {
  return inbox.countSwallowedFeedItems(supabase, userId);
}

/** Standing charges the statement implies but no template covers. */
export function getRecurringProposals(
  userId: string,
  today: string,
): Promise<RecurringProposal[]> {
  return inbox.getRecurringProposals(supabase, userId, today);
}

/** The connected AI account's model, or null with none connected. */
export function getAiConnection(userId: string) {
  return aiConnection.getAiConnection(supabase, userId);
}

/** Which kinds of notification the account has turned off. */
export function getNotificationSettings(
  userId: string,
): Promise<preferences.NotificationSettings> {
  return preferences.getNotificationSettings(supabase, userId);
}
