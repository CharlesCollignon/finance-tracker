import { createClient } from "@/lib/supabase/server";
import {
  getRecurringSkipKeys,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import {
  getFulfilledKeys,
  getFulfilmentReport,
  type FulfilmentReport,
} from "@/lib/queries/fulfilment";
import { getCategories } from "@/lib/queries/categories";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { readCashBalance } from "@/lib/queries/bank-balance";
import {
  countSwallowedFeedItems,
  getPendingFeedItems,
  getRecurringProposals,
  hasBankFeed,
} from "@/lib/queries/bank";
import {
  getBudgets,
  getGoalLedger,
  getSavingsGoals,
} from "@/lib/queries/phase4";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getLocale } from "@/lib/locale";
import { buildAttention, type AttentionItem } from "@finance/core/attention";
import {
  formatMonthLabel,
  getCurrentMonth,
  getMonthBounds,
  shiftIsoDate,
  shiftMonth,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  buildMonthBalance,
  spendingByMonth,
  topSpending,
  transactionDelta,
  upcomingDelta,
  type BalanceAnchor,
  type CategorySpend,
  type DatedDelta,
  type MonthBalance,
} from "@finance/core/month-balance";
import {
  buildStillToCome,
  type UpcomingCharge,
} from "@finance/core/still-to-come";
import {
  buildGoalRunningTotals,
  buildSavingsGoalProgress,
  earliestGoalStart,
  EMPTY_GOAL_LEDGER,
} from "@finance/core/savings-goals";
import type { TransactionWithCategory } from "@finance/core/types/database";

/** How many months the spending bars look back over, the month shown included. */
const TREND_MONTHS = 6;

