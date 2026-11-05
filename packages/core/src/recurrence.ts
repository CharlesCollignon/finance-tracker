import { formatMonthShortYear } from "./constants";
import { dayOfWeekLong, monthLong, monthShort } from "./i18n/calendar-names";
import { type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";

export type Recurrence = "monthly" | "weekly" | "yearly";

/**
 * The months a monthly template falls in, 1–12 in order, or null for every
 * month (migration 084). A quarterly salary is `[1, 4, 7, 10]`, the tax taken
 * from January to October `[1, …, 10]`. Never all twelve and never empty:
 * every month is null, so one rhythm has one shape.
 */
export type MonthSet = readonly number[] | null;

/** How often a monthly template comes round, as the form offers it. */
export type MonthRhythm = 1 | 2 | 3 | 6 | "some";

/** The every-N rhythms, in the order the form lists them. */
export const MONTH_STEPS = [1, 2, 3, 6] as const;

/**
 * A month set in its one shape: in order, each month once, 1–12 only, and
 * null for none or every month.
 */
export function normaliseMonths(
  months: Iterable<number> | null | undefined,
): number[] | null {
  if (!months) {
    return null;
  }
  const set = [...new Set(months)]
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .sort((a, b) => a - b);
  return set.length === 0 || set.length === 12 ? null : set;
}

/** Every `step` months from `first`: `[1, 4, 7, 10]` for a quarter from January. */
export function monthsEvery(step: number, first: number): number[] | null {
  if (step <= 1) {
    return null;
  }
  const start = ((((first - 1) % step) + step) % step) + 1;
  const months: number[] = [];
  for (let month = start; month <= 12; month += step) {
    months.push(month);
  }
  return normaliseMonths(months);
}

/**
 * How a month set reads back into the form: the every-N rhythm it is, from
 * its first month, or « certains mois » when it is not evenly spaced.
 */
export function rhythmOfMonths(months: MonthSet): {
  rhythm: MonthRhythm;
  first: number;
} {
  if (!months || months.length === 0) {
    return { rhythm: 1, first: 1 };
  }
  for (const step of MONTH_STEPS) {
    if (step === 1) {
      continue;
    }
    const even = monthsEvery(step, months[0]!);
    if (
      even &&
      even.length === months.length &&
      even.every((m, i) => m === months[i])
    ) {
      return { rhythm: step, first: months[0]! };
    }
  }
  return { rhythm: "some", first: months[0]! };
}

/** Whether a template with this month set falls in `month` (1–12). */
export function fallsInMonth(
  months: MonthSet | undefined,
  month: number,
): boolean {
  return !months || months.includes(month);
}

/** How many times a year a template comes round. */
export function timesPerYear(template: {
  recurrence: Recurrence;
  months?: MonthSet;
}): number {
  if (template.recurrence === "weekly") {
    return 52;
  }
  if (template.recurrence === "yearly") {
    return 1;
  }
  return template.months?.length ?? 12;
}

/**
 * An expense that does not fall every month — yearly, or kept to some
 * months — counts in the budget as an even share of a year rather than in the
 * months it lands. One rule for the budget, the projection and what is still
 * to come, so their figures agree.
 */
export function isSpreadExpense(template: {
  recurrence: Recurrence;
  months?: MonthSet;
  categories: { type: string };
}): boolean {
  return template.categories.type === "expense" && timesPerYear(template) < 12;
}

/** A month set as short month names: « janv., avr., juil., oct. ». */
export function formatMonthSet(
  months: readonly number[],
  locale: Locale,
): string {
  return months.map((month) => monthShort(month, locale)).join(", ");
}

/**
 * The seven weekdays a weekly template can fall on, keyed by ISO day number.
 *
 * A function over the shared tables rather than the two hardcoded records
 * that used to sit here. They were the second and third copies of the
 * weekday and month names in this package, and a third language would have
 * needed all three updated in step or the app would have spoken two at once.
 */
export function dayOfWeekLabels(locale: Locale): Record<number, string> {
  return Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7].map((day) => [day, dayOfWeekLong(day, locale)]),
  );
}

/** The twelve months a yearly template can fall in, keyed 1-12. */
export function monthLabels(locale: Locale): Record<number, string> {
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      index + 1,
      monthLong(index + 1, locale),
    ]),
  );
}

/**
 * The calendar month whose 1st is nearest `date`: its own up to the 15th,
 * the next after. The month a transfer to the broker on that day pays for.
 */
export function monthStartingNearest(date: string): {
  year: number;
  month: number;
} {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (Number(date.slice(8, 10)) <= 15) {
    return { year, month };
  }
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

/** ISO weekday: Monday = 1 … Sunday = 7 */
export function toIsoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** All ISO dates in a month matching the given weekday. */
export function getWeeklyDatesInMonth(
  year: number,
  month: number,
  dayOfWeek: number,
): string[] {
  const dates: string[] = [];
  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month - 1, day);
    if (toIsoWeekday(date) === dayOfWeek) {
      dates.push(
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }
  }

  return dates;
}

