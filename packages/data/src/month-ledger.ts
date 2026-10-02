import { getMonthBounds, type BudgetViewMode } from "@finance/core/constants";
import { buildMonthlySummary } from "@finance/core/monthly-summary";
import type {
  MonthlySummary,
  TransactionWithCategory,
} from "@finance/core/types/database";

import type { Db } from "./client";
import { getRecurringSkipKeys, getRecurringTemplates } from "./templates";

/**
 * One month of the ledger, for both apps: its rows, and the summary built
 * from them, its charges and its skips.
 */

/** The month's rows, newest first. A month stays well inside the row cap. */
export async function getMonthTransactions(
  db: Db,
  userId: string,
  year: number,
  month: number,
): Promise<TransactionWithCategory[]> {
  const { start, end } = getMonthBounds(year, month);
  const { data, error } = await db
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

export async function getMonthlySummary(
  db: Db,
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode = "current",
): Promise<MonthlySummary> {
  const [transactions, templates, skippedKeys] = await Promise.all([
    getMonthTransactions(db, userId, year, month),
    getRecurringTemplates(db, userId),
    getRecurringSkipKeys(db, userId, year, month),
  ]);
  return buildMonthlySummary(
    transactions,
    templates,
    year,
    month,
    view,
    skippedKeys,
  );
}
