import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { buildCategoryHistory } from "@finance/core/category-history";
import {
  buildCategoryFindings,
  categoryNormal,
} from "@finance/core/category-findings";
import { getCurrentMonth, shiftMonth } from "@finance/core/constants";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { CategoryHistoryView } from "@/components/finance/category/CategoryHistoryView";
import { getLocale } from "@/lib/locale";

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
  const { data } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", user.id)
    .gte("occurred_on", from)
    .order("occurred_on", { ascending: false });

  // Bound once: Task 9 reads the same rows to find what is behind a month.
  const rows = (data ?? []) as TransactionWithCategory[];

  const histories = buildCategoryHistory(rows, current.year, current.month, {
    months: MONTHS_READ,
    locale: await getLocale(),
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
        />
      </PageContainer>
    </>
  );
}
