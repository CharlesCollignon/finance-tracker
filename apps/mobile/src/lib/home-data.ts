import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { buildAttention, type AttentionItem } from "@finance/core/attention";
import {
  formatMonthLabel,
  getCurrentMonth,
  getMonthBounds,
  shiftMonth,
  todayIsoLocal,
} from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { WriterState } from "@finance/core/ai-models";
import {
  spendingByMonth,
  topSpending,
  type CategorySpend,
  type DayOutflows,
  type MonthBalance,
} from "@finance/core/month-balance";
import { previousMonthKey } from "@finance/core/month-close";
import { buildMonthComparison } from "@finance/core/month-comparison";
import type { MonthFacts } from "@finance/core/month-facts";
import { buildMonthPulse } from "@finance/core/month-pulse";
import type { ReadFreshness } from "@finance/core/month-read-budget";
import type { PurchaseToConfirm } from "@finance/core/purchases-to-confirm";
import type {
  TransferInvitation,
  TransferReminder,
} from "@finance/core/dca-need";
import {
  buildStillToCome,
  type UpcomingCharge,
} from "@finance/core/still-to-come";
import type { WeeklyRecap } from "@finance/core/weekly-recap";
import {
  readMonthBalance,
  type BalanceSource,
} from "@finance/data/month-balance";
import { getPurchasesToConfirm } from "@finance/data/purchases-to-confirm";
import { getTransferReminder } from "@finance/data/dca-transfer";
import { getTransferInvitation } from "@finance/data/dca-invite";
import { getWeeklyRecapCard } from "@finance/data/weekly-recap";

