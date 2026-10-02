import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentMonth,
  getMonthBounds,
  todayIsoLocal,
  type BudgetViewMode,
} from "@finance/core/constants";
import {
  buildMonthComparison,
  type MonthComparison,
} from "@finance/core/month-comparison";
import type {
  CategoryType,
  MonthlySummary,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { getLocale } from "@/lib/locale";
import * as history from "@finance/data/history";
import * as monthLedger from "@finance/data/month-ledger";
import * as templates from "@finance/data/templates";

export async function getTransactions(
  userId: string,
  year: number,
  month: number,
): Promise<TransactionWithCategory[]> {
  return monthLedger.getMonthTransactions(
    await createClient(),
    userId,
    year,
    month,
  );
}

export const getInvestmentTransactions = cache(
  async (userId: string): Promise<TransactionWithCategory[]> =>
    history.getInvestmentTransactions(await createClient(), userId),
);

export async function getRecurringSkipKeys(
  userId: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  return templates.getRecurringSkipKeys(
    await createClient(),
    userId,
    year,
    month,
  );
}

/**
 * The days each charge is already recorded on this month, up to today, by
 * template id — what editing a charge asks about. Rows after today can only
 * be ones written ahead before occurrences were planned, and those follow
 * the charge whatever the answer.
 */
export async function getRecordedThisMonth(
  userId: string,
): Promise<Record<string, string[]>> {
  const supabase = await createClient();
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

  const byTemplate: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (row.recurring_template_id) {
      (byTemplate[row.recurring_template_id] ??= []).push(row.occurred_on);
    }
  }
  return byTemplate;
}

export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode = "current",
): Promise<MonthlySummary> {
  return monthLedger.getMonthlySummary(
    await createClient(),
    userId,
    year,
    month,
    view,
  );
}

export const getRecurringTemplates = cache(
  async (userId: string): Promise<RecurringTemplateWithCategory[]> =>
    templates.getRecurringTemplates(await createClient(), userId),
);

/**
 * This month against the previous one, from actual transactions only.
 *
 * Deliberately not built on the projected summary: comparing what has really
 * happened with what really happened last month is a claim the app can stand
 * behind, whereas comparing two projections would move whenever a template
 * changed.
 */
export async function getMonthComparison(
  userId: string,
  year: number,
  month: number,
  type: CategoryType = "expense",
): Promise<MonthComparison> {
  const [previousYear, previousMonthNumber] =
    month === 1 ? [year - 1, 12] : [year, month - 1];

  const [current, previous] = await Promise.all([
    getTransactions(userId, year, month),
    getTransactions(userId, previousYear, previousMonthNumber),
  ]);

  return buildMonthComparison({
    locale: await getLocale(),
    current,
    previous,
    year,
    month,
    today: todayIsoLocal(),
    type,
  });
}

/**
 * Everything the user has ever recorded as savings.
 *
 * The app tracks flows, not balances, so this is a sum of savings
 * transactions rather than an account balance — which is why the UI that uses
 * it says "everything you have logged as savings" rather than implying the app
 * knows what is in an account. Withdrawals are not modelled, so this is an
 * upper bound; it is the honest best the ledger can offer.
 */
export async function getSavingsReserve(userId: string): Promise<number> {
  return history.getSavingsReserve(await createClient(), userId);
}
