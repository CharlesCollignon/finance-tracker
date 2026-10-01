/**
 * What the app says in a push, for the things worth saying on their day.
 *
 * Each builder decides whether there is anything to say and, if so, says it
 * in the reader's language — pure, so the decisions are testable without a
 * database, a device or a clock. The crons gather the facts and hand them
 * in; `apps/web/lib/push/deliver` decides whether it is wanted, whether it is
 * the night, and whether it was said already.
 *
 * Every one of these describes something that happened or a day that has
 * come, and every one says the mechanism rather than a nudge: what the
 * figure is and where it comes from, never what the reader should do about
 * their money.
 */

import { formatEuro } from "./constants";
import { monthLong } from "./i18n/calendar-names";
import type { Locale } from "./i18n/locale";
import type { Translate } from "./i18n/t";
import type { CloseableMonth, MonthCloseResult } from "./month-close";
import type { PendingNotification } from "./push-digest";

interface Voice {
  t: Translate;
  locale: Locale;
}

/**
 * The reading day has come and the month is not closed yet.
 *
 * Only for someone who has closed a month before: a first close is set up
 * in the app, where the reason for it can be explained, not from a push.
 * Mentions the run when there is one, because a run is something the reader
 * built and would lose by skipping the close.
 */
export function closeReminder({
  next,
  today,
  closesSoFar,
  streak,
  t,
  locale,
}: Voice & {
  next: CloseableMonth | null;
  today: string;
  closesSoFar: number;
  streak: number;
}): PendingNotification | null {
  if (!next || next.isBaseline || closesSoFar === 0) {
    return null;
  }
  if (today < next.observeOn) {
    return null;
  }
  const month = monthLong(next.month, locale);
  return {
    kind: "close",
    key: `close:${next.monthKey}`,
    title: t("push.close.title", { month }),
    body:
      streak > 0
        ? t("push.close.bodyRun", { month, count: streak })
        : t("push.close.body", { month }),
    url: "/bearing",
  };
}

/**
 * A connected bank gave the balance, and the month closed itself.
 *
 * Says what the close found — what the month left, and what left unrecorded
 * — because that is the figure the reader would have opened the app for.
 */
export function monthClosedByBank({
  monthKey,
  result,
  t,
  locale,
}: Voice & {
  monthKey: string;
  result: MonthCloseResult;
}): PendingNotification {
  const month = monthLong(Number(monthKey.slice(5, 7)), locale);
  const base = {
    kind: "close" as const,
    key: `closed:${monthKey}`,
    title: t("push.closed.title", { month }),
    url: "/bearing",
  };

  if (result.status === "baseline" || result.kept === null) {
    return { ...base, body: t("push.closed.baseline") };
  }
  if (result.status === "over-recorded") {
    return { ...base, body: t("push.closed.overRecorded", { month }) };
  }

  const kept = formatEuro(Math.abs(result.kept), locale);
  const body =
    result.kept >= 0
      ? t("push.closed.kept", { month, amount: kept })
      : t("push.closed.spentMore", { month, amount: kept });
  return result.unrecorded && result.unrecorded > 0
    ? {
        ...base,
        body: `${body} ${t("push.closed.unrecorded", {
          amount: formatEuro(result.unrecorded, locale),
        })}`,
      }
    : { ...base, body };
}
