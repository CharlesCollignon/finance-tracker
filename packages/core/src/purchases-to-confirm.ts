import { recurringOccurrenceKey, templateSetUpOn } from "./apply-recurring";
import { isPurchaseInsideWallet } from "./categories";
import { shiftIsoDate } from "./constants";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import { PAYDAY_LATE_DAYS } from "./recurring-fulfilment";
import type { RecurringTemplateWithCategory } from "./types/database";

/**
 * How long a purchase inside a wallet is asked about once its day has come:
 * the room money that moves on payday is given (`PAYDAY_LATE_DAYS`), which
 * is how long it used to be awaited from a bank that could never bring it.
 */
export const PURCHASE_ASK_DAYS = PAYDAY_LATE_DAYS;

export interface PurchaseToConfirm {
  /** The occurrence key, `templateId:occurredOn`. */
  key: string;
  templateId: string;
  /** The day the template calls for, and the day it is recorded on. */
  occurredOn: string;
  label: string;
  /** What the template says; a share-priced one is priced when recorded. */
  amount: number;
}

/**
 * The purchases inside a wallet whose day has come, waiting for the user to
 * say whether they went through.
 *
 * With a bank feeding the ledger, nothing is written from a template: the
 * bank is the record. A DCA PEA is the exception it cannot cover — the money
 * moves inside the broker, where the bank never looks — so it was awaited
 * from the bank for ten days and then dropped, never recorded, and the
 * position it grows stood still. It is asked about instead, for
 * `PURCHASE_ASK_DAYS` from its day: a yes records it on its day, a no skips
 * it, and no answer records nothing.
 *
 * Never one from before its template was set up, nor one already written,
 * skipped or confirmed.
 */
export function purchasesToConfirm({
  templates,
  writtenKeys,
  settledKeys,
  today,
}: {
  templates: readonly RecurringTemplateWithCategory[];
  /** Occurrences a row already records. */
  writtenKeys: ReadonlySet<string>;
  /** Occurrences skipped or confirmed, which are not owed again. */
  settledKeys: ReadonlySet<string>;
  today: string;
}): PurchaseToConfirm[] {
  const from = shiftIsoDate(today, -PURCHASE_ASK_DAYS);
  // The window can reach back into last month.
  const months = [...new Set([from.slice(0, 7), today.slice(0, 7)])].map(
    (key) => ({
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
    }),
  );

  const out: PurchaseToConfirm[] = [];
  for (const template of templates) {
    if (!template.active || !isPurchaseInsideWallet(template.categories)) {
      continue;
    }
    const setUpOn = templateSetUpOn(template);

    for (const { year, month } of months) {
      const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
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
      ).filter((date) => date.startsWith(monthPrefix));

      for (const date of dates) {
        const key = recurringOccurrenceKey(template.id, date);
        if (
          date > today ||
          date < from ||
          date < setUpOn ||
          writtenKeys.has(key) ||
          settledKeys.has(key)
        ) {
          continue;
        }
        out.push({
          key,
          templateId: template.id,
          occurredOn: date,
          label: template.description?.trim() || template.categories.name,
          amount: Number(template.amount),
        });
      }
    }
  }

  return out.sort(
    (a, b) =>
      a.occurredOn.localeCompare(b.occurredOn) ||
      a.label.localeCompare(b.label),
  );
}
