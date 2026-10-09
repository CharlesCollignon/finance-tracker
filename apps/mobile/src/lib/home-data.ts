import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import {
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
  todayIsoLocal,
} from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { WriterState } from "@finance/core/ai-models";
import { previousMonthKey } from "@finance/core/month-close";
import { buildMonthComparison } from "@finance/core/month-comparison";
import type { MonthFacts } from "@finance/core/month-facts";
import { buildMonthPulse } from "@finance/core/month-pulse";
import type { ReadFreshness } from "@finance/core/month-read-budget";
import { buildStillToCome } from "@finance/core/still-to-come";
import type { WeeklyRecap } from "@finance/core/weekly-recap";
import {
  readBearingMonth,
  type BearingMonth,
} from "@finance/data/bearing-month";
import { getWeeklyRecapCard } from "@finance/data/weekly-recap";

import {
  getMonthRead,
  monthFactsFromScreen,
  type MonthReadView,
} from "@/lib/month-read";
import { getWriterState } from "@/lib/ai-writer";
import {
  countPendingFeedItems,
  getBankForecast,
  getCategories,
  getFulfilledKeys,
  getFulfilmentProposals,
  getMonthCloseOverview,
  getMonthlySummary,
  getRecordedCashFlows,
  getRecurringTemplates,
  getSkippedOccurrences,
  getTransactions,
  getWalletPortfolio,
  hasBankFeed,
  readCashBalance,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";

/**
 * Le point on the phone: one month, as the web's Bearing tells it.
 *
 * The month itself is `@finance/data/bearing-month`, the gathering the web
 * runs too, read straight out of Supabase: every table it touches is
 * select-own under row level security, so no server of ours is in the path.
 * The read and the recap below are the phone's own.
 */

export type HomeMonth = BearingMonth;

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

/** Everything Le point shows for one month (`readBearingMonth`). */
export function gatherHomeMonth(
  userId: string,
  year: number,
  month: number,
  locale: Locale,
  /**
   * « Avec ma part du commun »: whether the spending counts the person's
   * part of their shared space (6b). Null where it is not offered — no
   * space, or the space itself on screen.
   */
  myShare: boolean | null = null,
): Promise<HomeMonth> {
  return readBearingMonth(supabase, userId, {
    year,
    month,
    today: todayIsoLocal(),
    locale,
    myShare,
    investedValue: async () => {
      const portfolio = await getWalletPortfolio(userId, locale, {
        includeHistory: false,
      });
      return portfolio.columns.reduce(
        (sum, column) => sum + column.totalMarketValue,
        0,
      );
    },
  });
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
   * Who would write — the user's own AI account, or nobody — whether a
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
  /** Whose month: the person's, or their space's. */
  userId: string,
  year: number,
  month: number,
  locale: Locale,
  /** Whose AI account would write it: the person asking, in « Commun » too. */
  writerId: string = userId,
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
  const writerState = getWriterState(writerId);
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
