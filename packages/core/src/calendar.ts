import { weekdayShortMondayFirst } from "./i18n/calendar-names";
import { INTL_LOCALES, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { formatLongDate, relativeDayLabel } from "./constants";
import type { PlannedOccurrence } from "./apply-recurring";
import { isPurchaseInsideWallet } from "./categories";
import type { TransactionWithCategory } from "./types/database";

export interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface DayTotals {
  income: number;
  outflow: number;
  net: number;
  count: number;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function isSameDay(isoDate: string, today: Date): boolean {
  const todayIso = toIsoDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  return isoDate === todayIso;
}

function makeDay(
  year: number,
  month: number,
  day: number,
  isCurrentMonth: boolean,
  today: Date,
): CalendarDay {
  const date = toIsoDate(year, month, day);
  return {
    date,
    day,
    isCurrentMonth,
    isToday: isSameDay(date, today),
  };
}

/** Build month grid weeks (Monday-first). */
export function buildCalendarWeeks(
  year: number,
  month: number,
): CalendarDay[][] {
  const today = new Date();
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();

  let startOffset = firstOfMonth.getDay();
  startOffset = startOffset === 0 ? 6 : startOffset - 1;

  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthLast = new Date(year, month - 1, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    currentWeek.push(
      makeDay(prevYear, prevMonth, prevMonthLast - i, false, today),
    );
  }

  for (let day = 1; day <= lastDay; day++) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(makeDay(year, month, day, true, today));
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;

  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(makeDay(nextYear, nextMonth, nextDay++, false, today));
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * The column headings a calendar grid takes, Monday first.
 *
 * A function rather than the constant it used to be, because the seven words
 * change with the language. `weekdayShortMondayFirst` owns the rotation, so
 * this is only here to keep the calendar's own import surface unchanged.
 */
export function weekdayLabels(locale: Locale): readonly string[] {
  return weekdayShortMondayFirst(locale);
}

export function groupTransactionsByDate(
  transactions: TransactionWithCategory[],
): Map<string, TransactionWithCategory[]> {
  const groups = new Map<string, TransactionWithCategory[]>();

  for (const tx of transactions) {
    const list = groups.get(tx.occurred_on) ?? [];
    list.push(tx);
    groups.set(tx.occurred_on, list);
  }

  return groups;
}

/**
 * Whether a row is a purchase made at the broker with money already sent
 * there (a DCA PEA): in the ledger, but never out of the account — the
 * transfer that funded it already was. A wallet the bank debits from the
 * account (Bitstack) is the exception.
 */
function boughtAtTheBroker(
  category: { type: string; counts_toward_summary: boolean },
  categoryId: string,
  debited: ReadonlySet<string>,
): boolean {
  return (
    isPurchaseInsideWallet({
      type: category.type as TransactionWithCategory["categories"]["type"],
      counts_toward_summary: category.counts_toward_summary,
    }) && !debited.has(categoryId)
  );
}

/**
 * What a day's rows brought in and took out of the account. A purchase made
 * at the broker is listed on its day and counted in neither: the transfer
 * that paid for it is the money that went out.
 */
export function computeDayTotals(
  transactions: TransactionWithCategory[],
  /** `walletCategoriesTheBankDebits`. */
  debited: ReadonlySet<string> = new Set(),
): DayTotals {
  let income = 0;
  let outflow = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (boughtAtTheBroker(tx.categories, tx.category_id, debited)) {
      continue;
    }
    if (tx.categories.type === "income") {
      income += amount;
    } else {
      outflow += amount;
    }
  }

  return {
    income,
    outflow,
    net: income - outflow,
    count: transactions.length,
  };
}

/**
 * What a day's planned occurrences come to, in and out; null without any. A
 * purchase planned at the broker is not money out, as with `computeDayTotals`.
 */
export function plannedTotals(
  occurrences: readonly PlannedOccurrence[],
  debited: ReadonlySet<string> = new Set(),
): { income: number; outflow: number } | null {
  if (occurrences.length === 0) {
    return null;
  }
  let income = 0;
  let outflow = 0;
  for (const occurrence of occurrences) {
    if (
      boughtAtTheBroker(
        {
          type: occurrence.categoryType,
          counts_toward_summary: occurrence.countsTowardSummary !== false,
        },
        occurrence.categoryId,
        debited,
      )
    ) {
      continue;
    }
    if (occurrence.categoryType === "income") {
      income += occurrence.amount;
    } else {
      outflow += occurrence.amount;
    }
  }
  return { income, outflow };
}

/** One day of the month, as the strip above the calendar draws it. */
export interface PulseDay {
  date: string;
  /** What came in and went out, recorded. */
  income: number;
  outflow: number;
  /** What the recurring entries still call for that day. */
  plannedIncome: number;
  plannedOutflow: number;
  isToday: boolean;
}

/** The month's own days, each with what it held and what is still planned. */
export function buildPulseDays(
  weeks: readonly CalendarDay[][],
  byDate: ReadonlyMap<string, TransactionWithCategory[]>,
  plannedByDate: ReadonlyMap<string, readonly PlannedOccurrence[]>,
  debited: ReadonlySet<string> = new Set(),
): PulseDay[] {
  return weeks
    .flat()
    .filter((day) => day.isCurrentMonth)
    .map((day) => {
      const recorded = computeDayTotals(byDate.get(day.date) ?? [], debited);
      const planned = plannedTotals(plannedByDate.get(day.date) ?? [], debited);
      return {
        date: day.date,
        income: recorded.income,
        outflow: recorded.outflow,
        plannedIncome: planned?.income ?? 0,
        plannedOutflow: planned?.outflow ?? 0,
        isToday: day.isToday,
      };
    });
}

/**
 * The month's « in and out » for the calendar's header: the summary's
 * totals, less the purchases made at the broker, which the summary counts as
 * outflow and the account never paid — the transfer that funded them did.
 */
export function calendarMonthTotals(
  totals: { income: number; outflow: number },
  transactions: readonly TransactionWithCategory[],
  debited: ReadonlySet<string> = new Set(),
): { income: number; outflow: number; net: number } {
  const atTheBroker = transactions.reduce(
    (sum, tx) =>
      boughtAtTheBroker(tx.categories, tx.category_id, debited)
        ? sum + Number(tx.amount)
        : sum,
    0,
  );
  const outflow = Math.round((totals.outflow - atTheBroker) * 100) / 100;
  return {
    income: totals.income,
    outflow,
    net: Math.round((totals.income - outflow) * 100) / 100,
  };
}

export function formatCalendarDate(isoDate: string, locale: Locale): string {
  return relativeDayLabel(isoDate, formatLongDate, locale);
}

/**
 * A figure squeezed to fit a calendar cell: "1.2k", or "1,2 k" in French.
 *
 * Both halves of that difference are the language's, not a style choice —
 * the decimal separator comes from `Intl`, and whether a space precedes the
 * suffix comes from the `units.thousands` message.
 */
export function formatShortAmount(amount: number, locale: Locale): string {
  const rounded = Math.round(amount);
  const format = (value: number) =>
    new Intl.NumberFormat(INTL_LOCALES[locale], {
      maximumFractionDigits: 1,
    }).format(value);

  if (rounded >= 1000) {
    return translator(locale)("units.thousands", {
      value: format(Math.round(rounded / 100) / 10),
    });
  }
  return format(rounded);
}

export function defaultSelectedDate(
  year: number,
  month: number,
  byDate: Map<string, TransactionWithCategory[]>,
): string {
  const today = new Date();
  const todayIso = toIsoDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );

  if (today.getFullYear() === year && today.getMonth() + 1 === month) {
    return todayIso;
  }

  const withActivity = Array.from(byDate.keys()).sort();
  if (withActivity.length > 0) {
    return withActivity[0];
  }

  return toIsoDate(year, month, 1);
}
