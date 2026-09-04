import { recurringOccurrenceKey } from "./apply-recurring";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";

export interface UpcomingCharge {
  /** Stable across renders: the occurrence key, or the row id for a real row. */
  key: string;
  name: string;
  description: string | null;
  occurredOn: string;
  amount: number;
  type: CategoryType;
  /** A row that already exists, as against one a template still owes. */
  recorded: boolean;
}

export interface StillToCome {
  /** Everything still due to leave the account, soonest first. */
  outgoing: UpcomingCharge[];
  /** Everything still due to arrive, soonest first. */
  incoming: UpcomingCharge[];
  /**
   * The sum of `outgoing`, and so exactly what a list of it adds up to.
   * Money is money: a deployment into a broker leaves the account like any
   * other debit, and someone asking what is still to come this month is
   * asking what will leave it.
   */
  leaving: number;
  /** The sum of `incoming`. */
  arriving: number;
  /**
   * The same outflow as the month-end view counts it, with broker deployments
   * left out because that view treats them as tracked rather than spent.
   *
   * Kept separate from `leaving` so a screen can show a list that adds up and
   * a headline that reconciles with the month-end figure, without the two
   * quietly being the same variable used for both jobs.
   */
  budgetedOutflow: number;
}

function countsTowardSummary(template: RecurringTemplateWithCategory): boolean {
  return template.categories.counts_toward_summary !== false;
}

/**
 * What the rest of the month still owes.
 *
 * The month-end view already answers this as a single figure, by running the
 * same projection to the last day of the month instead of to today. What it
 * cannot do is say *what* is coming, which is the thing worth knowing when
 * the question is "can I afford this before payday" — so this returns the
 * occurrences themselves, and the totals are simply their sum.
 *
 * The rules are deliberately the ones the month-end projection uses, so the
 * total here is exactly the difference between the two views. Anything else
 * would put two numbers on the same screen that disagree:
 *
 *   - inactive templates are ignored, as are yearly expenses, which are held
 *     at face value in the cash view rather than spread across the month;
 *   - an occurrence already written into the ledger is not owed twice;
 *   - a skipped occurrence is not owed at all;
 *   - nor is a fulfilled one: the bank has already delivered it, and the
 *     movement is counted in the month's actuals. Without this every
 *     recurring charge a bank feed delivers is counted twice, which on a
 *     salary means a whole month's income added to a figure the user is
 *     about to spend against;
 *   - rows already dated later this month count, because they are real and
 *     they have not happened yet.
 */
export function buildStillToCome(
  transactions: TransactionWithCategory[],
  templates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  today: string,
  skippedKeys: Set<string> = new Set(),
  /**
   * Occurrences the user has confirmed a bank movement already satisfied.
   * Same shape as `skippedKeys` and applied at the same point, because the
   * projection treats them alike — the difference between "should not exist"
   * and "already happened" matters to the history, not to the forecast.
   */
  fulfilledKeys: Set<string> = new Set(),
): StillToCome {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const outgoing: UpcomingCharge[] = [];
  const incoming: UpcomingCharge[] = [];
  let leaving = 0;
  let arriving = 0;
  let budgetedOutflow = 0;

  // Totalled as each occurrence is found rather than in a pass over the list,
  // because whether a broker deployment counts toward the budget is a fact
  // about the template or the category it came from, and that is only in hand
  // here.
  function file(charge: UpcomingCharge, counts: boolean): void {
    if (charge.type === "income") {
      incoming.push(charge);
      arriving += charge.amount;
      return;
    }

    outgoing.push(charge);
    leaving += charge.amount;

    if (charge.type !== "investment" || counts) {
      budgetedOutflow += charge.amount;
    }
  }

  const applied = new Set(
    transactions
      .filter((tx) => tx.recurring_template_id)
      .map((tx) =>
        recurringOccurrenceKey(tx.recurring_template_id!, tx.occurred_on),
      ),
  );

  for (const tx of transactions) {
    if (!tx.occurred_on.startsWith(monthPrefix) || tx.occurred_on <= today) {
      continue;
    }
    file(
      {
        key: tx.id,
        name: tx.categories.name,
        description: tx.note,
        occurredOn: tx.occurred_on,
        amount: Number(tx.amount),
        type: tx.categories.type,
        recorded: true,
      },
      tx.categories.counts_toward_summary !== false,
    );
  }

  for (const template of templates) {
    if (
      !template.active ||
      (template.recurrence === "yearly" &&
        template.categories.type === "expense")
    ) {
      continue;
    }

    const dates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        year,
        month,
      ),
      template.starts_on,
      template.ends_on,
    ).filter((date) => date.startsWith(monthPrefix) && date > today);

    for (const date of dates) {
      const key = recurringOccurrenceKey(template.id, date);
      if (applied.has(key) || skippedKeys.has(key) || fulfilledKeys.has(key)) {
        continue;
      }

      file(
        {
          key,
          name: template.categories.name,
          description: template.description,
          occurredOn: date,
          amount: Number(template.amount),
          type: template.categories.type,
          recorded: false,
        },
        countsTowardSummary(template),
      );
    }
  }

  const soonestFirst = (a: UpcomingCharge, b: UpcomingCharge) =>
    a.occurredOn.localeCompare(b.occurredOn) || b.amount - a.amount;

  outgoing.sort(soonestFirst);
  incoming.sort(soonestFirst);

  return { outgoing, incoming, leaving, arriving, budgetedOutflow };
}
