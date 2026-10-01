/**
 * The week, in a few figures: what the Monday recap says, as a push and as a
 * card on Le point.
 *
 * Facts only, each one a measurement of the reader's own ledger: what left
 * last week, how the month compares with the same date last month, what the
 * month's charges still have to take, what is waiting in the review inbox,
 * and which categories have already spent more than their normal month.
 * Nothing in it says what to do about any of it.
 *
 * A recap is a state rather than a change, which is the one exception the
 * push digest's "a change, not a state" rule now makes, and only because the
 * owner asked for it (October 2026): once a week, on Monday, under its own
 * switch.
 */

import { getMonthBounds, shiftIsoDate } from "./constants";
import { categoryNormal } from "./category-findings";
import { buildCategoryHistory } from "./category-history";
import type { Locale } from "./i18n/locale";
import type { Translate } from "./i18n/t";
import { sumThroughDay } from "./month-comparison";
import type { StillToCome } from "./still-to-come";
import type { TransactionWithCategory } from "./types/database";

/** How far a category must be over its normal month to be said. */
const ABOVE_NORMAL_FLOOR = 25;

/** Months of a category's history its normal is read from. */
const NORMAL_MONTHS = 12;

/** A category needs this many months with spending before it has a normal. */
const NORMAL_MIN_MONTHS = 6;

export interface WeeklyRecap {
  /** The Monday of the week the recap is for: what keys it, once a week. */
  weekOf: string;
  /** Last week, Monday to Sunday. */
  lastWeek: { from: string; to: string; spent: number };
  /** This month up to yesterday, against last month up to the same date. */
  monthSoFar: {
    spent: number;
    previous: number;
    comparable: boolean;
    /** The month compared with, 1–12: last month. */
    previousMonth: number;
  };
  /** What the month's charges still have to take from the account. */
  stillToCome: { count: number; amount: number };
  /** Bank rows waiting for a category. */
  waiting: number;
  /** Categories that have already spent more than their normal month. */
  aboveNormal: { categoryName: string; spent: number; normal: number }[];
}

/** The Monday on or before a day. */
export function mondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  // Sunday is 0; it belongs to the week that started six days before.
  return shiftIsoDate(isoDate, -((weekday + 6) % 7));
}

