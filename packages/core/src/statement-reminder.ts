import { shiftIsoDate } from "./constants";
import { monthLong } from "./i18n/calendar-names";
import type { Locale } from "./i18n/locale";
import type { translator } from "./i18n/t";
import type { PendingNotification } from "./push-digest";

/**
 * « Votre relevé de septembre est prêt ? »: once a month, for someone who
 * brings their bank's statements themselves (`docs/plans/STATEMENTS_PLAN.md`)
 * and has not brought last month's yet.
 *
 * On the 5th: banks publish a month's statement in its first days, and a
 * reminder before it exists would send the person to look for nothing. Not
 * for someone whose bank is connected, who has nothing to bring; nor for
 * someone who has never imported, who has not said this is how they keep
 * their accounts.
 */

export const STATEMENT_REMINDER_DAY = 5;

export function statementReminder({
  today,
  lastImport,
  t,
  locale,
}: {
  /** Today, ISO, in Paris. */
  today: string;
  /** The latest import not undone, or null when there is none. */
  lastImport: { periodTo: string | null } | null;
  t: ReturnType<typeof translator>;
  locale: Locale;
}): PendingNotification | null {
  const day = Number(today.slice(8, 10));
  if (day !== STATEMENT_REMINDER_DAY || !lastImport) {
    return null;
  }
  // The last day of the month before: what a statement brought this month
  // would have to reach.
  const lastMonthEnd = shiftIsoDate(today, -day);
  if (lastImport.periodTo && lastImport.periodTo >= lastMonthEnd) {
    return null;
  }
  const month = monthLong(Number(lastMonthEnd.slice(5, 7)), locale);
  return {
    kind: "statement",
    key: `statement:${today.slice(0, 7)}`,
    title: t("push.statement.title", { month }),
    body: t("push.statement.body"),
    url: "/import",
  };
}
