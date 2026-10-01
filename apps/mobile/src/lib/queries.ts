import { hasBankFeed as bankFeeds } from "@finance/data/bank-feed";
import {
  formatMonthLabel,
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
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import {
  explainFulfilmentMisses,
  proposeFulfilments,
  fulfilmentOccurrences,
  fulfilmentScope,
  proposalsForMonth,
  refusalKey,
  type FulfilmentMiss,
  type FulfilmentMovement,
  type FulfilmentProposal,
  type ProposeOptions,
} from "@finance/core/recurring-fulfilment";
import { buildMonthlySummary } from "@finance/core/monthly-summary";
import {
  buildMonthClose,
  buildRecordedCashFlows,
  closableMonth,
  monthKeyOfClose,
  summarizeCloseHistory,
  type CloseableMonth,
  type CloseHistorySummary,
  type ClosedMonthOutcome,
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
  MATCH_WINDOW_DAYS,
  type ExistingLedgerRow,
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
import { getMovedBetween, rowsByCashDate } from "@/lib/moved-rows";

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
  const { data, error } = await supabase
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as RecurringTemplateWithCategory[];
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

async function getRecurringSkipKeys(
  userId: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await supabase
    .from("recurring_skips")
    .select("template_id, occurred_on")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end);

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? []).map((row) =>
      recurringOccurrenceKey(row.template_id, row.occurred_on),
    ),
  );
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

/** What the app assumes until the user says otherwise. */
export const DEFAULT_CLOSE_DAY = 5;

export interface CloseSettings {
  closeDay: number;
  unrecordedCap: number | null;
}

export async function getMonthCloseSettings(
  userId: string,
): Promise<CloseSettings> {
  const { data, error } = await supabase
    .from("month_close_settings")
    .select("close_day, unrecorded_cap")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    closeDay: data?.close_day ?? DEFAULT_CLOSE_DAY,
    unrecordedCap:
      data?.unrecorded_cap === null || data?.unrecorded_cap === undefined
        ? null
        : Number(data.unrecorded_cap),
  };
}

/** Every close, oldest first, which is the order the chain reads in. */
export async function getMonthCloses(userId: string): Promise<MonthClose[]> {
  const { data, error } = await supabase
    .from("month_closes")
    .select("*")
    .eq("user_id", userId)
    .order("month", { ascending: true });

  if (error) {
    throw error;
  }
  return data ?? [];
}

function monthKeyOfDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Every closed month's cash flows, in two queries rather than two per month.
 * Both halves are needed: cash leaves for a broker either as a transaction in
 * a category that counts toward the summary, or as a wallet transfer in its
 * own table, and missing the second would report every transfer as unrecorded
 * spending.
 */
async function cashFlowsByMonth(
  userId: string,
  monthKeys: readonly string[],
): Promise<Map<string, RecordedCashFlows>> {
  const byMonth = new Map<string, RecordedCashFlows>();
  if (monthKeys.length === 0) {
    return byMonth;
  }

  const sorted = [...monthKeys].sort();
  const [firstYear, firstMonth] = sorted[0]!.split("-").map(Number);
  const [lastYear, lastMonth] =
    sorted[sorted.length - 1]!.split("-").map(Number);
  const { start } = getMonthBounds(firstYear!, firstMonth!);
  const { end } = getMonthBounds(lastYear!, lastMonth!);

  const [
    { data: transactions, error: txError },
    { data: transfers, error: trError },
    moved,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    supabase
      .from("wallet_transfers")
      .select("amount, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    // An income paid early for next month left its mark on the balance of
    // the month its money arrived in, whichever month it counts for.
    getMovedBetween(userId, start, end),
  ]);

  if (txError) {
    throw txError;
  }
  if (trError) {
    throw trError;
  }

  // Each month by the day its money moved: the close compares the ledger
  // with what the account held.
  const txByMonth = new Map<string, TransactionWithCategory[]>();
  for (const row of rowsByCashDate(
    (transactions ?? []) as TransactionWithCategory[],
    moved,
    start,
    end,
  )) {
    const key = monthKeyOfDate(cashDateOf(row));
    txByMonth.set(key, [...(txByMonth.get(key) ?? []), row]);
  }

  const transferByMonth = new Map<string, { amount: number }[]>();
  for (const row of transfers ?? []) {
    const key = monthKeyOfDate(row.occurred_on as string);
    transferByMonth.set(key, [
      ...(transferByMonth.get(key) ?? []),
      { amount: Number(row.amount) },
    ]);
  }

  for (const key of sorted) {
    byMonth.set(
      key,
      buildRecordedCashFlows(
        txByMonth.get(key) ?? [],
        transferByMonth.get(key) ?? [],
      ),
    );
  }

  return byMonth;
}

