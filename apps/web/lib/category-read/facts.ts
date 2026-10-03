import type { SupabaseClient } from "@supabase/supabase-js";
import { allRows } from "@finance/core/paging";
import {
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
} from "@finance/core/constants";
import type { CategoryFacts } from "@finance/core/category-facts";
import { buildCategoryFindings } from "@finance/core/category-findings";
import { buildCategoryHistory } from "@finance/core/category-history";
import {
  CATEGORY_MONTHS_READ,
  currentCategoryFacts,
} from "@finance/core/category-screen";
import type { Locale } from "@finance/core/i18n/locale";
import type {
  Database,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { getCategories } from "@finance/data/categories";
import { getMonthlySummary } from "@finance/data/month-ledger";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * Gather one category's figures from the database, for the write path. The
 * screen's half — the window, `currentCategoryFacts` — is in
 * `@finance/core/category-screen`, shared with the phone.
 *
 * Recomputed server-side on every write and deliberately not accepted from
 * the client, for the reason `month-read/facts.ts` gives at length: every
 * figure here has to be one the server itself computed, or the guarantee
 * this feature exists to make is gone.
 *
 * Null when the category does not belong to this user — deleted, most
 * likely, in the seconds between the panel opening and the button being
 * pressed. The caller treats that the same as "no writer": there is nothing
 * to read a figure out of.
 */
export async function gatherCategoryFacts(
  userId: string,
  categoryId: string,
  client?: Client,
  /** Build the pack in this language rather than the request's; see `month-read/facts.ts`. */
  localeOverride?: Locale,
): Promise<CategoryFacts | null> {
  const supabase = client ?? (await createClient());
  const locale = localeOverride ?? (await getLocale());
  const current = getCurrentMonth();

  // Through the caller's client, not the request's cookie: the phone's
  // bearer arrives without one.
  const categories = await getCategories(supabase, userId, {
    includeArchived: true,
  });
  const category = categories.find((row) => row.id === categoryId);
  if (!category) {
    return null;
  }

  const oldest = shiftMonth(
    current.year,
    current.month,
    -(CATEGORY_MONTHS_READ - 1),
  );
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const [data, summary] = await Promise.all([
    allRows((start, end) =>
      supabase
        .from("transactions")
        .select("*, categories(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .eq("category_id", categoryId)
        .gte("occurred_on", from)
        .order("occurred_on", { ascending: false })
        .order("id")
        .range(start, end),
    ),
    getMonthlySummary(supabase, userId, current.year, current.month, "current"),
  ]);

  const rows = data as TransactionWithCategory[];
  const histories = buildCategoryHistory(rows, current.year, current.month, {
    months: CATEGORY_MONTHS_READ,
    locale,
  });
  const history = histories.find((row) => row.categoryId === categoryId);
  const findings = history ? buildCategoryFindings([history]) : [];

  return currentCategoryFacts({
    categoryId,
    categoryName: category.name,
    type: category.type,
    history,
    findings,
    monthExpenses: summary.expenses,
    monthLabel: formatMonthLabel(current.year, current.month, locale),
    locale,
  });
}
