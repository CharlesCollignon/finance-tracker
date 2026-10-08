import { monthWasWon } from "@finance/core/month-close";
import type { Locale } from "@finance/core/i18n/locale";
import { allRows } from "@finance/core/paging";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { buildYearReview, type YearReview } from "@finance/core/year-review";

import type { Db } from "./client";
import { getMonthCloseOverview } from "./month-close";
import { readMilestoneHistory } from "./preferences";

/**
 * « Votre année » for one year (`buildYearReview`): the closes, with whether
 * each month was won, the year's rows and the year before's — for the
 * category that moved most — and the milestones reached.
 */
export async function readYearReview(
  db: Db,
  userId: string,
  year: number,
  { today, locale }: { today: string; locale: Locale },
): Promise<YearReview | null> {
  const [closes, rows, milestones] = await Promise.all([
    getMonthCloseOverview(db, userId, today, locale),
    allRows((start, end) =>
      db
        .from("transactions")
        .select("*, categories(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .gte("occurred_on", `${year - 1}-01-01`)
        .lte("occurred_on", `${year}-12-31`)
        .order("occurred_on", { ascending: true })
        .order("id")
        .range(start, end),
    ),
    readMilestoneHistory(db, userId),
  ]);

  return buildYearReview({
    year,
    closes: closes.history.map((close) => ({
      monthKey: close.monthKey,
      kept: close.kept,
      won: monthWasWon(close, closes.settings.unrecordedCap),
    })),
    rows: (rows as TransactionWithCategory[]).map((tx) => ({
      occurredOn: tx.occurred_on,
      amount: Number(tx.amount),
      categoryName: tx.categories.name,
      categoryType: tx.categories.type,
    })),
    milestones: milestones ?? [],
  });
}
