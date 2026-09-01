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
  formatAmount: (amount: number) => string;
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
  formatAmount,
}: BuildDigestOptions): PendingNotification[] {
  const monthKey = monthKeyOf(today);
  const due: PendingNotification[] = [];

  // The month's opening moment, which is when applying is most worth doing.
  if (dayOf(today) === 1) {
    const key = `month-open:${monthKey}`;
    if (!alreadySent.has(key)) {
      due.push({
        key,
        title: "A new month",
        body:
          pendingRecurring > 0
            ? `${pendingRecurring} recurring ${
                pendingRecurring === 1 ? "item is" : "items are"
              } ready to apply.`
            : "Apply your recurring to fill it in, and see what's left.",
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
      title: `${row.label} is over budget`,
      body: `${formatAmount(row.spent)} spent of ${formatAmount(row.limit)}.`,
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
