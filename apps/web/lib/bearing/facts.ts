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
import { buildMonthPulse, type MonthPulse } from "@finance/core/month-pulse";
import { previousMonthKey } from "@finance/core/month-close";
import { buildForwardProjection, buildRunway } from "@finance/core/projection";
import { buildStillToCome } from "@finance/core/still-to-come";
import type { Database, MonthlySummary } from "@finance/core/types/database";
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
import {
  getMonthCloseOverview,
  type MonthCloseOverview,
} from "@/lib/queries/month-close";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { readCashBalance } from "@/lib/queries/bank-balance";
import {
  countSwallowedFeedItems,
  getPendingFeedItems,
  getRecurringProposals,
  hasBankFeed,
  type PendingFeedRow,
} from "@/lib/queries/bank";
import { getFulfilledKeys } from "@/lib/queries/fulfilment";
import {
  countRecurringToApply,
  recurringOccurrenceKey,
} from "@finance/core/apply-recurring";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import { getLocale } from "@/lib/locale";

type Client = SupabaseClient<Database>;

/**
 * `BearingFacts`, widened with the raw figures the spine and its action row
 * need but a fact pack has no id for.
 *
 * `pulse`, `summary` and `closeSummary` were already computed here and fed
 * into `buildBearingFacts` before being thrown away — the spine needs them
 * as values, not as formatted-and-labelled facts, so they are carried
 * alongside the pack rather than re-derived by calling `buildMonthPulse`
 * again on the page. `closes` is the same overview already read for
 * `closeSummary`, kept whole because its `.next` is what tells the action
 * row a month is ready to close.
 *
 * `swallowed` and `proposals` are new reads — see `gatherBearingFacts` for
 * why each one is necessary rather than optional, and for why
 * `recurringToApply` is counted out of rows already in hand rather than read
 * at all.
 */
export interface GatheredBearingFacts extends BearingFacts {
  pulse: MonthPulse;
  summary: MonthlySummary;
  closes: MonthCloseOverview;
  /** Bank rows still waiting for a category — already read, just exposed. */
  pendingInbox: number;
  /** Bank rows an earlier sync merged away rather than left for review. */
  swallowed: number;
  /** Standing charges the statement implies but no template covers. */
  proposals: number;
  /** Recurring items this month's plan is ready to write as rows. */
  recurringToApply: number;
}

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
): Promise<GatheredBearingFacts> {
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

  // Hoisted above the projection, which labels its months with it. The
  // Bearing used to read "Où le compte arrive d'ici July 2027" in French.
  const locale = localeOverride ?? (await getLocale());

  const projection = buildForwardProjection({
    templates,
    year,
    month,
    today,
    months: 12,
    // Never a partial sum: a reading missing an account is short by whatever
    // that account holds, so it is not a balance and cannot open one.
    onHand: cash?.ok ? cash.total : null,
    closes: closes.summary,
    locale,
  });

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
  //
  // Alongside it, the two further reads the spine's action row needs and
  // nothing here held yet — moved from the Month page's own
  // `AttentionSlot`, not added new. `swallowed` and `proposals` only mean
  // anything with a bank feeding the ledger: a CSV-only user has no feed
  // rows to swallow and no statement to detect a standing charge from,
  // which is why both stay behind the same `bankFed` gate `pending` always
  // used. The row's fourth figure, `recurringToApply`, is not a read at all
  // — see below.
  const pendingPromise: Promise<PendingFeedRow[]> = bankFed
    ? getPendingFeedItems(userId, locale)
    : Promise.resolve([]);
  const swallowedPromise: Promise<number> = bankFed
    ? countSwallowedFeedItems(userId)
    : Promise.resolve(0);
  const proposalsPromise: Promise<RecurringProposal[]> = bankFed
    ? getRecurringProposals(userId, today)
    : Promise.resolve([]);

  const [pending, swallowed, proposals] = await Promise.all([
    pendingPromise,
    swallowedPromise,
    proposalsPromise,
  ]);

  /**
   * How many recurring charges are waiting to be written — counted, not
   * priced, and out of rows this function already had.
   *
   * This used to be `previewApplyRecurringForMonth(year, month)`, which
   * builds a whole plan: three more queries, and one live market quote per
   * quote-priced occurrence, on the landing page, on every load. Paid twice
   * when a stored arrangement's language differs from the request's and the
   * pack is gathered again, and a third time by `arrangeBearing`, which
   * reads none of it.
   *
   * The action row asks "how many", not "for how much". `templates`,
   * `monthTransactions` and `skippedKeys` are all already in hand above, so
   * the answer costs nothing beyond the loop — and it is a *better* answer:
   * a plan drops any occurrence whose quote could not be fetched, so the
   * old count fell silently when the market was unreachable.
   *
   * The `bankFed` gate is the one `previewApplyRecurringForMonth` applied
   * internally, restated here beside the other three that share it: with a
   * bank feeding the ledger, templates forecast and never write.
   */
  const recurringToApply = bankFed
    ? 0
    : countRecurringToApply(
        templates,
        new Set(
          monthTransactions.flatMap((tx) =>
            tx.recurring_template_id
              ? [
                  recurringOccurrenceKey(
                    tx.recurring_template_id,
                    tx.occurred_on,
                  ),
                ]
              : [],
          ),
        ),
        year,
        month,
        skippedKeys,
      );

  const packed = buildBearingFacts({
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

  return {
    ...packed,
    pulse,
    summary,
    closes,
    pendingInbox: pending.length,
    swallowed,
    proposals: proposals.length,
    recurringToApply,
  };
}
