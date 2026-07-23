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

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export function computeDayTotals(
  transactions: TransactionWithCategory[],
): DayTotals {
  let income = 0;
  let outflow = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
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

export function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatShortAmount(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded >= 1000) {
    return `${Math.round(rounded / 100) / 10}k`;
  }
  return String(rounded);
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

  if (
    today.getFullYear() === year &&
    today.getMonth() + 1 === month
  ) {
    return todayIso;
  }

  const withActivity = Array.from(byDate.keys()).sort();
  if (withActivity.length > 0) {
    return withActivity[0];
  }

  return toIsoDate(year, month, 1);
}
