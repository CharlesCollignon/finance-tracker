import { recurringOccurrenceKey } from "./apply-recurring";
import { moneyDay } from "./business-days";
import type { BankForecast } from "./recurring-fulfilment";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
  isSpreadExpense,
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
  /**
   * An occurrence whose day has come that the bank has not brought yet
   * (`bankForecast`): still owed, though its date is behind.
   */
  awaited?: boolean;
  /**
   * A purchase inside a wallet, in a category that does not count toward the
   * summary: it is tracked, and moves no money on the account, because the
   * transfer to the broker that paid for it already did. Never one whose
   * wallet the bank debits (`BankForecast.debited`): that money leaves.
   */
  tracked?: boolean;
  /**
   * A deferred card's debit: payments already made and recorded, their money
   * leaving on this day (`cash_on` after today). One per day, its amount
   * theirs together. Shown as « Débit carte ».
   */
  cardDebit?: boolean;
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
 *   - inactive templates are ignored. A spread expense (yearly, or kept to
 *     some months: `isSpreadExpense`) is money that leaves on its day like
 *     any other, so it is in `outgoing` and `leaving` — the taxe foncière
 *     due on the 15th is what « Il vous reste » has to keep back — but not
 *     in `budgetedOutflow`, because the budget counts it as a share of the
 *     year every month rather than on its day. Until November 2026 it was
 *     left out altogether, which let a large bill due before payday go
 *     unseen;
 *   - an occurrence already written into the ledger is not owed twice;
 *   - a skipped occurrence is not owed at all;
 *   - nor is a fulfilled one: the bank has already delivered it, and the
 *     movement is counted in the month's actuals. Without this every
 *     recurring charge a bank feed delivers is counted twice, which on a
 *     salary means a whole month's income added to a figure the user is
 *     about to spend against;
 *   - rows already dated later this month count, because they are real and
 *     they have not happened yet;
 *   - with a bank feeding the ledger, an occurrence the bank has not brought
 *     yet is still owed after its day, and one a movement already looks like
 *     is not owed again — see `bankForecast`.
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
  /**
   * For a ledger a bank feeds, what the bank has and has not brought: an
   * occurrence it has not brought yet is still owed after its day, and one
   * a movement already looks like is not owed a second time.
   */
  bank: BankForecast | null = null,
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
  function file(
    charge: UpcomingCharge,
    counts: boolean,
    categoryId: string,
    /**
     * Not in the budget's figure: spread over the year, or already counted
     * on the day it was made (a deferred card's debit).
     */
    spread = false,
  ): void {
    // Moves nothing on the account, unless its wallet is bought from it.
    if (
      charge.type === "investment" &&
      !counts &&
      !bank?.debited?.has(categoryId)
    ) {
      charge.tracked = true;
    }
    if (charge.type === "income") {
      incoming.push(charge);
      arriving += charge.amount;
      return;
    }

    outgoing.push(charge);
    leaving += charge.amount;

    if (!spread && (charge.type !== "investment" || counts)) {
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

  const spreadIds = new Set(
    templates
      .filter((template) => template.active && isSpreadExpense(template))
      .map((template) => template.id),
  );

  // Payments already made whose money leaves later this month — a deferred
  // card's, debited on its day: one charge per debit day, so the account is
  // seen to lose them then. Already in the budget on the day they were made,
  // so never in `budgetedOutflow`.
  const debits = new Map<string, number>();
  for (const tx of transactions) {
    if (
      tx.occurred_on <= today &&
      tx.cash_on &&
      tx.cash_on > today &&
      tx.cash_on.startsWith(monthPrefix)
    ) {
      const amount = Number(tx.amount);
      debits.set(
        tx.cash_on,
        (debits.get(tx.cash_on) ?? 0) +
          (tx.categories.type === "income" ? -amount : amount),
      );
    }
  }
  for (const [date, amount] of debits) {
    if (Math.round(amount * 100) <= 0) {
      continue;
    }
    file(
      {
        key: `debit:${date}`,
        name: "",
        description: null,
        occurredOn: date,
        amount: Math.round(amount * 100) / 100,
        type: "expense",
        recorded: true,
        cardDebit: true,
      },
      true,
      "",
      true,
    );
  }

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
      tx.category_id,
      tx.categories.type === "expense" &&
        tx.recurring_template_id !== null &&
        spreadIds.has(tx.recurring_template_id),
    );
  }

  for (const template of templates) {
    if (!template.active) {
      continue;
    }

    const dates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
          months: template.months,
        },
        year,
        month,
      ),
      template.starts_on,
      template.ends_on,
    ).filter((date) => date.startsWith(monthPrefix));

    for (const date of dates) {
      const key = recurringOccurrenceKey(template.id, date);
      const awaited = date <= today && (bank?.awaited.has(key) ?? false);
      if (
        (date <= today && !awaited) ||
        applied.has(key) ||
        skippedKeys.has(key) ||
        fulfilledKeys.has(key) ||
        bank?.arrived.has(key)
      ) {
        continue;
      }

      file(
        {
          key,
          name: template.categories.name,
          description: template.description,
          // Its own day is its key; the money moves on a working day — pay
          // the one before, a charge the one after (`moneyDay`).
          occurredOn: moneyDay(
            date,
            template.categories.type === "income" ? "in" : "out",
          ),
          amount: Number(template.amount),
          type: template.categories.type,
          recorded: false,
          ...(awaited ? { awaited } : {}),
        },
        countsTowardSummary(template),
        template.category_id,
        isSpreadExpense(template),
      );
    }
  }

  const soonestFirst = (a: UpcomingCharge, b: UpcomingCharge) =>
    a.occurredOn.localeCompare(b.occurredOn) || b.amount - a.amount;

  outgoing.sort(soonestFirst);
  incoming.sort(soonestFirst);

  return { outgoing, incoming, leaving, arriving, budgetedOutflow };
}
