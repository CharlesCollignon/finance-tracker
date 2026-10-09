import { todayIsoLocal } from "@finance/core/constants";
import {
  readBearingMonth,
  type BearingMonth,
} from "@finance/data/bearing-month";
import { getLocale } from "@/lib/locale";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { createClient } from "@/lib/supabase/server";

export type { BearingMonth };

/**
 * Everything the Bearing shows for one month: `@finance/data/bearing-month`,
 * the gathering the phone's Le point runs too, with the web's own pricing of
 * the wallets and the templates this render already read.
 */
export async function gatherBearingMonth(
  userId: string,
  year: number,
  month: number,
  /**
   * « Avec ma part du commun »: whether the spending figures count the
   * person's part of their shared space (6b). Null when it is not offered —
   * someone in no space, or the space itself on screen.
   */
  myShare: boolean | null = null,
): Promise<BearingMonth> {
  const [db, locale, templates] = await Promise.all([
    createClient(),
    getLocale(),
    getRecurringTemplates(userId),
  ]);
  return readBearingMonth(db, userId, {
    year,
    month,
    today: todayIsoLocal(),
    locale,
    myShare,
    templates,
    investedValue: async () => {
      const portfolio = await getWalletPortfolio(userId, {
        includeHistory: false,
      });
      return portfolio.columns.reduce(
        (sum, column) => sum + column.totalMarketValue,
        0,
      );
    },
  });
}
