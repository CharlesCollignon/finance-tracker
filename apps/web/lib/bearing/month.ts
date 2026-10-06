import { createClient } from "@/lib/supabase/server";
import { getRecurringTemplates } from "@/lib/queries/finance";
import {
  getFulfilledKeys,
  getFulfilmentReport,
  type FulfilmentReport,
} from "@/lib/queries/fulfilment";
import { getCategories } from "@/lib/queries/categories";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import {
  countSwallowedFeedItems,
  getPendingFeedItems,
  getRecurringProposals,
  hasBankFeed,
} from "@/lib/queries/bank";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getLocale } from "@/lib/locale";
import { buildAttention, type AttentionItem } from "@finance/core/attention";
import {
  formatMonthLabel,
  getMonthBounds,
  shiftMonth,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  spendingByMonth,
  topSpending,
  type CategorySpend,
  type DayOutflows,
  type MonthBalance,
} from "@finance/core/month-balance";
import type { PurchaseToConfirm } from "@finance/core/purchases-to-confirm";
import type { UpcomingCharge } from "@finance/core/still-to-come";
import {
  readMonthBalance,
  type BalanceSource,
} from "@finance/data/month-balance";
import { getPurchasesToConfirm } from "@finance/data/purchases-to-confirm";

/** How many months the spending bars look back over, the month shown included. */
const TREND_MONTHS = 6;