export interface ClosedMonthRow extends ClosedMonthOutcome {
  label: string;
  closingBalance: number;
  observedOn: string;
  status: MonthCloseResult["status"];
  keptRate: number | null;
  /**
   * What the account actually moved over the month. Null on a baseline, which
   * has nothing before it to have moved from.
   */
  cashChange: number | null;
  /** Whether the figure was typed in or read off the statement. */
  source: "manual" | "bank";
}

export interface MonthCloseOverview {
  settings: CloseSettings;
  /** Every closed month, newest first, with its reconciliation replayed. */
  history: ClosedMonthRow[];
  summary: CloseHistorySummary;
  /** The month the user should be asked about, if any. */
  next: CloseableMonth | null;
}

/**
 * Replays every close in order so the history and the streak come out of the
 * same arithmetic as the reveal, rather than from figures frozen when each
 * close was recorded. A transaction entered late for a month already closed
 * should move that month's unrecorded figure: the balance did not change, so
 * what the app failed to account for genuinely shrank.
 */
export async function getMonthCloseOverview(
  userId: string,
  today: string,
  locale: Locale,
): Promise<MonthCloseOverview> {
  const [settings, closes] = await Promise.all([
    getMonthCloseSettings(userId),
    getMonthCloses(userId),
  ]);

  const monthKeys = closes.map((close) => monthKeyOfClose(close.month));
  const flowsByMonth = await cashFlowsByMonth(userId, monthKeys);

  const emptyFlows: RecordedCashFlows = {
    income: 0,
    expenses: 0,
    savings: 0,
    transfers: 0,
  };

  const history: ClosedMonthRow[] = [];
  let openingBalance: number | null = null;

  for (const close of closes) {
    const monthKey = monthKeyOfClose(close.month);
    const [year, month] = monthKey.split("-").map(Number);
    const closingBalance = Number(close.closing_balance);

    const result = buildMonthClose({
      openingBalance,
      closingBalance,
      flows: flowsByMonth.get(monthKey) ?? emptyFlows,
    });

    history.push({
      monthKey,
      label: formatMonthLabel(year!, month!, locale),
      closingBalance,
      observedOn: close.observed_on,
      status: result.status,
      unrecorded: result.unrecorded,
      kept: result.kept,
      keptRate: result.keptRate,
      cashChange:
        openingBalance === null ? null : closingBalance - openingBalance,
      source: close.balance_source ?? "manual",
    });

    openingBalance = closingBalance;
  }

  return {
    settings,
    history: [...history].reverse(),
    summary: summarizeCloseHistory(history, settings.unrecordedCap),
    next: closableMonth(
      today,
      settings.closeDay,
      monthKeys.length > 0 ? monthKeys[monthKeys.length - 1]! : null,
      locale,
    ),
  };
}

/**
 * A dry run of one month's close, so the sheet can show what it is about to
 * reconcile before the user commits a figure.
 */
export async function previewMonthClose(
  userId: string,
  year: number,
  month: number,
  closingBalance: number,
): Promise<MonthCloseResult> {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const [closes, flowsByMonth] = await Promise.all([
    getMonthCloses(userId),
    cashFlowsByMonth(userId, [monthKey]),
  ]);

  const previous = closes.filter(
    (close) => monthKeyOfClose(close.month) < monthKey,
  );
  const openingBalance =
    previous.length > 0
      ? Number(previous[previous.length - 1]!.closing_balance)
      : null;

  return buildMonthClose({
    openingBalance,
    closingBalance,
    flows: flowsByMonth.get(monthKey) ?? {
      income: 0,
      expenses: 0,
      savings: 0,
      transfers: 0,
    },
  });
}

/**
 * One month's recorded flows, for the live reconciliation the Month screen
 * shows. The same two queries the close history uses, asked for one month.
 */
export async function getRecordedCashFlows(
  userId: string,
  year: number,
  month: number,
): Promise<RecordedCashFlows> {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const byMonth = await cashFlowsByMonth(userId, [monthKey]);
  return (
    byMonth.get(monthKey) ?? {
      income: 0,
      expenses: 0,
      savings: 0,
      transfers: 0,
    }
  );
}

/* --------------------------------------------------------- the bank feed */