import {
  getMonthRead,
  monthFactsFromScreen,
  type MonthReadView,
} from "@/lib/month-read";
import { getWriterState } from "@/lib/ai-writer";
import {
  countPendingFeedItems,
  countSwallowedFeedItems,
  getBankForecast,
  getCategories,
  getFulfilledKeys,
  getFulfilmentProposals,
  getFulfilmentReport,
  getMonthCloseOverview,
  getMonthlySummary,
  getRecordedCashFlows,
  getRecurringProposals,
  getRecurringTemplates,
  getSkippedOccurrences,
  getTransactions,
  getWalletPortfolio,
  hasBankFeed,
  readCashBalance,
  type FulfilmentReport,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";

/**
 * Le point on the phone: one month, as the web's Bearing tells it.
 *
 * The twin of `apps/web/lib/bearing/month.ts`, gathered here rather than
 * asked of the web app for the reason the rest of the phone's reads give:
 * every table this touches is select-own under row level security, so the
 * rows come straight out of Supabase and no server of ours is in the path.
 * The balance is read by `@finance/data/month-balance`, as the web's is, and
 * the rest comes from the same engines in `packages/core`, so the two
 * clients draw the same curve over the same month.
 */

/** How many months the spending bars look back over, the month shown included. */
const TREND_MONTHS = 6;

export interface HomeMonth {
  year: number;
  month: number;
  today: string;
  balance: MonthBalance;
  /** What the balance is pinned to: the bank's statement, a close, or nothing. */
  source: BalanceSource;
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
  /** Still to come in this month; null for a month that has ended. */
  upcoming: {
    charges: UpcomingCharge[];
    leaving: number;
    arriving: number;
  } | null;
  /** What left the account, or is set to, day by day: the curve's markers. */
  outflows: DayOutflows[];
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
  /**
   * What to send to the broker for next month's DCAs, from three days before
   * payday until it is sent. The month in progress only.
   */
  transfer: TransferReminder | null;
  /**
   * The offer to let a transfer follow the DCAs, for someone whose DCAs no
   * transfer follows yet. The month in progress only.
   */
  transferInvite: TransferInvitation | null;
  /** Nothing recorded, nothing planned and no balance: a first visit. */
  empty: boolean;
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The skipped occurrences of one month, as the keys `buildStillToCome` takes. */
async function skipKeysFor(
  userId: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  const skipped = await getSkippedOccurrences(userId, year, month);
  return new Set(
    skipped.map((entry) =>
      recurringOccurrenceKey(entry.templateId, entry.occurredOn),
    ),
  );
}

/**
 * Everything Le point shows for one month.
 *
 * One month and not "today", because the question the screen answers is the
 * month's: what the account holds, where the month ends, and what it went
 * on. A past month answers it with what happened, a future one with what the
 * charges call for, and the month in progress with both, joined at today.
 *
 * The balance is `@finance/data/month-balance`'s, shared with the web's
 * Bearing and the overdraft warning, so all three draw the same curve.
 */
export async function gatherHomeMonth(
  userId: string,
  year: number,
  month: number,
  locale: Locale,
): Promise<HomeMonth> {
  const today = todayIsoLocal();
  const { start: first, end: last } = getMonthBounds(year, month);
  const period = last < today ? "past" : first > today ? "future" : "current";
  const isCurrent = period === "current";
  const previousMonth = shiftMonth(year, month, -1);

  const [templates, fulfilledKeys, closes, bankFed] = await Promise.all([
    getRecurringTemplates(userId),
    getFulfilledKeys(userId),
    getMonthCloseOverview(userId, today, locale),
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
  } = await readMonthBalance(supabase, userId, {
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

  let run: HomeMonth["run"] = null;
  let invested: number | null = null;
  let attention: AttentionItem[] = [];
  let arrived: FulfilmentReport | null = null;
  let purchases: PurchaseToConfirm[] = [];
  let transfer: TransferReminder | null = null;
  let transferInvite: TransferInvitation | null = null;

  if (isCurrent) {
    const categories = await getCategories(userId);
    const [report, portfolio, pending, swallowed, proposals, waitingPurchases] =
      await Promise.all([
        getFulfilmentReport(userId, templates, categories, year, month).catch(
          () => null,
        ),
        getWalletPortfolio(userId, locale, { includeHistory: false }),
        bankFed ? countPendingFeedItems(userId) : Promise.resolve(0),
        bankFed ? countSwallowedFeedItems(userId) : Promise.resolve(0),
        bankFed ? getRecurringProposals(userId, today) : Promise.resolve([]),
        bankFed
          ? getPurchasesToConfirm(supabase, userId, {
              templates,
              fulfilledKeys,
              debited,
              today,
            })
          : Promise.resolve([]),
      ]);
    arrived = report;
    purchases = waitingPurchases;
    [transfer, transferInvite] = await Promise.all([
      getTransferReminder(supabase, userId, today),
      getTransferInvitation(supabase, userId, today),
    ]);

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
      pendingInbox: pending,
      readyToClose: closes.next
        ? { monthLabel: closes.next.label, isBaseline: closes.next.isBaseline }
        : null,
      proposals: proposals.length,
    });
  }

  return {
    year,
    month,
    today,
    balance,
    source,
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
    arrived:
      arrived && arrived.proposals.length > 0
        ? arrived
        : null,
    purchases,
    transfer,
    transferInvite,
    empty:
      source === "none" &&
      rows.length === 0 &&
      templates.every((template) => !template.active),
  };
}

/* ------------------------------------------------------------ the read */

/** The stored month read, and everything its card needs to render it. */
export interface HomeRead {
  /** The month the read is about, so a screen can tell it from a stale one. */
  year: number;
  month: number;
  monthLabel: string;
  read: MonthReadView["read"] | null;
  freshness: ReadFreshness | null;
  /** The figures as they stand now, in the reader's language. */
  facts: MonthFacts;
  /** The same figures, labelled in the language the read was written in. */
  readFacts: MonthFacts;
  readLocale: Locale;
  writesLeft: number;
  /**
   * Who would write: Pluclair's key or the user's own AI account, whether a
   * read can be written now, and the name for the button. Which model wrote
   * a stored read is on the read itself.
   */
  writer: WriterState;
  readModel: string | null;
}

/**
 * The month read, gathered apart from the month's figures.
 *
 * Its fact pack is the slowest thing the screen asks for, so the web streams
 * it in behind its own boundary and the phone loads it on its own, after the
 * balance has drawn. The facts are the Month screen's — the same summary,
 * comparison, pulse and allowance the read was written against on either client —
 * so a read written on the web renders here against the same figures.
 */
export async function gatherHomeRead(
  userId: string,
  year: number,
  month: number,
  locale: Locale,
): Promise<HomeRead> {
  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;
  const previous = shiftMonth(year, month, -1);

  const [
    summary,
    closes,
    templates,
    categories,
    currentTx,
    previousTx,
    skipKeys,
    fulfilledKeys,
    portfolio,
    inboxPending,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, "current"),
    getMonthCloseOverview(userId, today, locale),
    getRecurringTemplates(userId),
    getCategories(userId),
    getTransactions(userId, year, month),
    getTransactions(userId, previous.year, previous.month),
    skipKeysFor(userId, year, month),
    getFulfilledKeys(userId),
    getWalletPortfolio(userId, locale, { includeHistory: false }),
    countPendingFeedItems(userId),
  ]);

  // Only a month in progress has a live pulse — a past month's balance is a
  // figure from a moment that has gone.
  let pulse: ReturnType<typeof buildMonthPulse> | null = null;
  if (isCurrentMonth) {
    const [cash, flows, bank] = await Promise.all([
      readCashBalance(userId, today),
      getRecordedCashFlows(userId, year, month),
      hasBankFeed(userId).then((bankFed) =>
        getBankForecast(userId, templates, bankFed, today),
      ),
    ]);
    const upcoming = buildStillToCome(
      currentTx,
      templates,
      year,
      month,
      today,
      skipKeys,
      fulfilledKeys,
      bank,
    );
    const latest = closes.history[0];
    pulse = buildMonthPulse({
      onHand: cash?.ok ? cash.total : null,
      committed: upcoming.leaving,
      arriving: upcoming.arriving,
      flows,
      openingBalance:
        latest && latest.monthKey === previousMonthKey(monthKeyOf(year, month))
          ? latest.closingBalance
          : null,
      cap: closes.settings.unrecordedCap,
    });
  }

  const chargesUnconfirmed = await getFulfilmentProposals(
    userId,
    templates,
    categories,
    year,
    month,
  ).then(
    (proposals) => proposals.length,
    () => 0,
  );

  const factsInput = {
    year,
    month,
    isCurrentMonth,
    summary,
    comparison: buildMonthComparison({
      current: currentTx,
      previous: previousTx,
      year,
      month,
      today,
      locale,
    }),
    closes,
    pulse,
    investedValue: portfolio.totalMarketValue,
    inboxPending,
    chargesUnconfirmed,
  };

  const facts = monthFactsFromScreen({ ...factsInput, locale });

  let stored: Awaited<ReturnType<typeof getMonthRead>> = {
    view: null,
    writesLeft: 0,
    tracked: false,
  };
  const writerState = getWriterState(userId);
  try {
    stored = await getMonthRead(userId, year, month, facts, locale);
  } catch {
    // A read that could not be fetched is not a reason to lose the card.
  }

  // A read stays in the language it was written in, so its figures have to
  // be labelled in that language too.
  const readLocale = stored.view?.locale ?? locale;
  const readFacts =
    readLocale === locale
      ? facts
      : monthFactsFromScreen({ ...factsInput, locale: readLocale });

  return {
    year,
    month,
    monthLabel: formatMonthLabel(year, month, locale),
    read: stored.view?.read ?? null,
    freshness: stored.view?.freshness ?? null,
    facts,
    readFacts,
    readLocale,
    writesLeft: stored.writesLeft,
    writer: await writerState.catch(() => ({
      account: false,
      writable: false,
      name: "",
    })),
    readModel: stored.view?.model ?? null,
  };
}

/**
 * The week's recap card, early in the week, until it is put away; null on
 * the other days. Loaded on its own, like the read: it reads a year of rows
 * for each category's normal month, and the balance should not wait on it.
 */
export function gatherHomeRecap(
  userId: string,
  locale: Locale,
): Promise<WeeklyRecap | null> {
  return getWeeklyRecapCard(supabase, userId, todayIsoLocal(), locale);
}
