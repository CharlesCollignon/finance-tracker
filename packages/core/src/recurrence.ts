import { formatMonthShortYear } from "./constants";

export type Recurrence = "monthly" | "weekly" | "yearly";

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const MONTH_LABELS: Record<number, string> = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

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

function formatIsoMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return formatMonthShortYear(year, month);
}

/** Compact échéancier label, or null when open-ended. */
export function formatScheduleWindow(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): string | null {
  if (!startsOn && !endsOn) {
    return null;
  }
  const start = startsOn ? formatIsoMonthYear(startsOn) : "…";
  const end = endsOn ? formatIsoMonthYear(endsOn) : "…";
  return `${start} → ${end}`;
}

export function formatRecurrenceSchedule(template: {
  recurrence: Recurrence;
  day_of_month: number | null;
  day_of_week: number | null;
  month_of_year: number | null;
  starts_on?: string | null;
  ends_on?: string | null;
}): string {
  let base: string;
  if (template.recurrence === "weekly" && template.day_of_week) {
    base = `Weekly · ${DAY_OF_WEEK_LABELS[template.day_of_week]}`;
  } else if (template.recurrence === "yearly" && template.month_of_year) {
    const month = MONTH_LABELS[template.month_of_year];
    base = `Yearly · ${month} ${template.day_of_month ?? 1}`;
  } else {
    base = `Monthly · day ${template.day_of_month ?? 1}`;
  }

  const window = formatScheduleWindow(template.starts_on, template.ends_on);
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