function isSpending(tx: TransactionWithCategory): boolean {
  return (
    tx.categories.type === "expense" &&
    tx.categories.counts_toward_summary !== false
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The recap for the week that holds `today`, or null when there is nothing
 * to say — no spending last week or this month, nothing still to come and
 * nothing waiting is a week that does not need a message about it.
 *
 * `transactions` should reach back a year for the categories' normal months;
 * shorter only means fewer categories can be judged.
 */
export function buildWeeklyRecap({
  today,
  transactions,
  stillToCome,
  waiting,
  locale,
}: {
  today: string;
  transactions: readonly TransactionWithCategory[];
  stillToCome: Pick<StillToCome, "outgoing" | "leaving">;
  waiting: number;
  locale: Locale;
}): WeeklyRecap | null {
  const weekOf = mondayOf(today);
  const from = shiftIsoDate(weekOf, -7);
  const to = shiftIsoDate(weekOf, -1);

  const spentLastWeek = round(
    transactions
      .filter(
        (tx) =>
          isSpending(tx) && tx.occurred_on >= from && tx.occurred_on <= to,
      )
      .reduce((sum, tx) => sum + Number(tx.amount), 0),
  );

  // The month so far is counted to yesterday: today has barely started.
  const yesterday = shiftIsoDate(today, -1);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const current = getMonthBounds(year, month);
  const previousMonth =
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const previous = getMonthBounds(previousMonth.year, previousMonth.month);
  const throughDay = Number(yesterday.slice(8, 10));
  const inMonth = (bounds: { start: string; end: string }) =>
    [...transactions].filter(
      (tx) => tx.occurred_on >= bounds.start && tx.occurred_on <= bounds.end,
    );
  const thisMonth = inMonth(current);
  const lastMonth = inMonth(previous);
  // On the 1st there is no "so far" yet to compare.
  const started = yesterday >= current.start;
  const spentThisMonth = started
    ? round(sumThroughDay(thisMonth, "expense", throughDay))
    : 0;
  const spentLastMonth = started
    ? round(sumThroughDay(lastMonth, "expense", throughDay))
    : 0;

  const aboveNormal = started
    ? categoriesAboveNormal(transactions, year, month, locale)
    : [];

  const recap: WeeklyRecap = {
    weekOf,
    lastWeek: { from, to, spent: spentLastWeek },
    monthSoFar: {
      spent: spentThisMonth,
      previous: spentLastMonth,
      comparable: started && lastMonth.some(isSpending),
      previousMonth: previousMonth.month,
    },
    stillToCome: {
      count: stillToCome.outgoing.length,
      amount: round(stillToCome.leaving),
    },
    waiting,
    aboveNormal,
  };

  const nothing =
    recap.lastWeek.spent === 0 &&
    recap.monthSoFar.spent === 0 &&
    recap.stillToCome.amount === 0 &&
    recap.waiting === 0;
  return nothing ? null : recap;
}

/**
 * Expense categories whose month so far is already above their normal month
 * — the median of their earlier months with spending, the same normal the
 * category findings use. The two that are furthest over, so a recap names
 * what stands out rather than listing the ledger.
 */
function categoriesAboveNormal(
  transactions: readonly TransactionWithCategory[],
  year: number,
  month: number,
  locale: Locale,
): WeeklyRecap["aboveNormal"] {
  const histories = buildCategoryHistory([...transactions], year, month, {
    months: NORMAL_MONTHS + 1,
    locale,
  });
  return histories
    .filter((history) => history.type === "expense")
    .flatMap((history) => {
      const before = history.points.slice(0, -1);
      const now = history.points.at(-1);
      if (!now || now.empty) {
        return [];
      }
      if (before.filter((point) => !point.empty).length < NORMAL_MIN_MONTHS) {
        return [];
      }
      const { normal } = categoryNormal(before, NORMAL_MONTHS);
      if (normal <= 0 || now.total - normal < ABOVE_NORMAL_FLOOR) {
        return [];
      }
      return [{ categoryName: history.name, spent: round(now.total), normal }];
    })
    .sort((a, b) => b.spent - b.normal - (a.spent - a.normal))
    .slice(0, 2);
}

/**
 * The recap as sentences, in the reader's language: what the push says
 * joined into one paragraph, and what the card on Le point lists one per
 * line. The same words both places, so the card is the push opened.
 */
export function weeklyRecapLines(
  recap: WeeklyRecap,
  {
    t,
    formatMoney,
    previousMonthName,
  }: {
    t: Translate;
    formatMoney: (amount: number) => string;
    /** "septembre": the month the comparison is with. */
    previousMonthName: string;
  },
): string[] {
  const lines: string[] = [];

  lines.push(
    recap.lastWeek.spent > 0
      ? t("recap.lastWeek", { amount: formatMoney(recap.lastWeek.spent) })
      : t("recap.noSpending"),
  );

  if (recap.monthSoFar.comparable) {
    const delta = recap.monthSoFar.spent - recap.monthSoFar.previous;
    const spent = formatMoney(recap.monthSoFar.spent);
    lines.push(
      Math.abs(delta) < 1
        ? t("recap.monthSame", { amount: spent, month: previousMonthName })
        : t(delta < 0 ? "recap.monthLess" : "recap.monthMore", {
            amount: spent,
            delta: formatMoney(Math.abs(delta)),
            month: previousMonthName,
          }),
    );
  }

  if (recap.stillToCome.amount > 0) {
    lines.push(
      t("recap.stillToCome", {
        amount: formatMoney(recap.stillToCome.amount),
        count: recap.stillToCome.count,
      }),
    );
  }

  for (const category of recap.aboveNormal) {
    lines.push(
      t("recap.aboveNormal", {
        name: category.categoryName,
        normal: formatMoney(category.normal),
      }),
    );
  }

  if (recap.waiting > 0) {
    lines.push(t("recap.waiting", { count: recap.waiting }));
  }

  return lines;
}
