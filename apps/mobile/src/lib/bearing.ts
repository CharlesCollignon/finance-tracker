import { buildAllocation } from "@finance/core/allocation";
import { buildBearing } from "@finance/core/bearing";
import {
  buildBearingFacts,
  type BearingFacts,
} from "@finance/core/bearing-facts";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { buildFundCosts } from "@finance/core/fund-costs";
import { buildInvestmentReturns } from "@finance/core/investment-returns";
import { buildWalletFundingNeeds } from "@finance/core/investment-upcoming";
import { buildMonthComparison } from "@finance/core/month-comparison";
import { buildMonthPulse, type MonthPulse } from "@finance/core/month-pulse";
import { previousMonthKey } from "@finance/core/month-close";
import { buildForwardProjection, buildRunway } from "@finance/core/projection";
import { buildStillToCome } from "@finance/core/still-to-come";
import type { MonthlySummary } from "@finance/core/types/database";
import type { Locale } from "@finance/core/i18n/locale";

import {
  countPendingFeedItems,
  countSwallowedFeedItems,
  getFulfilledKeys,
  getInvestmentTransactions,
  getMonthCloseOverview,
  getMonthlySummary,
  getMonthlyTrend,
  getRecurringProposals,
  getRecurringTemplates,
  getSavingsReserve,
  getSkippedOccurrences,
  getTransactions,
  getWalletPlans,
  getWalletPortfolio,
  hasBankFeed,
  readCashBalance,
  type MonthCloseOverview,
} from "@/lib/queries";
import {
  countRecurringToApply,
  recurringOccurrenceKey,
} from "@finance/core/apply-recurring";

/**
 * The Bearing on the phone.
 *
 * No server of ours in the path. Every table this reads is select-own under
 * row level security, so the rows come straight out of Supabase like every
 * other query — the screen still works with the network to the web app down,
 * because there is no longer any call to it to fail. There used to be two:
 * arranging posted to `/api/bearing` because `MISTRAL_API_KEY` lives in the
 * web server's environment and must never reach a phone, and saving pins went
 * the same way so that one validation stood between every client and the
 * column. Both went with the arrangement itself; the route they called is
 * deleted.
 *
 * The fact pack is gathered here rather than mapped off the screen, which is
 * the opposite of what `month-read.ts` does and worth saying why. A month
 * read's figures are the ones rendered above it on the same screen, so
 * mapping them is what guarantees they agree. The Bearing's figures *are* the
 * screen, so there is nothing above to agree with — and gathering them in one
 * place means the phone and the web app run the same assembly over the same
 * engines.
 */

/**
 * `BearingFacts`, widened with the raw figures the spine and its action row
 * need but a fact pack has no id for.
 *
 * The web twin in `apps/web/lib/bearing/facts.ts` widens `GatheredBearingFacts`
 * the same way and for the same reason: `pulse`, `summary` and `closes` were
 * already computed here and fed into `buildBearingFacts` before being thrown
 * away. `swallowed` and `proposals` are the two new reads — see the gate
 * below for why each is necessary, and for why `recurringToApply` is
 * counted out of rows already in hand rather than read at all.
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
  /**
   * Net per month, oldest first, for the two figures that draw a run behind
   * themselves.
   *
   * Exposed for the same reason `pulse` and `summary` are: it was already
   * read here and fed into `buildBearingFacts` before being thrown away, and
   * the alternative — asking the screen to call `getMonthlyTrend` itself —
   * is a second round trip over a phone's network for rows this function is
   * already holding. The web page does make that second call, but there it
   * is a query on the same machine as the database.
   */
  trend: number[];
}

