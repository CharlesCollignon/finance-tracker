import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, seedDefaultCategories } from "@/lib/queries/categories";
import { getRecurringTemplates, getTransactions } from "@/lib/queries/finance";
import { parseMonthParams } from "@/lib/constants";
import { CalendarView } from "@/components/finance/CalendarView";

interface CalendarPageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await seedDefaultCategories(user.id);

  const params = await searchParams;
  const { year, month } = parseMonthParams(params.y, params.m);
  const [transactions, categories, recurringTemplates] = await Promise.all([
    getTransactions(user.id, year, month),
    getCategories(user.id),
    getRecurringTemplates(user.id),
  ]);

  return (
    <CalendarView
      transactions={transactions}
      categories={categories}
      recurringTemplates={recurringTemplates}
      year={year}
      month={month}
    />
  );
}
