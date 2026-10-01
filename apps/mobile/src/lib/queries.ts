import { hasBankFeed as bankFeeds } from "@finance/data/bank-feed";
import * as fulfilment from "@finance/data/fulfilment";
import * as closes from "@finance/data/month-close";
import { isMissingSchema } from "@finance/data/schema";
import * as templates from "@finance/data/templates";
import {
  getCurrentMonth,
  getMonthBounds,
  shiftIsoDate,
  type BudgetViewMode,
} from "@finance/core/constants";

import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  bankMerchantKey,
  buildBankMerchantIndex,
  type BankMerchantIndex,
} from "@finance/core/bank-merchant";
import {
  detectRecurring,
  filterLiveProposals,
  type RecurringProposal,
} from "@finance/core/recurring-detection";
import { type FulfilmentProposal } from "@finance/core/recurring-fulfilment";
import { buildMonthlySummary } from "@finance/core/monthly-summary";
import {
  type MonthCloseResult,
  type RecordedCashFlows,
} from "@finance/core/month-close";
import { buildInvestmentPortfolio } from "@finance/core/investment-positions";
import { todayIsoLocal } from "@finance/core/constants";
import {
  fetchInstrumentQuoteInEur,
  fetchMonthlyClosesInEur,
} from "@finance/core/market/fx";
import {
  buildMerchantIndex,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import {
  cashBalanceAsOf,
  type AccountRows,
  type CashBalance,
} from "@finance/core/bank-balance";
import {
  describeReviewReason,
  type ReviewReason,
} from "@finance/core/bank-feed";
import type {
  BankAccount,
  BankFeedItem,
  Category,
  CategoryType,
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

export async function getCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("type")
    .order("name");

  if (!options.includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getTransactions(
  userId: string,
  year: number,
  month: number,
): Promise<TransactionWithCategory[]> {
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false });

  if (error) {
    throw error;
  }
  return (data ?? []) as TransactionWithCategory[];
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

  type Row = {
    template_id: string;
    occurred_on: string;
    recurring_templates: { categories: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    templateId: row.template_id,
    occurredOn: row.occurred_on,
    // Empty rather than an English word; the screen names it.
    name: row.recurring_templates?.categories?.name ?? "",
  }));
}

function getRecurringSkipKeys(
  userId: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  return templates.getRecurringSkipKeys(supabase, userId, year, month);
}

export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode = "current",
): Promise<MonthlySummary> {
  const [transactions, recurringTemplates, skippedKeys] = await Promise.all([
    getTransactions(userId, year, month),
    getRecurringTemplates(userId),
    getRecurringSkipKeys(userId, year, month),
  ]);

  return buildMonthlySummary(
    transactions,
    recurringTemplates,
    year,
    month,
    view,
    skippedKeys,
  );
}

export async function getInvestmentTransactions(
  userId: string,
): Promise<TransactionWithCategory[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories!inner(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .eq("categories.type", "investment")
    .order("occurred_on", { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as TransactionWithCategory[];
}

export async function getInvestmentPositions(
  userId: string,
): Promise<InvestmentPositionRow[]> {
  const { data, error } = await supabase
    .from("investment_positions")
    .select("*")
    .eq("user_id", userId)
    .order("wallet")
    .order("name");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    wallet: row.wallet,
    recurring_template_id: row.recurring_template_id,
    name: row.name,
    category_id: row.category_id,
    initial_balance: Number(row.initial_balance),
    current_value:
      row.current_value === null ? null : Number(row.current_value),
    share_count: row.share_count,
    instrument_symbol: row.instrument_symbol,
    instrument_name: row.instrument_name,
    ongoing_charge:
      row.ongoing_charge === null ? null : Number(row.ongoing_charge),
  }));
}

async function fetchLiveQuotes(
  symbols: string[],
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const quotes: Record<string, number> = {};

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const quote = await fetchInstrumentQuoteInEur(symbol);
        quotes[symbol] = quote.priceEur;
      } catch {
        // Fall back to invested value when a quote fails.
      }
    }),
  );

  return quotes;
}

