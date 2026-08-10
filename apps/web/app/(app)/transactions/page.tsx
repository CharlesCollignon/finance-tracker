import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates, getTransactions } from "@/lib/queries/finance";
import { getTags, getTransactionTagMap } from "@/lib/queries/phase4";
import { parseMonthParams } from "@finance/core/constants";
import { TransactionsView } from "@/components/finance/TransactionsView";

interface TransactionsPageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { year, month } = parseMonthParams(params.y, params.m);
  const [transactions, categories, recurringTemplates, tags] =
    await Promise.all([
      getTransactions(user.id, year, month),
      getCategories(user.id),
      getRecurringTemplates(user.id),
      getTags(user.id),
    ]);

  const transactionTags = await getTransactionTagMap(
    user.id,
    transactions.map((tx) => tx.id),
  );

  const defaultDate = `${year}-${String(month).padStart(2, "0")}-01`;

  return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <TransactionsView
        transactions={transactions}
        categories={categories}
        recurringTemplates={recurringTemplates}
        tags={tags}
        transactionTags={transactionTags}
        year={year}
        month={month}
        defaultDate={defaultDate}
      />
    </Suspense>
  );
}