/**
 * Whether an error means "this feature's schema is not here yet".
 *
 * PGRST205 is PostgREST's missing table, 42P01 is Postgres', and 42703 a
 * missing column. Every other error still throws: swallowing them all would
 * turn a permissions mistake into a screen that quietly shows nothing, which
 * is how a wrong balance gets believed.
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

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
 * Which recurring charges the bank looks to have already delivered.
 *
 * The rules live in `@finance/core/recurring-fulfilment` and are tested
 * there; this is the plumbing. See the web twin for the whole story — in
 * short, a bank-imported transaction carries no template link, so every
 * recurring charge the bank delivers was counted twice, once as money that
 * moved and once as money still forecast to move.
 */

/** Occurrences already fulfilled, as occurrence keys. */
export async function getFulfilledKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("recurring_fulfilments")
    .select("template_id, occurred_on")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return new Set();
    }
    throw error;
  }

  return new Set(
    (data ?? []).map((row) =>
      recurringOccurrenceKey(row.template_id, row.occurred_on),
    ),
  );
}

/**
 * Which ledger rows stand in for an occurrence, by transaction id.
 *
 * The same table as `getFulfilledKeys` read down its other axis: that one
 * answers "is this occurrence settled?" for the forecast, this one answers
 * "does this row settle something?" for a row on screen. Cheap either way —
 * `recurring_fulfilments` holds one row per confirmed occurrence, so a decade
 * of a dozen charges is a few thousand rows of three columns.
 *
 * Deliberately not month-scoped, and it must stay that way.
 * `recurring_fulfilments.occurred_on` is the date of the *occurrence*, not of
 * the movement — that separation is the whole point of the table — so a
 * payment on the 31st can settle an occurrence dated the 1st. Filtering this
 * by the month on screen would take the mark off the very row that earned it.
 *
 * Separate from the fulfilment report rather than folded into it because the
 * report gives up early when a month generates no occurrences, which happens
 * whenever a template is inactive or outside its date range. Sourced from
 * there, a confirmation would disappear the moment its template was switched
 * off — retroactively, across every month.
 */
export async function getConfirmedTransactionIds(
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("recurring_fulfilments")
    .select("transaction_id")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return new Set();
    }
    throw error;
  }

  // `transaction_id` is `not null` in migration 023, so nothing can slip in.
  return new Set((data ?? []).map((row) => row.transaction_id as string));
}

function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10);
}

/**
 * The proposals, and why every other charge was not one.
 *
 * Mirrors the web twin. The two halves account for every occurrence the month
 * called for exactly once, which is what makes the pair worth reading: a
 * matcher that offers two of five charges and says nothing about the other
 * three looks broken rather than narrow.
 */
export interface FulfilmentReport {
  proposals: FulfilmentProposal[];
  misses: FulfilmentMiss[];
}

/**
 * The movements that could fulfil something this month, and what the user has
 * already decided about them.
 *
 * Split out so the report and the bare proposals share one round trip without
 * either paying for the other's work — the tab bar's count asks for proposals
 * on every data-version bump and has no use for the misses.
 */
async function readCandidates(
  userId: string,
  from: string,
  to: string,
): Promise<{ movements: FulfilmentMovement[]; options: ProposeOptions }> {
  const [
    { data: transactions, error: txError },
    { data: fulfilments, error: fulfilError },
    { data: refusals, error: refusalError },
  ] = await Promise.all([
    // Only rows no template wrote. A row a template wrote is already the
    // occurrence; asking whether it fulfils one would be asking whether it is
    // itself.
    supabase
      .from("transactions")
      .select("id, occurred_on, amount, category_id, note")
      .eq("user_id", userId)
      .is("recurring_template_id", null)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("recurring_fulfilments")
      .select("template_id, occurred_on, transaction_id")
      .eq("user_id", userId),
    supabase
      .from("recurring_fulfilment_refusals")
      .select("template_id, occurred_on, transaction_id")
      .eq("user_id", userId),
  ]);

  if (txError) {
    throw txError;
  }
  // The two decision tables are the optional half. Without them every
  // proposal simply looks undecided, which is the right failure: the user is
  // asked again rather than having a confirmation silently forgotten.
  if (fulfilError && !isMissingSchema(fulfilError)) {
    throw fulfilError;
  }
  if (refusalError && !isMissingSchema(refusalError)) {
    throw refusalError;
  }

  const movements: FulfilmentMovement[] = (transactions ?? []).map((row) => ({
    transactionId: row.id as string,
    occurredOn: row.occurred_on as string,
    amount: Number(row.amount),
    categoryId: row.category_id as string,
    note: (row.note as string | null) ?? null,
  }));

  return {
    movements,
    options: {
      // A movement dated after today has not arrived, whatever else matches.
      today: todayIsoLocal(),
      fulfilledKeys: new Set(
        (fulfilments ?? []).map((row) =>
          recurringOccurrenceKey(row.template_id, row.occurred_on),
        ),
      ),
      claimedTransactionIds: new Set(
        (fulfilments ?? []).map((row) => row.transaction_id as string),
      ),
      refusedPairs: new Set(
        (refusals ?? []).map((row) =>
          refusalKey(row.template_id, row.occurred_on, row.transaction_id),
        ),
      ),
    },
  };
}

