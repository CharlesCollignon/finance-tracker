import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { buildCategoryHistory } from "@finance/core/category-history";
import { getCurrentMonth, shiftMonth } from "@finance/core/constants";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { CategoryHistoryView } from "@/components/finance/CategoryHistoryView";

/** How far back the page looks. A year is one of every seasonal thing. */
const MONTHS = 12;

export default async function HistoryPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();
  const oldest = shiftMonth(current.year, current.month, -(MONTHS - 1));
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", user.id)
    .gte("occurred_on", from)
    .order("occurred_on", { ascending: false });

  const histories = buildCategoryHistory(
    (data ?? []) as TransactionWithCategory[],
    current.year,
    current.month,
    { months: MONTHS },
  );

  return (
    <>
      <PageHeader title="Ledger" />
      <PageContainer>
        <SurfaceTabs tabs={LEDGER_TABS} className="mb-4" />
        <CategoryHistoryView histories={histories} months={MONTHS} />
      </PageContainer>
    </>
  );
}