export async function gatherBearingFacts(
  userId: string,
  locale: Locale,
): Promise<GatheredBearingFacts> {
  const today = todayIsoLocal();
  const { year, month } = getCurrentMonth();
  const [previousYear, previousMonthNumber] = previousMonthOf(year, month);

  const [
    summary,
    closes,
    templates,
    currentTx,
    previousTx,
    skipped,
    fulfilledKeys,
    portfolio,
    plans,
    investmentTransactions,
    trend,
    reserve,
    bankFed,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, "current"),
    getMonthCloseOverview(userId, today),
    getRecurringTemplates(userId),
    getTransactions(userId, year, month),
    getTransactions(userId, previousYear, previousMonthNumber),
    getSkippedOccurrences(userId, year, month),
    getFulfilledKeys(userId),
    getWalletPortfolio(userId),
    getWalletPlans(userId),
    getInvestmentTransactions(userId),
    getMonthlyTrend(userId),
    getSavingsReserve(userId),
    hasBankFeed(userId),
  ]);

  // `swallowed` and `proposals` only mean anything with a bank feeding the
  // ledger: a CSV-only user has no feed rows to swallow and no statement to
  // detect a standing charge from, which is why both stay behind the same
  // `bankFed` gate `pending` already used.
  const [cash, pending, swallowed, proposals] = await Promise.all([
    readCashBalance(userId, today),
    bankFed ? countPendingFeedItems(userId) : Promise.resolve(0),
    bankFed ? countSwallowedFeedItems(userId) : Promise.resolve(0),
    bankFed ? getRecurringProposals(userId, today) : Promise.resolve([]),
  ]);

  const skippedKeys = new Set(
    skipped.map((entry) =>
      recurringOccurrenceKey(entry.templateId, entry.occurredOn),
    ),
  );

  /**
   * How many recurring charges are waiting to be written — counted, not
   * priced. The web twin carries the full reasoning; in short, this was
   * `previewApplyRecurringForMonth`, which builds a whole plan and pays one
   * live market quote per quote-priced occurrence to do it, on the screen
   * the app opens on. The action row asks how many, not for how much, and
   * `templates`, `currentTx` and `skipped` are all already read above.
   *
   * The `bankFed` gate is the one that function applied internally: with a
   * bank feeding the ledger, templates forecast and never write.
   */
  const recurringToApply = bankFed
    ? 0
    : countRecurringToApply(
        templates,
        new Set(
          currentTx.flatMap((tx) =>
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

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  // The same adjacency rule every other surface uses: only the close of the
  // month immediately before can be measured from, or the arithmetic compares
  // a balance against transactions from a different window.
  const latest = closes.history[0];
  const openingBalance =
    latest && latest.monthKey === previousMonthKey(monthKey)
      ? latest.closingBalance
      : null;

  const upcoming = buildStillToCome(
    currentTx,
    templates,
    year,
    month,
    today,
    skippedKeys,
    fulfilledKeys,
  );

  const onHand = cash?.ok ? cash.total : null;

  const pulse = buildMonthPulse({
    onHand,
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

  const planByWallet = new Map(plans.map((plan) => [plan.wallet, plan]));

  const packed = buildBearingFacts({
    asOf: today,
    bearing: buildBearing({
      onHand,
      positions: portfolio.columns.flatMap((column) =>
        column.items.map((item) => ({
          name: item.name,
          marketValue: item.marketValue,
        })),
      ),
    }),
    pulse,
    summary,
    comparison: buildMonthComparison({
      current: currentTx,
      previous: previousTx,
      year,
      month,
      today,
      locale,
    }),
    closeSummary: closes.summary,
    unrecordedCap: closes.settings.unrecordedCap,
    projection: buildForwardProjection({
      templates,
      year,
      month,
      today,
      months: 12,
      // Never a partial sum: a reading missing an account is short by
      // whatever that account holds, so it is not a balance.
      onHand: cash?.ok ? cash.total : null,
      closes: closes.summary,
      locale,
    }),
    runway: buildRunway(reserve, templates, year, month),
    trend: trend.map((point) => point.net),
    returns: buildInvestmentReturns(investmentTransactions, portfolio, today),
    allocation: buildAllocation(
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
    ),
    costs: buildFundCosts(
      portfolio.columns.flatMap((column) =>
        column.items.map((item) => ({
          positionId: item.id,
          name: item.name,
          walletId: item.walletId,
          marketValue: item.marketValue,
          ongoingCharge: item.ongoingCharge,
        })),
      ),
    ),
    contributionPace: buildWalletFundingNeeds(
      templates.filter((template) => template.categories.type === "investment"),
      year,
      month,
    ).reduce((sum, need) => sum + need.monthlyTotal, 0),
    inboxPending: pending,
    locale,
  });

  return {
    ...packed,
    pulse,
    summary,
    closes,
    pendingInbox: pending,
    swallowed,
    proposals: proposals.length,
    recurringToApply,
    trend: trend.map((point) => point.net),
  };
}

function previousMonthOf(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}
