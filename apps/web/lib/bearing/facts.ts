import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { buildAllocation } from "@finance/core/allocation";
import { buildBearing } from "@finance/core/bearing";
import {
  buildBearingFacts,
  type BearingFacts,
} from "@finance/core/bearing-facts";
import { buildFundCosts } from "@finance/core/fund-costs";
import { buildInvestmentReturns } from "@finance/core/investment-returns";
import { buildWalletFundingNeeds } from "@finance/core/investment-upcoming";
import { buildMonthPulse } from "@finance/core/month-pulse";
import { previousMonthKey } from "@finance/core/month-close";
import {
  buildForwardProjection,
  buildRunway,
  summarizeProjection,
} from "@finance/core/projection";
import { buildStillToCome } from "@finance/core/still-to-come";
import type { Database } from "@finance/core/types/database";
import type { Locale } from "@finance/core/i18n/locale";
import {
  getInvestmentTransactions,
  getMonthComparison,
  getMonthlySummary,
  getMonthlyTrend,
  getRecurringSkipKeys,
  getRecurringTemplates,
  getSavingsReserve,
  getTransactions,
} from "@/lib/queries/finance";
import { getWalletPlans } from "@/lib/queries/investments";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { readCashBalance } from "@/lib/queries/bank-balance";
import { getPendingFeedItems, hasBankFeed } from "@/lib/queries/bank";
import { getFulfilledKeys } from "@/lib/queries/fulfilment";
import { getLocale } from "@/lib/locale";

type Client = SupabaseClient<Database>;

/**
 * Everything the Bearing may show, gathered from what the app already
 * computes.
 *
 * No new arithmetic. Every figure here comes out of an engine that some other
 * surface already renders — the pulse from Month, the projection and runway
 * from Plan, the returns, allocation and costs from Wallets — which is the
 * property that makes the whole screen checkable: a reader who doubts a tile
 * can go to the surface it links to and find the same number.
 *
 * Recomputed server-side on every arrangement, and deliberately not accepted
 * from the client. The page already holds all of this and passing it in would
 * be a real saving — and it would make every figure the model sees a figure
 * the client supplied, which is the exact opposite of the guarantee this
 * feature exists to make. This is the shortcut a later change will reach for;
 * it must not be taken.
 */
export async function gatherBearingFacts(
  userId: string,
  client?: Client,
  /**
   * Build the pack in this language rather than the request's.
   *
   * Used to render stored captions in the language they were written in.
   * Nothing about the figures changes — only the labels — so the digest is
   * identical either way and a language switch never makes an arrangement
   * look stale.
   */
  localeOverride?: Locale,
): Promise<BearingFacts> {
  const today = todayIsoLocal();
  const { year, month } = getCurrentMonth();

  const [
    summary,
    comparison,
    closes,
    templates,
    monthTransactions,
    skippedKeys,
    fulfilledKeys,
    portfolio,
    plans,
    investmentTransactions,
    trend,
    reserve,
    bankFed,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, "current"),
    getMonthComparison(userId, year, month),
    getMonthCloseOverview(userId, today),
    getRecurringTemplates(userId),
    getTransactions(userId, year, month),
    getRecurringSkipKeys(userId, year, month),
    getFulfilledKeys(userId, client),
    // No history: the Bearing draws its trend from the ledger rather than
    // from quotes, so the expensive half of the portfolio read buys nothing.
    getWalletPortfolio(userId, { includeHistory: false }),
    getWalletPlans(userId),
    getInvestmentTransactions(userId),
    getMonthlyTrend(userId),
    getSavingsReserve(userId),
    hasBankFeed(userId),
  ]);

  const cash = await readCashBalance(userId, today, client);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
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
  );

  const pulse = buildMonthPulse({
    // A reading that failed comes back with `ok: false`, and its total is
    // short by whatever the unreadable accounts hold — so it is not a balance
    // and must not be presented as one.
    onHand: cash?.ok ? cash.total : null,
    committed: upcoming.leaving,
    arriving: upcoming.arriving,
    flows: {
      income: summary.income,
      expenses: summary.expenses,
      savings: summary.savings,
      transfers: summary.investmentDeployments,
    },
    openingBalance,
    cap: closes.settings.unrecordedCap,
  });

  const bearing = buildBearing({
    onHand: cash?.ok ? cash.total : null,
    positions: portfolio.columns.flatMap((column) =>
      column.items.map((item) => ({
        name: item.name,
        marketValue: item.marketValue,
      })),
    ),
  });

  const projection = summarizeProjection(
    buildForwardProjection(templates, year, month, { months: 12 }),
  );

  const planByWallet = new Map(plans.map((plan) => [plan.wallet, plan]));
  const allocation = buildAllocation(
    portfolio.columns.map((column) => ({
      walletId: column.walletId,
      value: column.totalMarketValue,
    })),
    portfolio.columns.map((column) => {
      const target = planByWallet.get(column.walletId)?.target_weight;
      return {
        walletId: column.walletId,
        targetWeight:
          target === null || target === undefined ? null : Number(target),
      };
    }),
  );

  const costs = buildFundCosts(
    portfolio.columns.flatMap((column) =>
      column.items.map((item) => ({
        positionId: item.id,
        name: item.name,
        walletId: item.walletId,
        marketValue: item.marketValue,
        ongoingCharge: item.ongoingCharge,
      })),
    ),
  );

  const contributionPace = buildWalletFundingNeeds(
    templates.filter((template) => template.categories.type === "investment"),
    year,
    month,
  ).reduce((sum, need) => sum + need.monthlyTotal, 0);

  // Counted rather than listed. How many entries are uncategorised is worth
  // telling the arranger, because a position built on a partially filed month
  // is a partially known position. Which merchants they are is not its
  // business — and unlike a month read, this pack never sees a category name
  // at all.
  const locale = localeOverride ?? (await getLocale());
  const pending = bankFed ? await getPendingFeedItems(userId, locale) : [];

  return buildBearingFacts({
    asOf: today,
    bearing,
    pulse,
    summary,
    comparison,
    closeSummary: closes.summary,
    unrecordedCap: closes.settings.unrecordedCap,
    projection,
    runway: buildRunway(reserve, templates, year, month),
    trend: trend.map((point) => point.net),
    returns: buildInvestmentReturns(investmentTransactions, portfolio, today),
    allocation,
    costs,
    contributionPace,
    inboxPending: pending.length,
    // The labels are the model's vocabulary of figures as well as the
    // screen's, so this is what decides which language the captions come back
    // in.
    locale,
  });
}
