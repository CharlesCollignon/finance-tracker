import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  buildCategoryHistory,
  categoryBucketing,
} from "@finance/core/category-history";
import {
  buildCategoryFindings,
  categoryNormal,
} from "@finance/core/category-findings";
import {
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
} from "@finance/core/constants";
import {
  CATEGORY_READ_WRITES_PER_MONTH,
  type CategoryRead as CategoryReadValue,
} from "@finance/core/category-read";
import type { CategoryFacts } from "@finance/core/category-facts";
import { writesRemaining } from "@finance/core/month-read-budget";
import type { Locale } from "@finance/core/i18n/locale";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { CategoryHistoryView } from "@/components/finance/category/CategoryHistoryView";
import { getLocale } from "@/lib/locale";
import { categoryReadConfigured } from "@/lib/category-read/client";
import { categoryReadIsThin, currentCategoryFacts } from "@/lib/category-read/facts";
import {
  listStoredCategoryReads,
  readCategoryReadTally,
} from "@/lib/category-read/store";
import { getMonthlySummary } from "@/lib/queries/finance";
import { getBudgets } from "@/lib/queries/phase4";

/**
 * How far back the page reads, and how far back it draws.
 *
 * Seasonality cannot be measured inside a twelve-month window — the same
 * calendar month has to appear at least twice — so the query widens and the
 * screen does not. Twenty-four bars in a tile the width of a phone column are
 * a texture rather than a chart.
 */
const MONTHS_READ = 36;
const MONTHS_DRAWN = 12;

