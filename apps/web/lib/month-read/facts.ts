import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { buildMonthPulse } from "@finance/core/month-pulse";
import { buildStillToCome } from "@finance/core/still-to-come";
import { previousMonthKey } from "@finance/core/month-close";
import {
  buildMonthFacts,
  type MonthFacts,
  type MonthState,
} from "@finance/core/month-facts";
import type { Database } from "@finance/core/types/database";
import { getCategories } from "@/lib/queries/categories";
import {
  getMonthComparison,
  getMonthlySummary,
  getRecurringSkipKeys,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries/finance";
import {
  getMonthCloseOverview,
  getRecordedCashFlows,
} from "@/lib/queries/month-close";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { readCashBalance } from "@/lib/queries/bank-balance";
import { getPendingFeedItems, hasBankFeed } from "@/lib/queries/bank";
import { getLocale } from "@/lib/locale";
import type { Locale } from "@finance/core/i18n/locale";
import {
  getBankForecast,
  getFulfilledKeys,
  getFulfilmentProposals,
} from "@/lib/queries/fulfilment";

type Client = SupabaseClient<Database>;

/**
 * Everything a month read may refer to, gathered from what the app already
 * computes.
 *
 * Every figure here is one another surface already has on screen, which is
 * the property that makes the read checkable: a reader can look at that
 * surface and see the same number.
 *
 * Recomputed server-side on every write, and deliberately not accepted from
 * the client. The Month page already holds most of this and passing it in
 * would be a real saving — and it would make every figure in the read a
 * figure the client supplied, which is the exact opposite of the guarantee
 * this feature exists to make. This is the shortcut a later change will
 * reach for; it must not be taken.
 */
export async function gatherMonthFacts(
  userId: string,
  year: number,
  month: number,
  client?: Client,
  /**
   * Build the pack in this language rather than the request's.
   *
   * Used to render a stored read in the language it was written in. Nothing
   * about the figures changes — only the labels — so the digest is identical
   * either way and a language switch never makes a stored read look stale.
   */
  localeOverride?: Locale,
): Promise<MonthFacts> {
  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;

  const [
    summary,
    comparison,
    closes,
    categories,
    templates,
    monthTransactions,
    skippedKeys,
    fulfilledKeys,
    portfolio,
    bankFed,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, "current"),
    getMonthComparison(userId, year, month),
    getMonthCloseOverview(userId, today),
    getCategories(userId),
    getRecurringTemplates(userId),
    getTransactions(userId, year, month),
    getRecurringSkipKeys(userId, year, month),
    getFulfilledKeys(userId, client),
    getWalletPortfolio(userId, { includeHistory: false }),
    hasBankFeed(userId),
  ]);

  // Only for the month in progress: a balance is a fact about now, and one
  // shown beside a finished month's totals invites arithmetic across two
  // different moments.
  const cash = isCurrentMonth
    ? await readCashBalance(userId, today, client)
    : null;

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const closed =
    closes.history.find((row) => row.monthKey === monthKey) ?? null;

  // The same adjacency rule the Month page uses: only the close of the month
  // immediately before can be measured from, or the arithmetic compares a
  // balance against transactions from a different window.
  const latest = closes.history[0];
  const openingBalance =
    latest && latest.monthKey === previousMonthKey(monthKey)
      ? latest.closingBalance
      : null;

  const upcoming = buildStillToCome(
    monthTransactions,
    templates,
    year,
    month,
    today,
    skippedKeys,
    fulfilledKeys,
    await getBankForecast(userId, templates, bankFed, today, client),
  );

  // Measured against the balance, so by the day money moved, as the close
  // measures it and as the phone already did: the month's summary counts an
  // October salary paid in September as October's, and the October balance
  // never saw it, which read as a month's pay of unrecorded spending.
  const flows = isCurrentMonth
    ? await getRecordedCashFlows(userId, year, month, client)
    : null;
  const pulse =
    isCurrentMonth && flows
      ? buildMonthPulse({
          onHand: cash?.ok ? cash.total : null,
          committed: upcoming.leaving,
          arriving: upcoming.arriving,
          flows,
          openingBalance,
          cap: closes.settings.unrecordedCap,
        })
      : null;

  const state: MonthState = isCurrentMonth
    ? "in-progress"
    : closed
      ? "closed"
      : "past-open";

  // Counted rather than listed. How many entries are uncategorised is worth
  // telling the writer, because this ships before the model helps categorise
  // anything and a month with a queue has a genuinely partial picture of
  // where money went. Which merchants they are is not its business.
  const locale = localeOverride ?? (await getLocale());
  const [pending, proposals] = await Promise.all([
    bankFed ? getPendingFeedItems(userId, locale) : [],
    getFulfilmentProposals(userId, templates, categories, year, month, client),
  ]);

  return buildMonthFacts({
    year,
    month,
    state,
    summary,
    comparison,
    close: closed
      ? {
          monthKey: closed.monthKey,
          unrecorded: closed.unrecorded,
          kept: closed.kept,
          keptRate: closed.keptRate,
          cashChange: closed.cashChange,
        }
      : null,
    pulse,
    closeSummary: closes.summary,
    unrecordedCap: closes.settings.unrecordedCap,
    // Always a number, so zero is the "nothing invested" case rather than
    // null. `buildMonthFacts` drops a zero here for exactly that reason.
    investedValue: portfolio.totalMarketValue,
    inboxPending: pending.length,
    chargesUnconfirmed: proposals.length,
    // The labels are the model's vocabulary of figures as well as the card's,
    // so this is what decides which language the read comes back in.
    locale,
  });
}
