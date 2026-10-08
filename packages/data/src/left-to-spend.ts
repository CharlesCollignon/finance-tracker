import { getMonthBounds, shiftMonth } from "@finance/core/constants";
import {
  buildLeftToSpend,
  leftToSpendThrough,
  nextPayDay,
  payTemplate,
  type LeftToSpend,
} from "@finance/core/left-to-spend";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";
import { readMonthBalance, type MonthBalanceRead } from "./month-balance";
import type { MonthCloseOverview } from "./month-close";

/**
 * « Il vous reste », from the month in progress as Le point already read it,
 * so both apps and the widget show the figure the balance card's line ends
 * up at.
 *
 * Null without a balance: a count of the month from zero says nothing about
 * what can be spent. When the pay day falls next month, that month's line is
 * read too, with the same anchor and charges, so the figure runs to the eve
 * of the pay day rather than stopping at the month's end.
 */
export async function readLeftToSpend(
  db: Db,
  userId: string,
  {
    today,
    read,
    templates,
    fulfilledKeys,
    closes,
    bankFed,
  }: {
    today: string;
    /** The month in progress, as `readMonthBalance` gave it. */
    read: Pick<MonthBalanceRead, "balance" | "upcoming">;
    templates: RecurringTemplateWithCategory[];
    fulfilledKeys: Set<string>;
    closes: Pick<MonthCloseOverview, "history" | "settings">;
    bankFed: boolean;
  },
): Promise<LeftToSpend | null> {
  if (read.balance.basis !== "balance" || read.balance.period !== "current") {
    return null;
  }

  const pay = payTemplate(templates);
  const payDay = pay
    ? nextPayDay({
        template: pay,
        today,
        owed: (read.upcoming?.charges ?? []).filter(
          (charge) => charge.type === "income",
        ),
      })
    : null;

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  let points = read.balance.points;
  const through = leftToSpendThrough(today, payDay);
  if (through > getMonthBounds(year, month).end) {
    const next = shiftMonth(year, month, 1);
    const ahead = await readMonthBalance(db, userId, {
      year: next.year,
      month: next.month,
      today,
      templates,
      fulfilledKeys,
      closes,
      bankFed,
    });
    points = [...points, ...ahead.balance.points];
  }

  return buildLeftToSpend({
    today,
    payDay,
    points,
    monthlyMarge: closes.settings.unrecordedCap,
  });
}
