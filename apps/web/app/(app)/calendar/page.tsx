import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates, getTransactions } from "@/lib/queries/finance";
import { resolveMonthScope } from "@/lib/month-scope";
import { CalendarView } from "@/components/finance/CalendarView";

interface CalendarPageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { year, month } = await resolveMonthScope(params);
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
