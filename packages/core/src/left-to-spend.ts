import { getMonthBounds, shiftIsoDate, shiftMonth } from "./constants";
import { upcomingDay, type MonthBalancePoint } from "./month-balance";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import type { UpcomingCharge } from "./still-to-come";
import type { RecurringTemplateWithCategory } from "./types/database";

/**
 * « Il vous reste » — what the account can still give before the next pay
 * day without going below zero, once the charges due by then and the
 * user's own marge are counted.
 *
 * Arithmetic on what the user set up, never advice: the balance read, the
 * charges they scheduled, the marge they chose. It answers the question the
 * app is opened for at the till — "can I afford this?" — with the one figure
 * that already holds every charge still to come.
 */
export interface LeftToSpend {
  /** Below zero when the charges due already take more than is there. */
  amount: number;
  /**
   * The last day it covers: the eve of the next pay day, or the month's last
   * day when no income is set.
   */
  through: string;
  /** The next pay day, or null when the figure runs to the month's end. */
  payDay: string | null;
  /** Days from today to `through`, both counted. Never below one. */
  days: number;
  /** `amount` spread over `days`; null when nothing is left to spread. */
  perDay: number | null;
  /** What the marge took off, for the explanation. Zero without one. */
  marge: number;
}

/** Sub-cent differences are rounding. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** How many months ahead a pay day is looked for: a monthly salary is in the next. */
const PAY_DAY_HORIZON = 3;

/**
 * The income the figure runs to: the largest active recurring one, which for
 * a salaried user is the salary. A yearly one — a bonus — is not what a
 * month is lived on, and is left out. Ties go to the earlier template, so the
 * answer does not change from one read to the next.
 */
export function payTemplate(
  templates: readonly RecurringTemplateWithCategory[],
): RecurringTemplateWithCategory | null {
  let best: RecurringTemplateWithCategory | null = null;
  for (const template of templates) {
    if (
      !template.active ||
      template.categories.type !== "income" ||
      template.recurrence === "yearly"
    ) {
      continue;
    }
    if (best === null || Number(template.amount) > Number(best.amount)) {
      best = template;
    }
  }
  return best;
}

/**
 * The next day that income comes in.
 *
 * This month's is taken from what is still owed (`stillToCome`'s incoming),
 * which already knows which occurrences were written, skipped, confirmed or
 * brought by the bank — and one the bank still owes from a day behind moves
 * the balance from tomorrow (`upcomingDay`). Otherwise it is the template's
 * first day in the months after.
 */
export function nextPayDay({
  template,
  today,
  owed,
}: {
  template: RecurringTemplateWithCategory;
  today: string;
  /** What is still to arrive in the month in progress. */
  owed: readonly Pick<UpcomingCharge, "key" | "occurredOn">[];
}): string | null {
  const prefix = `${template.id}:`;
  const thisMonth = owed
    .filter((charge) => charge.key.startsWith(prefix))
    .map((charge) => upcomingDay(charge, today))
    .sort();
  if (thisMonth.length > 0) {
    return thisMonth[0]!;
  }

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  for (let ahead = 1; ahead <= PAY_DAY_HORIZON; ahead += 1) {
    const at = shiftMonth(year, month, ahead);
    const dates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        at.year,
        at.month,
      ),
      template.starts_on,
      template.ends_on,
    ).sort();
    if (dates.length > 0) {
      return dates[0]!;
    }
  }
  return null;
}

/** The last day the figure covers, from the pay day if there is one. */
export function leftToSpendThrough(
  today: string,
  payDay: string | null,
): string {
  if (payDay !== null && payDay > today) {
    return shiftIsoDate(payDay, -1);
  }
  const { end } = getMonthBounds(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
  );
  return end;
}

/** Days from `from` to `to`, both counted. */
function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * The figure, from the balance's own day-by-day line.
 *
 * Its lowest point between today and `through`, not the value on the last
 * day: a smaller income landing before the salary does not make room for a
 * purchase today if a charge in between would take the account below zero.
 * With nothing but charges ahead, the lowest point is the last day's anyway.
 *
 * The marge is the user's allowance for spending never recorded, set per
 * month; the days covered take their share of it.
 */
export function buildLeftToSpend({
  today,
  payDay,
  points,
  monthlyMarge,
}: {
  today: string;
  payDay: string | null;
  /**
   * The balance's line, day by day, covering today to `through` — the month
   * in progress, and the next one too when the pay day falls in it.
   */
  points: readonly Pick<MonthBalancePoint, "date" | "value">[];
  /** The unrecorded allowance, per month, or null when none is set. */
  monthlyMarge: number | null;
}): LeftToSpend | null {
  const through = leftToSpendThrough(today, payDay);
  const window = points.filter(
    (point) => point.date >= today && point.date <= through,
  );
  if (window.length === 0) {
    return null;
  }
  const lowest = Math.min(...window.map((point) => point.value));

  const days = Math.max(1, daysBetween(today, through));
  const month = getMonthBounds(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
  );
  const monthDays = daysBetween(month.start, month.end);
  const marge =
    monthlyMarge !== null && monthlyMarge > 0
      ? roundMoney((monthlyMarge * Math.min(days, monthDays)) / monthDays)
      : 0;

  const amount = roundMoney(lowest - marge);
  return {
    amount,
    through,
    payDay: payDay !== null && payDay > today ? payDay : null,
    days,
    perDay: amount > 0 ? Math.floor((amount / days) * 100) / 100 : null,
    marge,
  };
}
