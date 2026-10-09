import { buildAttention, type AttentionItem } from "@finance/core/attention";
import {
  formatMonthLabel,
  getMonthBounds,
  shiftMonth,
} from "@finance/core/constants";
import type { DcaMonth } from "@finance/core/dca-need";
import type { Locale } from "@finance/core/i18n/locale";
import { payTemplate, type LeftToSpend } from "@finance/core/left-to-spend";
import {
  spendingByMonth,
  topSpending,
  type CategorySpend,
  type DayOutflows,
  type MonthBalance,
} from "@finance/core/month-balance";
import { withMyShare } from "@finance/core/my-share";
import type { PurchaseToConfirm } from "@finance/core/purchases-to-confirm";
import type { FulfilmentProposal } from "@finance/core/recurring-fulfilment";
import { rollUpRecurring } from "@finance/core/recurring-rollup";
import { firstCloseDay, type SetupFacts } from "@finance/core/setup-steps";
import type { UpcomingCharge } from "@finance/core/still-to-come";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { reviewedYear, yearReviewPrompt } from "@finance/core/year-review";

import { hasBankFeed } from "./bank-feed";
import {
  countPendingFeedItems,
  countSwallowedFeedItems,
  getRecurringProposals,
} from "./bank-inbox";
import { getCategories } from "./categories";
import type { Db } from "./client";
import { getDcaMonth } from "./dca-transfer";
import {
  getFulfilledKeys,
  getFulfilmentReport,
  type FulfilmentReport,
} from "./fulfilment";
import { readLeftToSpend } from "./left-to-spend";
import {
  readMonthBalance,
  type BalanceSource,
  type MonthBalanceRead,
} from "./month-balance";
import { getMonthCloseOverview } from "./month-close";
import { readDismissedPrompts } from "./preferences";
import { getPurchasesToConfirm } from "./purchases-to-confirm";
import { readMyShare } from "./spaces";
import { getRecurringTemplates } from "./templates";

/**
 * Le point for one month, for both apps: the web's Bearing
 * (`apps/web/lib/bearing/month.ts`) and the phone's (`lib/home-data.ts`)
 * were the same gathering written twice, and now hand this their client.
 *
 * The one thing each app reads its own way is what the wallets are worth —
 * priced on the web's server, through the web's route on the phone — so it
 * is handed in (`investedValue`), and asked only for the month in progress.
 */

/** How many months the spending bars look back over, the month shown included. */
const TREND_MONTHS = 6;

