import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCategoryFindings,
  type CategoryFinding,
} from "@finance/core/category-findings";
import { buildCategoryHistory } from "@finance/core/category-history";
import { getCurrentMonth, shiftMonth } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { Database, TransactionWithCategory } from "@finance/core/types/database";
import { CATEGORY_MONTHS_READ } from "@/lib/category-read/facts";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * Every finding, rebuilt from the database for the write path.
 *
 * Recomputed server-side on every press and deliberately not accepted from
 * the client, for the reason `month-read/facts.ts` gives at length: a
 * catalogue the client supplied is a catalogue the client chose, and the
 * closed-catalogue rule this call rests on would mean nothing.
 *
 * It must produce the same list `app/(app)/history/page.tsx` produces, down
 * to the weights, because the digest stored beside the model's order is taken
 * over exactly these values and compared against the page's own. The window
 * is therefore the page's own constant rather than a second 36 written here.
 */
export async function gatherCategoryFindings(
  userId: string,
  client?: Client,
  /** Only reaches the month labels, which nothing in a digest reads. */
  localeOverride?: Locale,
): Promise<CategoryFinding[]> {
  const supabase = client ?? (await createClient());
  const current = getCurrentMonth();
  const oldest = shiftMonth(
    current.year,
    current.month,
    -(CATEGORY_MONTHS_READ - 1),
  );
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .gte("occurred_on", from)
    .order("occurred_on", { ascending: false });

  if (error) {
    throw error;
  }

  const histories = buildCategoryHistory(
    (data ?? []) as TransactionWithCategory[],
    current.year,
    current.month,
    { months: CATEGORY_MONTHS_READ, locale: localeOverride },
  );

  return buildCategoryFindings(histories);
}