async function fetchHistoricalQuotes(
  symbols: string[],
): Promise<Record<string, Record<string, number>>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const history: Record<string, Record<string, number>> = {};

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        history[symbol] = await fetchMonthlyClosesInEur(symbol);
      } catch {
        // History is optional.
      }
    }),
  );

  return history;
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

  const symbols = new Set<string>();
  for (const row of positionRows) {
    if (row.instrument_symbol) {
      symbols.add(row.instrument_symbol);
    }
  }
  for (const template of recurringTemplates) {
    if (template.instrument_symbol) {
      symbols.add(template.instrument_symbol);
    }
  }

  const symbolList = Array.from(symbols);
  const [liveQuotes, historicalQuotes] = await Promise.all([
    fetchLiveQuotes(symbolList),
    includeHistory
      ? fetchHistoricalQuotes(symbolList)
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
export async function getWalletPlans(userId: string): Promise<WalletPlan[]> {
  const { data, error } = await supabase
    .from("wallet_plans")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
  return (data ?? []) as WalletPlan[];
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

/**
 * Everything the user has ever recorded as savings.
 *
 * The app tracks flows, not balances, so this is a sum of savings
 * transactions rather than an account balance — which is why the UI that uses
 * it says "everything you have logged as savings". Withdrawals are not
 * modelled, so this is an upper bound; it is the honest best the ledger offers.
 */
export async function getSavingsReserve(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, categories!inner(type, counts_toward_summary)")
    .eq("user_id", userId)
    .eq("categories.type", "savings");

  if (error) {
    throw error;
  }

  // A savings category marked as not counting is a withdrawal, so it comes
  // off the reserve rather than being skipped. Skipping it was what made the
  // reserve only ever grow, and the runway it feeds only ever flatter.
  return (data ?? []).reduce((sum, row) => {
    const withdrawal =
      (row.categories as unknown as { counts_toward_summary: boolean })
        .counts_toward_summary === false;
    return sum + (withdrawal ? -Number(row.amount) : Number(row.amount));
  }, 0);
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
export async function getBankAccounts(userId: string): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("label");

  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as BankAccount[];
}

/**
 * What the counted accounts held at the end of a given day.
 *
 * Reads the stored statement rather than the bank, which is what lets the
 * phone answer at all: it holds no credentials and cannot reach the provider.
 * Null when the feature is not set up — no connection, or nobody has said
 * which accounts hold spendable money. That is different from a reading that
 * failed, which comes back with `ok: false` and the accounts it could not
 * read.
 */
export async function readCashBalance(
  userId: string,
  date: string,
): Promise<CashBalance | null> {
  const accounts = await getBankAccounts(userId);
  const counted = accounts.filter((account) => account.counts_as_cash);

  if (counted.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("provider_account_id, occurred_on, balance_after, intraday_index")
    .eq("user_id", userId)
    .in(
      "provider_account_id",
      counted.map((account) => account.provider_account_id),
    )
    .lte("occurred_on", date)
    // Newest first and capped: only the last row of the last day is needed,
    // and one page of it is far more than enough to find that row for every
    // account. Ordering by intraday_index second keeps the day's last
    // movement ahead of the ones before it.
    .order("occurred_on", { ascending: false })
    .order("intraday_index", { ascending: true })
    .limit(400);

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  const byAccount = new Map<string, AccountRows>();
  for (const account of counted) {
    byAccount.set(account.provider_account_id, {
      accountId: account.provider_account_id,
      label: account.label,
      rows: [],
    });
  }

  for (const row of data ?? []) {
    byAccount.get(row.provider_account_id as string)?.rows.push({
      occurredOn: row.occurred_on as string,
      balanceAfter:
        row.balance_after === null ? null : Number(row.balance_after),
      intradayIndex: row.intraday_index as number,
    });
  }

  // A lapsed consent stores no rows, so it arrives here with an empty list
  // and is reported as unreadable rather than as an empty account.
  return cashBalanceAsOf([...byAccount.values()], date);
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

/**
 * A bank row still waiting for a category, and why it is waiting.
 *
 * Mirrors the web `PendingFeedRow`. The reason is stored packed into
 * `decided_by` as `review:<reason>` and unpacked here, so both apps say the
 * same sentence about the same row — the sentences themselves live in
 * `@finance/core/bank-feed`.
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
  userId: string,
  locale: Locale,
): Promise<PendingFeedRow[]> {
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("occurred_on", { ascending: false })
    // As many as the web's grouped review holds: grouping only works when a
    // shop's rows are all here, and a year of weekly shopping is past 100.
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
  }));
}

/**
 * The user's history keyed the way the bank matcher keys it — what the
 * grouped review suggests a shop's category from. The web's
 * `getBankMerchantIndex`, bounded the same way.
 */
export async function getBankMerchantIndex(
  userId: string,
): Promise<BankMerchantIndex> {
  const { data, error } = await supabase
    .from("transactions")
    .select("note, category_id, occurred_on, categories(name, type)")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    .limit(2000);

  if (error) {
    // A suggestion is a convenience: without one, the review still works.
    return new Map();
  }

  type Row = {
    note: string | null;
    category_id: string;
    occurred_on: string;
    categories: { name: string; type: string } | null;
  };

  return buildBankMerchantIndex(
    ((data ?? []) as unknown as Row[]).flatMap((row) =>
      row.categories ? [{ ...row, categories: row.categories }] : [],
    ),
  );
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
  transactionId: string | null;
  status: "imported" | "ignored";
}

/**
 * What was decided recently, so a decision can be taken back.
 *
 * Filing a card payment under the wrong category is the easiest mistake to
 * make in this flow — the labels are bank shorthand and the list is long —
 * and without this the row vanishes from the only screen that knows which
 * bank line it came from. Bounded rather than complete: this is how you undo
 * what you just did, and the ledger is the archive.
 */
export async function getDecidedFeedItems(
  userId: string,
  limit = 20,
): Promise<DecidedFeedRow[]> {
  const { data, error } = await supabase
    .from("bank_feed_items")
    .select("*, transactions(category_id, categories(name))")
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
      categories: { name: string } | null;
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
    transactionId: row.transaction_id,
    status: row.status === "ignored" ? "ignored" : "imported",
  }));
}

/** How many bank rows are still waiting for a category. */
export async function countPendingFeedItems(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    if (isMissingSchema(error)) {
      return 0;
    }
    throw error;
  }

  return count ?? 0;
}

/**
 * Whether this user's ledger is fed by a bank — `@finance/data/bank-feed`,
 * with the phone's client.
 */
export function hasBankFeed(userId: string): Promise<boolean> {
  return bankFeeds(supabase, userId);
}

/** How many bank rows an earlier sync merged away without asking. */
export async function countSwallowedFeedItems(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("decided_by", "match:recurring");

  if (error) {
    if (isMissingSchema(error)) {
      return 0;
    }
    throw error;
  }

  return count ?? 0;
}

/**
 * Standing charges the statement implies but no template covers.
 *
 * The phone's twin of the web's `getRecurringProposals` in
 * `apps/web/lib/queries/bank.ts` — read from transactions rather than the raw
 * feed, so it works the same whether the rows came from a bank or a CSV, and
 * guarded with `isMissingSchema` like every other bank-feed-adjacent read
 * here, since `recurring_proposal_dismissals` ships in the same migration.
 */
export async function getRecurringProposals(
  userId: string,
  today: string,
): Promise<RecurringProposal[]> {
  const [txResult, templatesResult, dismissalsResult] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "occurred_on, amount, note, category_id, categories!inner(name, type)",
      )
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .limit(3000),
    supabase
      .from("recurring_templates")
      .select("description, instrument_name")
      .eq("user_id", userId),
    supabase
      .from("recurring_proposal_dismissals")
      .select("merchant_key")
      .eq("user_id", userId),
  ]);

  for (const { error } of [txResult, templatesResult, dismissalsResult]) {
    if (error) {
      if (isMissingSchema(error)) {
        return [];
      }
      throw error;
    }
  }

  // Covered either by a template that already exists, or by the user having
  // looked at the suggestion and said no. A refusal that does not stick is
  // not a refusal.
  const covered = new Set([
    ...(templatesResult.data ?? []).flatMap((row) =>
      [row.description, row.instrument_name]
        .map((value) => bankMerchantKey(value as string | null))
        .filter((key) => key !== ""),
    ),
    ...(dismissalsResult.data ?? []).map((row) => row.merchant_key as string),
  ]);

  const proposals = detectRecurring(
    (txResult.data ?? []).map((row) => {
      const category = row.categories as unknown as {
        name: string;
        type: CategoryType;
      };
      return {
        occurredOn: row.occurred_on as string,
        amount: Number(row.amount),
        note: row.note as string | null,
        categoryId: row.category_id as string,
        categoryName: category.name,
        categoryType: category.type,
      };
    }),
  );

  return filterLiveProposals(proposals, today, covered);
}