export interface BearingMonth {
  year: number;
  month: number;
  today: string;
  balance: MonthBalance;
  /** What the balance is pinned to: the bank's statement, a close, or nothing. */
  source: BalanceSource;
  /** With several current accounts, what each held: the balance taken apart. */
  accounts: MonthBalanceRead["accounts"];
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
  /**
   * « Avec ma part du commun », for someone in a shared space under « Moi »:
   * whether the spending above counts their part of the space, and that
   * part. Null where it is not offered.
   */
  myShare: { on: boolean; part: number | null } | null;
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
  /**
   * The DCA card (`dcaMonth`): the month the transfer to the broker pays
   * for, whether it was sent, its DCAs going through, the months funded in a
   * row. The month in progress only.
   */
  dca: DcaMonth | null;
  /**
   * The bank's movement that looks like that transfer, confirmed on the card
   * and so left out of `arrived`.
   */
  dcaProposal: FulfilmentProposal | null;
  /**
   * « Il vous reste »: what the account can still give before the next pay
   * day. The month in progress with a balance only.
   */
  left: LeftToSpend | null;
  /**
   * « Reste chaque mois »: what a month's income leaves once its recurring
   * charges are out (`rollUpRecurring`), for « Puis-je me permettre ? ».
   * Null without a recurring income, and outside the month in progress.
   */
  eachMonth: number | null;
  /**
   * What Le point's setup cards ask about (`nextSetupStep`), all but the bank
   * invitation, which the page decides. The month in progress only.
   */
  setup: (Omit<SetupFacts, "bankInvited"> & { firstCloseOn: string }) | null;
  /**
   * The year « Votre année » is ready for, in January until « Vu »; null
   * otherwise. The month in progress only.
   */
  yearReady: number | null;
  /** Any recurring template active: without one, nothing is ever to come. */
  recurring: boolean;
  /** Nothing recorded, nothing planned and no balance: a first visit. */
  empty: boolean;
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Everything Le point shows for one month.
 *
 * One month and not "today", because the question the screen answers is the
 * month's: what the account holds, where the month ends, and what it went
 * on. A past month answers it with what happened, a future one with what the
 * charges call for, and the month in progress with both, joined at today.
 *
 * The balance is `./month-balance`'s, shared with the overdraft warning, so
 * the two apps and the warning draw the same curve.
 */
export async function readBearingMonth(
  db: Db,
  /** Whose month: the person's, or their space's. */
  userId: string,
  {
    year,
    month,
    today,
    locale,
    myShare = null,
    templates: known,
    investedValue,
  }: {
    year: number;
    month: number;
    today: string;
    locale: Locale;
    /**
     * « Avec ma part du commun »: whether the spending figures count the
     * person's part of their shared space (6b). Null when it is not offered
     * — someone in no space, or the space itself on screen.
     */
    myShare?: boolean | null;
    /** The templates, when the caller has them already for this render. */
    templates?: RecurringTemplateWithCategory[];
    /** What the wallets are worth today, read the app's own way. */
    investedValue: () => Promise<number>;
  },
): Promise<BearingMonth> {
  const { start: first, end: last } = getMonthBounds(year, month);
  const period = last < today ? "past" : first > today ? "future" : "current";
  const isCurrent = period === "current";
  const previousMonth = shiftMonth(year, month, -1);

  const [templates, fulfilledKeys, closes, bankFed] = await Promise.all([
    known ?? getRecurringTemplates(db, userId),
    getFulfilledKeys(db, userId),
    getMonthCloseOverview(db, userId, today, locale),
    hasBankFeed(db, userId),
  ]);

  /* ----------------------------------------------- the balance and rows */

  // The months the spending bars look back over, read with the balance's
  // own range in one pass.
  const trendFrom = shiftMonth(year, month, -(TREND_MONTHS - 1));
  const {
    balance,
    source,
    accounts,
    rows,
    upcoming: shownUpcoming,
    outflows,
    debited,
  } = await readMonthBalance(db, userId, {
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

  // With the person's part of the space, the spending is counted on their
  // rows less the transfers to the joint account, plus their part of what
  // the space spent (`withMyShare`). The balance above is untouched.
  const shared = myShare
    ? await readMyShare(
        db,
        userId,
        getMonthBounds(trendFrom.year, trendFrom.month).start,
        last,
      )
    : null;
  const spendRows = shared
    ? withMyShare(rows, shared.rows, shared.share)
    : rows;

  const inMonth = spendRows.filter(
    (tx) => tx.occurred_on >= first && tx.occurred_on <= last,
  );
  const trendKeys = Array.from({ length: TREND_MONTHS }, (_, index) => {
    const at = shiftMonth(year, month, index - (TREND_MONTHS - 1));
    return { ...at, key: monthKeyOf(at.year, at.month) };
  });
  const byMonth = spendingByMonth(
    spendRows,
    trendKeys.map((entry) => entry.key),
  );
  const previousKey = monthKeyOf(previousMonth.year, previousMonth.month);
  const sameDay = today.slice(8, 10);
  const previousSoFar = isCurrent
    ? spendingByMonth(
        spendRows.filter((tx) => tx.occurred_on.slice(8, 10) <= sameDay),
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
  let dca: DcaMonth | null = null;
  let dcaProposal: FulfilmentProposal | null = null;
  let left: LeftToSpend | null = null;
  let eachMonth: number | null = null;
  let yearReady: number | null = null;
  let setup: BearingMonth["setup"] = null;

  if (isCurrent) {
    left = await readLeftToSpend(db, userId, {
      today,
      read: { balance, upcoming: shownUpcoming },
      templates,
      fulfilledKeys,
      closes,
      bankFed,
    });
    const rollup = rollUpRecurring(templates, { debited, year, month });
    eachMonth = rollup.income > 0 ? rollup.left : null;
    const dismissed = await readDismissedPrompts(db, userId);
    // « Votre année », in January, until « Vu ».
    const reviewed = reviewedYear(today);
    yearReady =
      reviewed !== null && !dismissed.includes(yearReviewPrompt(reviewed))
        ? reviewed
        : null;
    setup = {
      bankFed,
      hasBalance: source !== "none",
      hasIncome: payTemplate(templates) !== null,
      hasCharges: templates.some(
        (template) => template.active && template.categories.type === "expense",
      ),
      hasClosed: closes.history.length > 0,
      readyToClose: closes.next !== null,
      dismissed,
      firstCloseOn: firstCloseDay(today, closes.settings.closeDay),
    };
    const categories = await getCategories(db, userId);
    const [report, total, pending, swallowed, proposals, waitingPurchases] =
      await Promise.all([
        // A report that could not be read is a card not shown, not a page
        // that fails.
        getFulfilmentReport(
          db,
          userId,
          templates,
          categories,
          year,
          month,
        ).catch(() => null),
        investedValue(),
        bankFed ? countPendingFeedItems(db, userId) : Promise.resolve(0),
        bankFed ? countSwallowedFeedItems(db, userId) : Promise.resolve(0),
        bankFed
          ? getRecurringProposals(db, userId, today)
          : Promise.resolve([]),
        bankFed
          ? getPurchasesToConfirm(db, userId, {
              templates,
              fulfilledKeys,
              debited,
              today,
            })
          : Promise.resolve([]),
      ]);
    arrived = report;
    purchases = waitingPurchases;
    dca = await getDcaMonth(db, userId, today);
    if (dca && arrived) {
      const key = `${dca.templateId}:${dca.occurredOn}`;
      dcaProposal =
        arrived.proposals.find((proposal) => proposal.key === key) ?? null;
      arrived = {
        proposals: arrived.proposals.filter((proposal) => proposal.key !== key),
      };
    }

    if (closes.summary.sample > 0) {
      run = {
        streak: closes.summary.streak,
        best: closes.summary.bestStreak,
      };
    }

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

  const income = inMonth
    .filter((tx) => tx.categories.type === "income" && tx.occurred_on <= today)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  return {
    year,
    month,
    today,
    balance,
    source,
    accounts,
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
    myShare:
      myShare === null
        ? null
        : { on: shared !== null, part: shared?.share ?? null },
    upcoming: shownUpcoming,
    outflows,
    run,
    invested,
    attention,
    arrived: arrived && arrived.proposals.length > 0 ? arrived : null,
    purchases,
    dca,
    dcaProposal,
    left,
    eachMonth,
    setup,
    yearReady,
    recurring: templates.some((template) => template.active),
    empty:
      source === "none" &&
      rows.length === 0 &&
      templates.every((template) => !template.active),
  };
}
