import {
  formatMonthLabel,
  getMonthBounds,
  type BudgetViewMode,
} from "@finance/core/constants";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
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
import type {
  Category,
  MonthClose,
  MonthlySummary,
  RecurringTemplateWithCategory,
  Tag,
  TransactionWithCategory,
  WalletPlan,
} from "@finance/core/types/database";
import type { InvestmentPositionRow } from "@finance/core/investment-positions";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { supabase } from "@/lib/supabase";

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

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  income: number;
  outflow: number;
  net: number;
}

/**
 * Income/outflow per month for the last `months` months, in one round trip.
 * Only categories that count toward the summary are included, matching how the
 * dashboard totals are built.
 */
export async function getMonthlyTrend(
  userId: string,
  months = 6,
): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const start = `${first.getFullYear()}-${`${first.getMonth() + 1}`.padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, occurred_on, categories(type, counts_toward_summary)")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .order("occurred_on", { ascending: true });

  if (error) {
    throw error;
  }

  const buckets = new Map<string, { income: number; outflow: number }>();
  for (let index = 0; index < months; index++) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    buckets.set(
      `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`,
      { income: 0, outflow: 0 },
    );
  }

  type Row = {
    amount: number | string;
    occurred_on: string;
    categories: { type: string; counts_toward_summary: boolean } | null;
  };

  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.categories?.counts_toward_summary) {
      continue;
    }
    const bucket = buckets.get(row.occurred_on.slice(0, 7));
    if (!bucket) {
      continue;
    }
    const amount = Number(row.amount);
    if (row.categories.type === "income") {
      bucket.income += amount;
    } else {
      bucket.outflow += amount;
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, totals]) => {
      const [year, month] = monthKey.split("-").map(Number);
      return {
        monthKey,
        label: formatMonthLabel(year, month),
        income: totals.income,
        outflow: totals.outflow,
        net: totals.income - totals.outflow,
      };
    });
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
    name: row.recurring_templates?.categories?.name ?? "Recurring item",
  }));
}

/** Tag ids already attached to a transaction. */
export async function getTransactionTagIds(
  transactionId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("transaction_tags")
    .select("tag_id")
    .eq("transaction_id", transactionId);

  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => row.tag_id as string);
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
    todayIsoLocal(),
    historicalQuotes,
  );
}

export async function getBudgets(userId: string) {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getWalletTransfers(
  userId: string,
  year: number,
  month: number,
) {
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await supabase
    .from("wallet_transfers")
    .select("*")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false });
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getTags(userId: string) {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function getSavingsGoals(userId: string) {
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) {
    throw error;
  }
  return data ?? [];
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
  tags: Tag[];
  /** Most recently used category ids, newest first. */
  recentCategoryIds: string[];
  merchants: MerchantRule[];
}

/** Everything the quick-add sheet needs, in one round trip. */
export async function getQuickEntryContext(
  userId: string,
): Promise<QuickEntryContext> {
  const [categories, tags, history] = await Promise.all([
    getCategories(userId),
    getTags(userId),
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
    tags,
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
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_on, amount, note")
    .eq("user_id", userId)
    .gte("occurred_on", from)
    .lte("occurred_on", to);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    occurredOn: row.occurred_on as string,
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
  ]);

  if (txError) {
    throw txError;
  }
  if (trError) {
    throw trError;
  }

  const txByMonth = new Map<string, TransactionWithCategory[]>();
  for (const row of (transactions ?? []) as TransactionWithCategory[]) {
    const key = monthKeyOfDate(row.occurred_on);
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
      label: formatMonthLabel(year!, month!),
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
 * Whether this user's ledger is fed by a bank. See the web twin for why this
 * is a fact about the data rather than about configuration.
 */
export async function hasBankFeed(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}
