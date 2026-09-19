import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMonthLabel, getCurrentMonth, shiftMonth } from "@finance/core/constants";
import {
  buildCategoryFacts,
  MIN_MONTHS_FOR_CATEGORY_READ,
  type CategoryFacts,
} from "@finance/core/category-facts";
import {
  buildCategoryFindings,
  categoryNormal,
  NORMAL_WINDOW,
  type CategoryFinding,
  type FindingKind,
} from "@finance/core/category-findings";
import { buildCategoryHistory, type CategoryHistory } from "@finance/core/category-history";
import type { Locale } from "@finance/core/i18n/locale";
import type {
  CategoryType,
  Database,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlySummary } from "@/lib/queries/finance";
import { getBudgets } from "@/lib/queries/phase4";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * Everything a category read may refer to, gathered from what the by-category
 * screen already computes.
 *
 * Same discipline as `month-read/facts.ts`, narrowed to one category: no
 * figure here is one the panel does not already draw, which is the property
 * that makes the read checkable at all — a reader can look at the bars above
 * it and see the same number.
 *
 * How far back the read looks matches `app/(app)/history/page.tsx` exactly,
 * for the same reason `buildCategoryFacts`'s doc gives for `normal` and
 * `latest`: a model handed a shorter run than the panel drew would answer a
 * question about a chart the reader cannot see.
 *
 * Exported and imported by that page rather than restated there, because a
 * third reader has since arrived: `category-selection/findings.ts` rebuilds
 * the findings server-side and fingerprints them, and the page fingerprints
 * its own. Two windows that disagreed by a month would produce two digests
 * that never match, and the band would report every stored order as stale
 * forever — a failure that looks like nothing at all going wrong.
 */
export const CATEGORY_MONTHS_READ = 36;

/**
 * The month-independent half of the pack: everything that does not need a
 * database, split out so it can be built once from data the by-category
 * screen already holds — every card on that page needs its own `normal` and
 * `findings` regardless of whether a read exists to render — and again, on
 * demand, for the one category a write is about.
 */
export interface CurrentCategoryFactsInput {
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  /** Undefined when nothing at all has been recorded in the window. */
  history: CategoryHistory | undefined;
  /** This category's own findings, already picked out of the page's list. */
  findings: readonly CategoryFinding[];
  /** The month on screen's total expenses, for `share-of-month`. */
  monthExpenses: number;
  /** This category's cap, or null when it has none. */
  cap: number | null;
  monthLabel: string;
  locale: Locale;
}

function signedSeverity(
  findings: readonly CategoryFinding[],
  kind: FindingKind,
): number | null {
  const finding = findings.find((row) => row.kind === kind);
  if (!finding) {
    return null;
  }
  return finding.direction === "up" ? finding.severity : -finding.severity;
}

/** Non-empty months inside the window `normal` is taken over. */
function monthsActiveCount(history: CategoryHistory | undefined): number {
  const points = history?.points ?? [];
  return points.slice(-NORMAL_WINDOW).filter((point) => !point.empty).length;
}

/**
 * Whether a category has too little history to be worth a read — the one
 * thing every card on the by-category screen needs, whether or not it has a
 * stored read to render. Split out from `currentCategoryFacts` because it
 * needs neither `monthExpenses` nor `cap`: those feed `share-of-month` and
 * `cap-left`/`cap-over`, datums a reader only ever sees inside a rendered
 * read, so a screen with nothing yet written for any category has no reason
 * to have fetched either.
 */
export function categoryReadIsThin(history: CategoryHistory | undefined): boolean {
  return monthsActiveCount(history) < MIN_MONTHS_FOR_CATEGORY_READ;
}

/**
 * Build the pack from figures already in hand — no query of its own.
 *
 * The by-category screen calls this once per category that has a stored
 * read, over data it fetched for the page anyway; `gatherCategoryFacts`
 * below calls it once, after fetching that same shape of data for a single
 * category. One place turns those figures into a `CategoryFacts`, so a
 * change to what "normal" or "share of month" means cannot drift between the
 * two callers.
 */
export function currentCategoryFacts(input: CurrentCategoryFactsInput): CategoryFacts {
  const points = input.history?.points ?? [];
  const { normal } = categoryNormal(points);
  const last = points[points.length - 1];
  const latest = last && !last.empty ? last.total : null;

  const shareOfMonth =
    input.type === "expense" && latest !== null && input.monthExpenses > 0
      ? latest / input.monthExpenses
      : null;

  return buildCategoryFacts({
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    type: input.type,
    normal,
    latest,
    monthsActive: monthsActiveCount(input.history),
    monthLabel: input.monthLabel,
    drift: signedSeverity(input.findings, "drift"),
    oddMonth: signedSeverity(input.findings, "odd-month"),
    shareOfMonth,
    cap: input.cap,
    locale: input.locale,
  });
}

/**
 * Gather one category's figures from the database, for the write path.
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

  const categories = await getCategories(userId, { includeArchived: true });
  const category = categories.find((row) => row.id === categoryId);
  if (!category) {
    return null;
  }

  const oldest = shiftMonth(current.year, current.month, -(CATEGORY_MONTHS_READ - 1));
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const [{ data, error }, summary, budgets] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .gte("occurred_on", from)
      .order("occurred_on", { ascending: false }),
    getMonthlySummary(userId, current.year, current.month, "current"),
    getBudgets(userId),
  ]);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TransactionWithCategory[];
  const histories = buildCategoryHistory(rows, current.year, current.month, {
    months: CATEGORY_MONTHS_READ,
    locale,
  });
  const history = histories.find((row) => row.categoryId === categoryId);
  const findings = history ? buildCategoryFindings([history]) : [];
  const cap = budgets.find((row) => row.category_id === categoryId);

  return currentCategoryFacts({
    categoryId,
    categoryName: category.name,
    type: category.type,
    history,
    findings,
    monthExpenses: summary.expenses,
    cap: cap ? Number(cap.amount) : null,
    monthLabel: formatMonthLabel(current.year, current.month, locale),
    locale,
  });
}
