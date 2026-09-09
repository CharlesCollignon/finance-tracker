import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates, getTransactions } from "@/lib/queries/finance";
import { resolveMonthScope } from "@/lib/month-scope";
import { CalendarView } from "@/components/finance/CalendarView";
import {
  getConfirmedTransactionIds,
  getFulfilmentProposals,
} from "@/lib/queries/fulfilment";

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
  const [
    transactions,
    categories,
    recurringTemplates,
    confirmedTransactionIds,
  ] = await Promise.all([
    getTransactions(user.id, year, month),
    getCategories(user.id),
    getRecurringTemplates(user.id),
    // Which rows settle a recurring charge. Needs nothing else this batch
    // fetches, so it rides along rather than costing a second round trip.
    getConfirmedTransactionIds(user.id),
  ]);

  // Asked after the batch, because it needs the templates and categories the
  // batch fetched. Only the ids are handed on: a proposal carries twelve
  // fields explaining why it was offered, and a row needs none of them.
  const proposals = await getFulfilmentProposals(
    user.id,
    recurringTemplates,
    categories,
    year,
    month,
  );

  return (
    <CalendarView
      transactions={transactions}
      categories={categories}
      recurringTemplates={recurringTemplates}
      confirmedTransactionIds={[...confirmedTransactionIds]}
      proposedTransactionIds={proposals.map(
        (proposal) => proposal.transactionId,
      )}
      year={year}
      month={month}
    />
  );
}