function formatIsoMonthYear(isoDate: string, locale: Locale): string {
  const [year, month] = isoDate.split("-").map(Number);
  return formatMonthShortYear(year!, month!, locale);
}

/**
 * Compact échéancier label, or null when open-ended.
 *
 * No message of its own: two dates, an arrow and an ellipsis read the same in
 * both languages, and a sentence that is only punctuation is not a sentence
 * worth translating twice.
 */
export function formatScheduleWindow(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  locale: Locale,
): string | null {
  if (!startsOn && !endsOn) {
    return null;
  }
  const start = startsOn ? formatIsoMonthYear(startsOn, locale) : "…";
  const end = endsOn ? formatIsoMonthYear(endsOn, locale) : "…";
  return `${start} → ${end}`;
}

export function formatRecurrenceSchedule(
  template: {
    recurrence: Recurrence;
    day_of_month: number | null;
    day_of_week: number | null;
    month_of_year: number | null;
    months?: MonthSet;
    starts_on?: string | null;
    ends_on?: string | null;
  },
  locale: Locale,
): string {
  const t = translator(locale);

  let base: string;
  if (template.recurrence === "weekly" && template.day_of_week) {
    base = t("recurrence.weekly", {
      day: dayOfWeekLong(template.day_of_week, locale),
    });
  } else if (template.recurrence === "yearly" && template.month_of_year) {
    base = t("recurrence.yearly", {
      month: monthLong(template.month_of_year, locale),
      day: template.day_of_month ?? 1,
    });
  } else {
    base = monthlySchedule(
      template.months ?? null,
      template.day_of_month ?? 1,
      locale,
    );
  }

  const window = formatScheduleWindow(
    template.starts_on,
    template.ends_on,
    locale,
  );
  return window ? `${base} · ${window}` : base;
}

/**
 * « Mensuel · le 5 », « Trimestriel · le 15 (janv., avr., juil., oct.) », or,
 * for months that are not evenly spaced, the months it falls in — or the ones
 * it skips, when those are fewer: « Mensuel sauf nov., déc. · le 15 ».
 */
function monthlySchedule(
  months: MonthSet,
  day: number,
  locale: Locale,
): string {
  const t = translator(locale);
  if (!months) {
    return t("recurrence.monthly", { day });
  }
  const { rhythm } = rhythmOfMonths(months);
  const list = formatMonthSet(months, locale);
  if (rhythm === 2) {
    return t("recurrence.everyTwoMonths", { day, months: list });
  }
  if (rhythm === 3) {
    return t("recurrence.quarterly", { day, months: list });
  }
  if (rhythm === 6) {
    return t("recurrence.twiceYearly", { day, months: list });
  }
  if (months.length > 6) {
    const skipped = Array.from({ length: 12 }, (_, i) => i + 1).filter(
      (month) => !months.includes(month),
    );
    return t("recurrence.monthlyExcept", {
      day,
      months: formatMonthSet(skipped, locale),
    });
  }
  return t("recurrence.someMonths", { day, months: list });
}

export function estimateMonthlyAmount(
  template: {
    recurrence: Recurrence;
    amount: number;
    day_of_month?: number | null;
    day_of_week?: number | null;
    month_of_year?: number | null;
    months?: MonthSet;
  },
  year?: number,
  month?: number,
): number {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const amount = Number(template.amount);

  if (template.recurrence === "yearly") {
    return amount / 12;
  }

  if (template.recurrence === "weekly" && template.day_of_week) {
    return amount * getWeeklyDatesInMonth(y, m, template.day_of_week).length;
  }

  // Spread like a yearly one: a quarterly charge is a third of itself a month.
  if (template.months) {
    return (amount * template.months.length) / 12;
  }

  return amount;
}

export function getRecurringOccurrenceDates(
  template: {
    recurrence: Recurrence;
    day_of_month: number | null;
    day_of_week: number | null;
    month_of_year: number | null;
    months?: MonthSet;
  },
  year: number,
  month: number,
): string[] {
  if (template.recurrence === "weekly" && template.day_of_week) {
    return getWeeklyDatesInMonth(year, month, template.day_of_week);
  }

  if (template.recurrence === "yearly") {
    if (template.month_of_year !== month) {
      return [];
    }

    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(template.day_of_month ?? 1, lastDay);

    return [
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ];
  }

  if (!fallsInMonth(template.months, month)) {
    return [];
  }

  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(template.day_of_month ?? 1, lastDay);

  return [
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  ];
}

/** Inclusive schedule window; null bound = unbounded on that side. */
export function occurrenceWithinSchedule(
  occurredOn: string,
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): boolean {
  if (startsOn && occurredOn < startsOn) {
    return false;
  }
  if (endsOn && occurredOn > endsOn) {
    return false;
  }
  return true;
}

export function filterDatesBySchedule(
  dates: string[],
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): string[] {
  return dates.filter((date) =>
    occurrenceWithinSchedule(date, startsOn, endsOn),
  );
}