/**
 * A month's questions: the pairings planned in it, and the ones whose money
 * moved in it — the October salary paid on 22 September is asked about in
 * September as well as October (`fulfilmentScope`). The web twin's
 * `monthQuestions`; matched across three months at once so one payment is
 * never offered for two of them.
 */
async function monthQuestions(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
) {
  const scope = fulfilmentScope(year, month);
  const occurrences = fulfilmentOccurrences(
    templates,
    categories,
    scope.months,
  );
  if (occurrences.length === 0) {
    return null;
  }
  const { movements, options } = await readCandidates(
    userId,
    scope.from,
    scope.to,
  );
  const all = proposeFulfilments(occurrences, movements, options);
  return { occurrences, movements, options, all };
}

export async function getFulfilmentReport(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<FulfilmentReport> {
  const asked = await monthQuestions(
    userId,
    templates,
    categories,
    year,
    month,
  );
  if (!asked) {
    return { proposals: [], misses: [] };
  }
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return {
    proposals: proposalsForMonth(asked.all, year, month),
    // Only this month's occurrences can be missing from it.
    misses: explainFulfilmentMisses(
      asked.occurrences.filter((occurrence) =>
        occurrence.occurredOn.startsWith(monthKey),
      ),
      asked.movements,
      asked.all,
      asked.options,
    ),
  };
}

/**
 * The proposals alone, for a caller with no use for an absence.
 *
 * The tab bar's count asks this on every data-version bump; running
 * `explainFulfilmentMisses` there and discarding it would be work done for
 * nobody.
 */
export async function getFulfilmentProposals(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<FulfilmentProposal[]> {
  const asked = await monthQuestions(
    userId,
    templates,
    categories,
    year,
    month,
  );
  return asked ? proposalsForMonth(asked.all, year, month) : [];
}

/** How many are waiting, for the tab bar's badge. */
export async function countFulfilmentProposals(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const [templates, categories] = await Promise.all([
    getRecurringTemplates(userId),
    getCategories(userId),
  ]);
  const proposals = await getFulfilmentProposals(
    userId,
    templates,
    categories,
    year,
    month,
  );
  return proposals.length;
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

/**
 * Ledger rows close enough in time that one could be a copy of the other.
 *
 * The web twin is `lib/bank/duplicates.ts`. Duplicated rather than shared
 * because core carries no Supabase dependency — but the rule that decides
 * what counts as a copy is `findLedgerMatch` in `@finance/core/bank-feed`,
 * which both call, so the two apps cannot drift on the judgement itself.
 */
export async function ledgerRowsAround(
  userId: string,
  isoDate: string,
): Promise<ExistingLedgerRow[]> {
  const [{ data: rows }, { data: claimed }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, occurred_on, amount, recurring_template_id, categories!inner(type)",
      )
      .eq("user_id", userId)
      .gte("occurred_on", shiftDays(isoDate, -MATCH_WINDOW_DAYS))
      .lte("occurred_on", shiftDays(isoDate, MATCH_WINDOW_DAYS)),
    supabase
      .from("bank_feed_items")
      .select("transaction_id")
      .eq("user_id", userId)
      .not("transaction_id", "is", null),
  ]);

  const claimedIds = new Set(
    (claimed ?? [])
      .map((row) => row.transaction_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  return (rows ?? []).map((row) => ({
    transactionId: row.id as string,
    occurredOn: row.occurred_on as string,
    amount: Number(row.amount),
    isIncome: (row.categories as unknown as { type: string }).type === "income",
    fromRecurringTemplate: row.recurring_template_id !== null,
    // A row the feed already answers for cannot also be the thing a second
    // bank row duplicates.
    alreadyClaimed: claimedIds.has(row.id as string),
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
