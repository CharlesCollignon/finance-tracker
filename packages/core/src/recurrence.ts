import { formatMonthShortYear } from "./constants";
import { dayOfWeekLong, monthLong } from "./i18n/calendar-names";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";

export type Recurrence = "monthly" | "weekly" | "yearly";

/**
 * The seven weekdays a weekly template can fall on, keyed by ISO day number.
 *
 * A function over the shared tables rather than the two hardcoded records
 * that used to sit here. They were the second and third copies of the
 * weekday and month names in this package, and a third language would have
 * needed all three updated in step or the app would have spoken two at once.
 */
export function dayOfWeekLabels(
  locale: Locale = DEFAULT_LOCALE,
): Record<number, string> {
  return Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7].map((day) => [day, dayOfWeekLong(day, locale)]),
  );
}

/** The twelve months a yearly template can fall in, keyed 1-12. */
export function monthLabels(
  locale: Locale = DEFAULT_LOCALE,
): Record<number, string> {
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      index + 1,
      monthLong(index + 1, locale),
    ]),
  );
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
  locale: Locale = DEFAULT_LOCALE,
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
    starts_on?: string | null;
    ends_on?: string | null;
  },
  locale: Locale = DEFAULT_LOCALE,
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
    base = t("recurrence.monthly", { day: template.day_of_month ?? 1 });
  }

  const window = formatScheduleWindow(
    template.starts_on,
    template.ends_on,
    locale,
  );
  return window ? `${base} · ${window}` : base;
}

export function estimateMonthlyAmount(
  template: {
    recurrence: Recurrence;
    amount: number;
    day_of_month?: number | null;
    day_of_week?: number | null;
    month_of_year?: number | null;
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

  return amount;
}

export function getRecurringOccurrenceDates(
  template: {
    recurrence: Recurrence;
    day_of_month: number | null;
    day_of_week: number | null;
    month_of_year: number | null;
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