export interface BearingMonth {
  year: number;
  month: number;
  today: string;
  balance: MonthBalance;
  /** What the balance is pinned to: the bank's statement, a close, or nothing. */
  source: "bank" | "close" | "none";
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
    /** The cap on all spending, when one is set. */
    cap: number | null;
    trend: { monthKey: string; label: string; total: number }[];
  };
  spending: {
    top: (CategorySpend & { cap: number | null })[];
    rest: number;
    total: number;
  };
  /** Still to come in this month; null for a month that has ended. */
  upcoming: {
    charges: UpcomingCharge[];
    leaving: number;
    arriving: number;
  } | null;
  /** The month in progress only — goals, the run and wallets are about now. */
  goals: {
    id: string;
    name: string;
    saved: number;
    target: number;
    ratio: number;
  }[];
  run: { streak: number; best: number } | null;
  invested: number | null;
  attention: AttentionItem[];
  /**
   * Movements that look like a charge that has arrived, waiting for a yes or
   * a no. The month in progress only: it is the one whose forecast a salary
   * already paid would otherwise count a second time.
   */
  arrived: FulfilmentReport | null;
  /** Nothing recorded, nothing planned and no balance: a first visit. */
  empty: boolean;
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Every transaction dated in a range, however many months it spans. */
async function getTransactionsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<TransactionWithCategory[]> {
  if (from > to) {
    return [];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as TransactionWithCategory[];
}

/**
 * Everything the Bearing shows for one month.
 *
 * One month and not "today", because the question the screen answers is the
 * month's: what the account holds, where the month ends, and what it went
 * on. A past month answers it with what happened, a future one with what the
 * charges call for, and the month in progress with both, joined at today.
 *
 * The balance is only ever carried from something read — the bank's
 * statement, or the close of the month before — and never from further back,
 * for the reason the Month pulse gives: a balance measured against movements
 * from a different window says nothing about either.
 */
export async function gatherBearingMonth(
  userId: string,
  year: number,
  month: number,
): Promise<BearingMonth> {
  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const { start: first, end: last } = getMonthBounds(year, month);
  const period = last < today ? "past" : first > today ? "future" : "current";
  const isCurrent = period === "current";
  const previousMonth = shiftMonth(year, month, -1);
  const locale = await getLocale();

  const [templates, fulfilledKeys, closes, bankFed, budgets] =
    await Promise.all([
      getRecurringTemplates(userId),
      getFulfilledKeys(userId),
      getMonthCloseOverview(userId, today),
      hasBankFeed(userId),
      getBudgets(userId),
    ]);

  /* ------------------------------------------------------------ the anchor */

  let anchor: BalanceAnchor | null = null;
  let source: BearingMonth["source"] = "none";

  if (bankFed) {
    const onDate = period === "past" ? last : today;
    const cash = await readCashBalance(userId, onDate);
    // A reading short of an account is short by whatever it holds: not a
    // balance, and not something to carry.
    if (cash?.ok) {
      anchor = { onDate, balance: cash.total };
      source = "bank";
    }
  }

  if (!anchor) {
    const closeOf = (key: string) =>
      closes.history.find((row) => row.monthKey === key);
    // Carried forward from the close of the month before the one the
    // balance starts in — the month shown, or this one for a month ahead.
    const opensFrom =
      period === "future"
        ? shiftMonth(current.year, current.month, -1)
        : previousMonth;
    const before = closeOf(monthKeyOf(opensFrom.year, opensFrom.month));
    const own = period === "past" ? closeOf(monthKeyOf(year, month)) : null;
    if (before) {
      anchor = {
        onDate: getMonthBounds(opensFrom.year, opensFrom.month).end,
        balance: before.closingBalance,
      };
      source = "close";
    } else if (own) {
      anchor = { onDate: last, balance: own.closingBalance };
      source = "close";
    }
  }

  /* ------------------------------------------------------- the movements */

  // Every day between the anchor and the month shown has to be accounted
  // for, recorded or planned, or the balance drifts by what was missed.
  const rangeStart =
    anchor && shiftIsoDate(anchor.onDate, 1) < first
      ? shiftIsoDate(anchor.onDate, 1)
      : first;
  const rangeEnd = anchor && anchor.onDate > last ? anchor.onDate : last;
  const trendFrom = shiftMonth(year, month, -(TREND_MONTHS - 1));
  const trendStart = getMonthBounds(trendFrom.year, trendFrom.month).start;

  const rows = await getTransactionsBetween(
    userId,
    rangeStart < trendStart ? rangeStart : trendStart,
    rangeEnd,
  );

  const recorded: DatedDelta[] = rows
    .filter((tx) => tx.occurred_on >= rangeStart && tx.occurred_on <= today)
    .map((tx) => ({ date: tx.occurred_on, delta: transactionDelta(tx) }));

  // What the charges still call for, month by month from this one to the
  // end of the range — never a month that has ended.
  const planned: DatedDelta[] = [];
  let shownUpcoming: BearingMonth["upcoming"] = null;
  if (rangeEnd > today) {
    let cursor = { year: current.year, month: current.month };
    while (monthKeyOf(cursor.year, cursor.month) <= rangeEnd.slice(0, 7)) {
      const key = monthKeyOf(cursor.year, cursor.month);
      const skipped = await getRecurringSkipKeys(
        userId,
        cursor.year,
        cursor.month,
      );
      const upcoming = buildStillToCome(
        rows.filter((tx) => tx.occurred_on.startsWith(key)),
        templates,
        cursor.year,
        cursor.month,
        today,
        skipped,
        fulfilledKeys,
      );
      for (const charge of [...upcoming.outgoing, ...upcoming.incoming]) {
        planned.push({ date: charge.occurredOn, delta: upcomingDelta(charge) });
      }
      if (cursor.year === year && cursor.month === month) {
        shownUpcoming = {
          charges: [...upcoming.outgoing, ...upcoming.incoming].sort((a, b) =>
            a.occurredOn.localeCompare(b.occurredOn),
          ),
          leaving: upcoming.leaving,
          arriving: upcoming.arriving,
        };
      }
      cursor = shiftMonth(cursor.year, cursor.month, 1);
    }
  }

  const balance = buildMonthBalance({
    year,
    month,
    today,
    anchor,
    recorded,
    planned,
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
  const capByCategory = new Map(
    budgets
      .filter((budget) => budget.category_id !== null)
      .map((budget) => [budget.category_id!, Number(budget.amount)]),
  );
  const overallCap = budgets.find((budget) => budget.category_id === null);

  /* --------------------------------------- what only the present has */

  let goals: BearingMonth["goals"] = [];
  let run: BearingMonth["run"] = null;
  let invested: number | null = null;
  let attention: AttentionItem[] = [];
  let arrived: FulfilmentReport | null = null;

  if (isCurrent) {
    const [savingsGoals, categories] = await Promise.all([
      getSavingsGoals(userId),
      getCategories(userId),
    ]);
    arrived = await getFulfilmentReport(
      userId,
      templates,
      categories,
      year,
      month,
    );
    const goalStart = earliestGoalStart(savingsGoals);
    const [goalLedger, portfolio, pending, swallowed, proposals] =
      await Promise.all([
        goalStart
          ? getGoalLedger(userId, goalStart, today)
          : Promise.resolve(EMPTY_GOAL_LEDGER),
        getWalletPortfolio(userId, { includeHistory: false }),
        bankFed ? getPendingFeedItems(userId, locale) : Promise.resolve([]),
        bankFed ? countSwallowedFeedItems(userId) : Promise.resolve(0),
        bankFed ? getRecurringProposals(userId, today) : Promise.resolve([]),
      ]);

    goals = buildSavingsGoalProgress(
      savingsGoals,
      buildGoalRunningTotals(savingsGoals, goalLedger, templates, today),
    )
      .filter((row) => !row.complete)
      .slice(0, 3)
      .map((row) => ({
        id: row.goal.id,
        name: row.goal.name,
        saved: row.saved,
        target: Number(row.goal.target_amount),
        ratio: row.ratio,
      }));

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
      cap: overallCap ? Number(overallCap.amount) : null,
      trend: trendKeys.map((entry) => ({
        monthKey: entry.key,
        label: formatMonthLabel(entry.year, entry.month, locale),
        total: byMonth.get(entry.key) ?? 0,
      })),
    },
    spending: {
      top: spending.top.map((entry) => ({
        ...entry,
        cap: capByCategory.get(entry.categoryId) ?? null,
      })),
      rest: spending.rest,
      total: spending.total,
    },
    upcoming: shownUpcoming,
    goals,
    run,
    invested,
    attention,
    arrived:
      arrived && (arrived.proposals.length > 0 || arrived.misses.length > 0)
        ? arrived
        : null,
    empty:
      anchor === null &&
      rows.length === 0 &&
      templates.every((template) => !template.active),
  };
}
