/**
 * What is worth telling someone today.
 *
 * A daily job asks this once per user. The rule throughout is that the
 * interesting event is a change, not a state: being over a cap on the 14th is
 * only news once, and repeating it every morning is how a notification
 * permission gets revoked.
 *
 * Kept free of database and network concerns so the decisions are testable
 * without either.
 */

import type { BudgetProgress } from "./budget-limits";
import type { Translate } from "./i18n/t";

export interface PendingNotification {
  /** Dedupe key, checked against what has already been sent. */
  key: string;
  title: string;
  body: string;
  /** Where tapping it should land. */
  url: string;
}

export interface BuildDigestOptions {
  /** Today, ISO. */
  today: string;
  /** Caps and what has been spent against them. */
  budgetProgress: readonly BudgetProgress[];
  /** Keys already sent to this user, so nothing repeats. */
  alreadySent: ReadonlySet<string>;
  /** How many recurring occurrences the new month is waiting to apply. */
  pendingRecurring?: number;
  /**
   * How many charges look as though the bank already delivered them and are
   * waiting to be confirmed.
   *
   * Worth a notification because it is time-sensitive in a way a cap breach
   * is not: until the salary is confirmed, every figure that answers "what
   * can I spend" is overstated by a month's pay, and the person reading it
   * has no way of knowing.
   */
  arrivedCharges?: number;
  formatAmount: (amount: number) => string;
  /**
   * The reader's language, injected the same way the money formatter is and
   * for the same reason: this module decides what is worth saying and must
   * stay testable without a locale, a database or a network.
   *
   * The digest is the one surface where the language cannot come from a
   * browser — it is composed on a server for somebody who is asleep — so the
   * caller reads it from `user_preferences` and hands it in.
   */
  t: Translate;
}

/** At most this many in one run — a wall of notifications is noise. */
const MAX_PER_RUN = 3;

function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function dayOf(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

export function buildDueNotifications({
  today,
  budgetProgress,
  alreadySent,
  pendingRecurring = 0,
  arrivedCharges = 0,
  formatAmount,
  t,
}: BuildDigestOptions): PendingNotification[] {
  const monthKey = monthKeyOf(today);
  const due: PendingNotification[] = [];

  // The month's opening moment, which is when applying is most worth doing.
  if (dayOf(today) === 1) {
    const key = `month-open:${monthKey}`;
    if (!alreadySent.has(key)) {
      due.push({
        key,
        title: t("push.monthOpen.title"),
        body:
          pendingRecurring > 0
            ? t("push.monthOpen.pending", { count: pendingRecurring })
            : t("push.monthOpen.idle"),
        url: "/dashboard",
      });
    }
  }

  // Charges the bank appears to have delivered. Keyed by the day rather than
  // the month: unlike a cap breach this recurs legitimately — a salary one
  // week, a subscription the next — and it stops as soon as the answer is
  // given, so a daily nudge cannot become a permanent one.
  if (arrivedCharges > 0) {
    const key = `arrived:${today}`;
    if (!alreadySent.has(key)) {
      due.push({
        key,
        title: t("push.arrived.title", { count: arrivedCharges }),
        body: t("push.arrived.body", { count: arrivedCharges }),
        url: "/dashboard",
      });
    }
  }

  // Crossing a cap. Sorted by how far over, so if the cap is reached on the
  // limit of what one run will send, the worst one is what gets said.
  const over = budgetProgress
    .filter((row) => row.over)
    .slice()
    .sort((left, right) => right.ratio - left.ratio);

  for (const row of over) {
    const key = `breach:${monthKey}:${row.budgetId}`;
    if (alreadySent.has(key)) {
      continue;
    }
    due.push({
      key,
      title: t("push.breach.title", { label: row.label }),
      body: t("push.breach.body", {
        spent: formatAmount(row.spent),
        limit: formatAmount(row.limit),
      }),
      url: "/budgets",
    });
  }

  return due.slice(0, MAX_PER_RUN);
}

/**
 * Whether a push service's response means the browser is gone for good.
 *
 * 404 and 410 are the two the spec defines for a subscription that no longer
 * exists; anything else is a transient problem and the row should be kept, or
 * a bad afternoon on the push service's side would empty the table.
 */
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410;
}
