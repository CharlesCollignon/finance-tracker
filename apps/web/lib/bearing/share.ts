import "server-only";

import { formatCurrency, todayIsoLocal } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import { monthShare, type MonthShare } from "@finance/core/month-share";
import { readBearingMonth } from "@finance/data/bearing-month";
import type { Db } from "@finance/data/client";
import { getMonthCloseOverview } from "@finance/data/month-close";

/**
 * One month as the lines to share, for the image route and the print page:
 * Le point's own month (`readBearingMonth`, as both apps read it), handed
 * to `monthShare`. The wallets are not priced here — nothing on the page
 * shows them.
 */
export async function readMonthShare(
  db: Db,
  ownerId: string,
  year: number,
  month: number,
  locale: Locale,
  withAmounts: boolean,
): Promise<MonthShare> {
  const today = todayIsoLocal();
  const [data, closes] = await Promise.all([
    readBearingMonth(db, ownerId, {
      year,
      month,
      today,
      locale,
      investedValue: async () => 0,
    }),
    // The month's close, whichever month: Le point only carries the closes
    // with the month in progress.
    getMonthCloseOverview(db, ownerId, today, locale),
  ]);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const closed = closes.history.find((row) => row.monthKey === monthKey) ?? null;
  return monthShare(
    {
      year,
      month,
      income: data.income,
      spent: data.spent.total,
      spending: {
        top: data.spending.top.map((entry) => ({
          name: entry.name,
          amount: entry.total,
        })),
        rest: data.spending.rest,
        total: data.spending.total,
      },
      close: closed ? { kept: closed.kept, unrecorded: closed.unrecorded } : null,
      upcoming: data.upcoming
        ? { leaving: data.upcoming.leaving, arriving: data.upcoming.arriving }
        : null,
    },
    {
      t: translator(locale),
      locale,
      formatMoney: withAmounts
        ? (amount) => formatCurrency(amount, "EUR", locale)
        : null,
    },
  );
}