export interface BearingMonth {
  year: number;
  month: number;
  today: string;
  balance: MonthBalance;
  /** What the balance is pinned to: the bank's statement, a close, or nothing. */
  source: BalanceSource;
  /** Recorded this month. */
  income: number;
  spent: {
    total: number;
    /**
     * Last month at the same point: its whole month for a month that has
     * ended, and up to today's day of the month for this one — comparing
     * three weeks against four would make every month look like a win.
     */
    previous: number | null;
    trend: { monthKey: string; label: string; total: number }[];
  };
  spending: {
    top: CategorySpend[];
    rest: number;
    total: number;
  };
  /** What left the account, or is set to, day by day: the curve's markers. */
  outflows: DayOutflows[];
  /** Still to come in this month; null for a month that has ended. */
  upcoming: {
    charges: UpcomingCharge[];
    leaving: number;
    arriving: number;
  } | null;
  /** The month in progress only — the run and wallets are about now. */
  run: { streak: number; best: number } | null;
  invested: number | null;
  attention: AttentionItem[];
  /**
   * Movements that look like a charge that has arrived, waiting for a yes or
   * a no. The month in progress only: it is the one whose forecast a salary
   * already paid would otherwise count a second time.
   */
  arrived: FulfilmentReport | null;
  /**
   * Purchases inside a wallet whose day has come, waiting for the user to say
   * whether they went through. The month in progress, with a bank feeding
   * the ledger, only: without one they are written on their day.
   */
  purchases: PurchaseToConfirm[];
  /** Nothing recorded, nothing planned and no balance: a first visit. */
  empty: boolean;
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Everything the Bearing shows for one month.
 *
 * One month and not "today", because the question the screen answers is the
 * month's: what the account holds, where the month ends, and what it went
 * on. A past month answers it with what happened, a future one with what the
 * charges call for, and the month in progress with both, joined at today.
 *
 * The balance is `@finance/data/month-balance`'s, shared with the phone's
 * Le point and the overdraft warning, so all three draw the same curve.
 */
export async function gatherBearingMonth(
  userId: string,
  year: number,
  month: number,
): Promise<BearingMonth> {
  const today = todayIsoLocal();
  const { start: first, end: last } = getMonthBounds(year, month);
  const period = last < today ? "past" : first > today ? "future" : "current";
  const isCurrent = period === "current";
  const previousMonth = shiftMonth(year, month, -1);
  const locale = await getLocale();

  const [templates, fulfilledKeys, closes, bankFed] = await Promise.all([
    getRecurringTemplates(userId),
    getFulfilledKeys(userId),
    getMonthCloseOverview(userId, today),
    hasBankFeed(userId),
  ]);

  /* ----------------------------------------------- the balance and rows */

  // The months the spending bars look back over, read with the balance's
  // own range in one pass.
  const trendFrom = shiftMonth(year, month, -(TREND_MONTHS - 1));
  const {
    balance,
    source,
    rows,
    upcoming: shownUpcoming,
    outflows,
    debited,
  } = await readMonthBalance(await createClient(), userId, {
    year,
    month,
    today,
    templates,
    fulfilledKeys,
    closes,
    bankFed,
    readFrom: getMonthBounds(trendFrom.year, trendFrom.month).start,
  });

  /* ------------------------------------------------------- the spending */

  const inMonth = rows.filter(
    (tx) => tx.occurred_on >= first && tx.occurred_on <= last,
  );
  const trendKeys = Array.from({ length: TREND_MONTHS }, (_, index) => {
    const at = shiftMonth(year, month, index - (TREND_MONTHS - 1));
    return { ...at, key: monthKeyOf(at.year, at.month) };
  });
  const byMonth = spendingByMonth(
    rows,
    trendKeys.map((entry) => entry.key),
  );
  const previousKey = monthKeyOf(previousMonth.year, previousMonth.month);
  const sameDay = today.slice(8, 10);
  const previousSoFar = isCurrent
    ? spendingByMonth(
        rows.filter((tx) => tx.occurred_on.slice(8, 10) <= sameDay),
        [previousKey],
      ).get(previousKey)
    : byMonth.get(previousKey);

  const spending = topSpending(inMonth, 4);

  /* --------------------------------------- what only the present has */

  let run: BearingMonth["run"] = null;
  let invested: number | null = null;
  let attention: AttentionItem[] = [];
  let arrived: FulfilmentReport | null = null;
  let purchases: PurchaseToConfirm[] = [];

  if (isCurrent) {
    const categories = await getCategories(userId);
    arrived = await getFulfilmentReport(
      userId,
      templates,
      categories,
      year,
      month,
    );
    const [portfolio, pending, swallowed, proposals, waitingPurchases] =
      await Promise.all([
        getWalletPortfolio(userId, { includeHistory: false }),
        bankFed ? getPendingFeedItems(userId, locale) : Promise.resolve([]),
        bankFed ? countSwallowedFeedItems(userId) : Promise.resolve(0),
        bankFed ? getRecurringProposals(userId, today) : Promise.resolve([]),
        bankFed
          ? getPurchasesToConfirm(await createClient(), userId, {
              templates,
              fulfilledKeys,
              debited,
              today,
            })
          : Promise.resolve([]),
      ]);
    purchases = waitingPurchases;

    if (closes.summary.sample > 0) {
      run = {
        streak: closes.summary.streak,
        best: closes.summary.bestStreak,
      };
    }

    const total = portfolio.columns.reduce(
      (sum, column) => sum + column.totalMarketValue,
      0,
    );
    invested = total > 0 ? total : null;

    attention = buildAttention({
      swallowed,
      pendingInbox: pending.length,
      readyToClose: closes.next
        ? { monthLabel: closes.next.label, isBaseline: closes.next.isBaseline }
        : null,
      proposals: proposals.length,
    });
  }

  const income = inMonth
    .filter((tx) => tx.categories.type === "income" && tx.occurred_on <= today)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  return {
    year,
    month,
    today,
    balance,
    source,
    income,
    spent: {
      total: byMonth.get(monthKeyOf(year, month)) ?? 0,
      previous: previousSoFar ?? null,
      trend: trendKeys.map((entry) => ({
        monthKey: entry.key,
        label: formatMonthLabel(entry.year, entry.month, locale),
        total: byMonth.get(entry.key) ?? 0,
      })),
    },
    spending: {
      top: spending.top,
      rest: spending.rest,
      total: spending.total,
    },
    upcoming: shownUpcoming,
    outflows,
    run,
    invested,
    attention,
    arrived: arrived && arrived.proposals.length > 0 ? arrived : null,
    purchases,
    empty:
      source === "none" &&
      rows.length === 0 &&
      templates.every((template) => !template.active),
  };
}
