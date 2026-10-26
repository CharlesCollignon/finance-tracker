import type { Locale } from "@finance/core/i18n/locale";
import {
  buildMerchantScreen,
  merchantWindow,
  type MerchantScreen,
} from "@finance/core/merchant-screen";
import { allRows } from "@finance/core/paging";
import type { TransactionWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/**
 * « Par commerce » for both apps: the last twelve months' rows, then
 * `buildMerchantScreen` over them. Paged: a year of a busy account is past
 * the server's cap. Deleted rows stay out, as the select policies keep them.
 */
export async function readMerchantScreen(
  db: Db,
  ownerId: string,
  { year, month, locale }: { year: number; month: number; locale: Locale },
): Promise<MerchantScreen> {
  const { from, to } = merchantWindow(year, month, locale);
  const rows = await allRows((start, end) =>
    db
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", ownerId)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false })
      .order("id")
      .range(start, end),
  );
  return buildMerchantScreen(rows as TransactionWithCategory[], {
    year,
    month,
    locale,
  });
}
