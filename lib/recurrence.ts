export type Recurrence = "monthly" | "weekly";

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
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

export function formatRecurrenceSchedule(template: {
  recurrence: Recurrence;
  day_of_month: number | null;
  day_of_week: number | null;
}): string {
  if (template.recurrence === "weekly" && template.day_of_week) {
    return `Weekly · ${DAY_OF_WEEK_LABELS[template.day_of_week]}`;
  }

  return `Monthly · day ${template.day_of_month ?? 1}`;
}

export function estimateMonthlyAmount(
  template: {
    recurrence: Recurrence;
    amount: number;
    day_of_month?: number | null;
    day_of_week?: number | null;
  },
  year?: number,
  month?: number,
): number {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const amount = Number(template.amount);

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
  },
  year: number,
  month: number,
): string[] {
  if (template.recurrence === "weekly" && template.day_of_week) {
    return getWeeklyDatesInMonth(year, month, template.day_of_week);
  }

  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(template.day_of_month ?? 1, lastDay);

  return [
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  ];
}
