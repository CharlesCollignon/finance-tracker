import {
  formatMonthLabel,
  getMonthBounds,
  type BudgetViewMode,
} from "@finance/core/constants";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { buildMonthlySummary } from "@finance/core/monthly-summary";
import { buildInvestmentPortfolio } from "@finance/core/investment-positions";
import { todayIsoLocal } from "@finance/core/constants";
import {
  fetchInstrumentQuoteInEur,
  fetchMonthlyClosesInEur,
} from "@finance/core/market/fx";
import type {
  Category,
  MonthlySummary,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
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
