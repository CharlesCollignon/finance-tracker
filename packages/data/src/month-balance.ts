import {
  getMonthBounds,
  shiftIsoDate,
  shiftMonth,
} from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import {
  buildMonthBalance,
  recordedDeltas,
  upcomingDelta,
  type BalanceAnchor,
  type DatedDelta,
  type MonthBalance,
} from "@finance/core/month-balance";
import { allRows } from "@finance/core/paging";
import {
  buildStillToCome,
  type UpcomingCharge,
} from "@finance/core/still-to-come";
import type {
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";

import { readCashBalance } from "./bank-balance";
import { hasBankFeed } from "./bank-feed";
import type { Db } from "./client";
import { getFulfilledKeys } from "./fulfilment";
import { getMonthCloseOverview, type MonthCloseOverview } from "./month-close";
import { getMovedBetween } from "./moved-rows";
import { getRecurringSkipKeys, getRecurringTemplates } from "./templates";

/**
 * One month's balance, as Le point draws it on both apps and as the
 * overdraft warning reads it from the server: what the account held, where
 * it goes day by day, and where the month ends.
 *
 * The balance is only ever carried from something read — the bank's
 * statement, or the close of the month before — and never from further back,
 * for the reason the Month pulse gives: a balance measured against movements
 * from a different window says nothing about either.
 */

/** What the balance is pinned to: the bank's statement, a close, or nothing. */
export type BalanceSource = "bank" | "close" | "none";

export interface MonthBalanceRead {
  balance: MonthBalance;
  source: BalanceSource;
  /**
   * Every row read: from the earlier of the range's start and `readFrom`,
   * to the range's end — so a screen that also wants the months before can
   * have them in the same read.
   */
  rows: TransactionWithCategory[];
  /** Still to come in the month shown; null for a month that has ended. */
  upcoming: {
    charges: UpcomingCharge[];
    leaving: number;
    arriving: number;
  } | null;
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Every transaction dated in a range, however many months it spans, paged
 * past the server's row cap — six months of a busy account is past it.
 */
async function getTransactionsBetween(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<TransactionWithCategory[]> {
  if (from > to) {
    return [];
  }
  const rows = await allRows((start, end) =>
    db
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: true })
      .order("id")
      .range(start, end),
  );
  return rows as TransactionWithCategory[];
}

/**
 * One month's balance, from what the caller has already read for its other
 * cards — the templates, the confirmed charges, the closes, whether a bank
 * feeds the account — so a screen does not read them twice.
 */
export async function readMonthBalance(
  db: Db,
  userId: string,
  {
    year,
    month,
    today,
    templates,
    fulfilledKeys,
    closes,
    bankFed,
    readFrom,
  }: {
    year: number;
    month: number;
    today: string;
    templates: RecurringTemplateWithCategory[];
    fulfilledKeys: Set<string>;
    closes: Pick<MonthCloseOverview, "history">;
    bankFed: boolean;
    /** An earlier day to read rows from as well, for the caller's own use. */
    readFrom?: string;
  },
): Promise<MonthBalanceRead> {
  const current = {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
  const { start: first, end: last } = getMonthBounds(year, month);
  const period = last < today ? "past" : first > today ? "future" : "current";
  const previousMonth = shiftMonth(year, month, -1);

  /* ------------------------------------------------------------ the anchor */

  let anchor: BalanceAnchor | null = null;
  let source: BalanceSource = "none";

  if (bankFed) {
    const onDate = period === "past" ? last : today;
    const cash = await readCashBalance(db, userId, onDate);
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

  const [rows, moved] = await Promise.all([
    getTransactionsBetween(
      db,
      userId,
      readFrom && readFrom < rangeStart ? readFrom : rangeStart,
      rangeEnd,
    ),
    anchor ? getMovedBetween(db, userId, rangeStart, rangeEnd) : [],
  ]);

  const recorded: DatedDelta[] = recordedDeltas(rows, {
    from: rangeStart,
    today,
    anchored: anchor !== null,
    moved,
  });

  // What the charges still call for, month by month from this one to the
  // end of the range — never a month that has ended.
  const planned: DatedDelta[] = [];
  let upcoming: MonthBalanceRead["upcoming"] = null;
  if (rangeEnd > today) {
    let cursor = { year: current.year, month: current.month };
    while (monthKeyOf(cursor.year, cursor.month) <= rangeEnd.slice(0, 7)) {
      const key = monthKeyOf(cursor.year, cursor.month);
      const skipped = await getRecurringSkipKeys(
        db,
        userId,
        cursor.year,
        cursor.month,
      );
      const still = buildStillToCome(
        rows.filter((tx) => tx.occurred_on.startsWith(key)),
        templates,
        cursor.year,
        cursor.month,
        today,
        skipped,
        fulfilledKeys,
      );
      for (const charge of [...still.outgoing, ...still.incoming]) {
        planned.push({ date: charge.occurredOn, delta: upcomingDelta(charge) });
      }
      if (cursor.year === year && cursor.month === month) {
        upcoming = {
          charges: [...still.outgoing, ...still.incoming].sort((a, b) =>
            a.occurredOn.localeCompare(b.occurredOn),
          ),
          leaving: still.leaving,
          arriving: still.arriving,
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

  return { balance, source, rows, upcoming };
}

/**
 * This month's balance with nothing read beforehand: what the overdraft
 * warning asks, from a cron that has no screen's reads to share.
 */
export async function readCurrentMonthBalance(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<Pick<MonthBalanceRead, "balance" | "source">> {
  const [templates, fulfilledKeys, closes, bankFed] = await Promise.all([
    getRecurringTemplates(db, userId),
    getFulfilledKeys(db, userId),
    getMonthCloseOverview(db, userId, today, locale),
    hasBankFeed(db, userId),
  ]);
  const { balance, source } = await readMonthBalance(db, userId, {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
    today,
    templates,
    fulfilledKeys,
    closes,
    bankFed,
  });
  return { balance, source };
}
