import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { formatMonthLabel, getMonthBounds } from "@finance/core/constants";
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
import type {
  Database,
  MonthClose,
  TransactionWithCategory,
} from "@finance/core/types/database";

/** What the app assumes until the user says otherwise. */
export const DEFAULT_CLOSE_DAY = 5;

export interface CloseSettings {
  closeDay: number;
  unrecordedCap: number | null;
}

export async function getMonthCloseSettings(
  userId: string,
): Promise<CloseSettings> {
  const supabase = await createClient();
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
  const supabase = await createClient();
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

/**
 * What the account actually saw in one month.
 *
 * Both halves are needed: cash leaves for a broker either as a transaction in
 * a category that counts toward the summary, or as a wallet transfer in its
 * own table, and a reconciliation that missed the second would report every
 * transfer as unrecorded spending.
 */
export async function getRecordedCashFlows(
  userId: string,
  year: number,
  month: number,
  /**
   * The client to read through. Defaults to the caller's session; the
   * unattended close run hands in the service role, which has no session to
   * read a user id from.
   */
  client?: SupabaseClient<Database>,
): Promise<RecordedCashFlows> {
  const supabase = client ?? (await createClient());
  const { start, end } = getMonthBounds(year, month);

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
      .select("amount")
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

  return buildRecordedCashFlows(
    (transactions ?? []) as TransactionWithCategory[],
    transfers ?? [],
  );
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

function monthKeyOfDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Every closed month's cash flows, in two queries rather than two per month.
 *
 * The range is bounded by the closes themselves, so a user with three closed
 * months reads three months of transactions and not their whole history.
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

  const supabase = await createClient();
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
      source: close.balance_source,
    });

    openingBalance = closingBalance;
  }

  const lastClosedMonthKey =
    monthKeys.length > 0 ? monthKeys[monthKeys.length - 1]! : null;

  return {
    settings,
    history: [...history].reverse(),
    summary: summarizeCloseHistory(history, settings.unrecordedCap),
    next: closableMonth(today, settings.closeDay, lastClosedMonthKey),
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
  const [closes, flows] = await Promise.all([
    getMonthCloses(userId),
    getRecordedCashFlows(userId, year, month),
  ]);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const previous = closes.filter(
    (close) => monthKeyOfClose(close.month) < monthKey,
  );
  const openingBalance =
    previous.length > 0
      ? Number(previous[previous.length - 1]!.closing_balance)
      : null;

  return buildMonthClose({ openingBalance, closingBalance, flows });
}