export default async function HistoryPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();
  const oldest = shiftMonth(current.year, current.month, -(MONTHS_READ - 1));
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const supabase = await createClient();

  // Three independent reads, one round-trip stage: the category read's own
  // state depends on nothing the transactions query produces, so it is
  // fetched alongside it rather than after it.
  const [{ data }, { byCategory: storedReads }, tally] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", user.id)
      .gte("occurred_on", from)
      .order("occurred_on", { ascending: false }),
    listStoredCategoryReads(user.id, supabase),
    readCategoryReadTally(user.id, supabase),
  ]);

  // Bound once: Task 9 reads the same rows to find what is behind a month.
  const rows = (data ?? []) as TransactionWithCategory[];

  const locale = await getLocale();

  const histories = buildCategoryHistory(rows, current.year, current.month, {
    months: MONTHS_READ,
    locale,
  });

  const findings = buildCategoryFindings(histories);

  const cards = histories.map((history) => ({
    history,
    normal: categoryNormal(history.points).normal,
    drawn: history.points.slice(-MONTHS_DRAWN),
    findings: findings.filter((f) => f.categoryId === history.categoryId),
  }));

  /** This month's expense composition, for the strip. `SpendStrip` sorts. */
  const latestKey = `${current.year}-${String(current.month).padStart(2, "0")}`;
  const breakdown = histories
    .filter((history) => history.type === "expense")
    .map((history) => ({
      categoryId: history.categoryId,
      name: history.name,
      type: "expense" as const,
      icon: null,
      total:
        history.points.find((point) => point.monthKey === latestKey)?.total ??
        0,
    }))
    .filter((row) => row.total > 0);
  const breakdownTotal = breakdown.reduce((sum, row) => sum + row.total, 0);

  // The same bucketing `buildCategoryHistory` used to build `points`, so a
  // period-shifted category's "behind this month" list is drawn from the
  // same buckets its chart is — not from a calendar prefix that can disagree
  // with them. See `categoryBucketing`'s doc comment.
  const bucketing = categoryBucketing(rows);

  /** The month a category's panel explains, and the entries inside it. */
  const behind = new Map<string, TransactionWithCategory[]>();
  /** Same target months as `behind`, as `YYYY-MM` and as a label. */
  const behindMonthByCategory: Record<string, string> = {};
  const behindMonthLabelByCategory: Record<string, string> = {};
  for (const card of cards) {
    const target =
      card.findings[0]?.months[card.findings[0].months.length - 1] ??
      card.drawn[card.drawn.length - 1]?.monthKey;
    if (!target) {
      continue;
    }
    const grouping = bucketing.get(card.history.categoryId);
    behind.set(
      card.history.categoryId,
      rows
        .filter(
          (row) =>
            row.category_id === card.history.categoryId &&
            (grouping
              ? grouping.keyOf(row.occurred_on) === target
              : row.occurred_on.startsWith(target)),
        )
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 5),
    );
    const [y, m] = target.split("-").map(Number);
    behindMonthByCategory[card.history.categoryId] = target;
    behindMonthLabelByCategory[card.history.categoryId] = formatMonthLabel(
      y,
      m,
      locale,
    );
  }

  /**
   * A `Map` does not cross the server-component boundary, and neither does a
   * database row shape the panel has no use for. Both are flattened here.
   */
  const behindByCategory = Object.fromEntries(
    [...behind].map(([categoryId, entries]) => [
      categoryId,
      entries.map((entry) => ({
        id: entry.id,
        occurredOn: entry.occurred_on,
        note: entry.note,
        amount: Number(entry.amount),
      })),
    ]),
  );

  /**
   * The category read, per card, drawn up front rather than behind a second
   * round trip per panel opened — every card on this page is already built
   * this way, findings and all.
   *
   * `thin` needs nothing beyond `history`, so it is computed for every card
   * from data already in hand. `getMonthlySummary` and `getBudgets` feed only
   * `share-of-month` and `cap`, and those reach a screen only inside a
   * rendered read — so they are fetched, as one further round-trip stage,
   * only when there is at least one stored read for them to feed. On every
   * load before anyone has ever pressed the button, that stage does not run
   * at all.
   */
  const readMonthLabel = formatMonthLabel(current.year, current.month, locale);
  const readConfigured = categoryReadConfigured();
  const readWritesLeft = tally.tracked
    ? writesRemaining(
        { writes: tally.writes, refused: 0, lastWrittenAt: null, pendingSince: null },
        CATEGORY_READ_WRITES_PER_MONTH,
      )
    : 0;

  const hasStoredRead = [...storedReads.values()].some((row) => row.read !== null);
  const [summary, budgets] = hasStoredRead
    ? await Promise.all([
        getMonthlySummary(user.id, current.year, current.month, "current"),
        getBudgets(user.id),
      ])
    : [null, []];

  const capByCategory = new Map(
    budgets
      .filter((row) => row.category_id !== null)
      .map((row) => [row.category_id as string, Number(row.amount)] as const),
  );

  const readsByCategory: Record<string, CategoryReadValue | null> = {};
  const readFactsByCategory: Record<string, CategoryFacts | null> = {};
  const readLocaleByCategory: Record<string, Locale> = {};
  const readThinByCategory: Record<string, boolean> = {};

  for (const card of cards) {
    const categoryId = card.history.categoryId;
    const stored = storedReads.get(categoryId) ?? null;
    const readLocale = stored?.locale ?? locale;

    readsByCategory[categoryId] = stored?.read ?? null;
    readLocaleByCategory[categoryId] = readLocale;
    readThinByCategory[categoryId] = categoryReadIsThin(card.history);
    // Only built when there is a read to render against it, and `summary` is
    // only non-null when that is true of at least one card.
    readFactsByCategory[categoryId] =
      stored?.read && summary
        ? currentCategoryFacts({
            categoryId,
            categoryName: card.history.name,
            type: card.history.type,
            history: card.history,
            findings: card.findings,
            monthExpenses: summary.expenses,
            cap: capByCategory.get(categoryId) ?? null,
            monthLabel: readMonthLabel,
            locale: readLocale,
          })
        : null;
  }

  return (
    <>
      <PageHeader titleKey="nav.ledger" />
      <PageContainer>
        <SurfaceTabs tabs={LEDGER_TABS} className="mb-4" />
        <CategoryHistoryView
          cards={cards}
          findings={findings}
          breakdown={breakdown}
          breakdownTotal={breakdownTotal}
          behind={behindByCategory}
          behindMonth={behindMonthByCategory}
          behindMonthLabel={behindMonthLabelByCategory}
          reads={readsByCategory}
          readFacts={readFactsByCategory}
          readLocale={readLocaleByCategory}
          readThin={readThinByCategory}
          readWritesLeft={readWritesLeft}
          readConfigured={readConfigured}
        />
      </PageContainer>
    </>
  );
}
