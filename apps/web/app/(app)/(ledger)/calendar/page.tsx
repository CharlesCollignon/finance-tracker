import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { getCategories } from "@/lib/queries/categories";
import {
  getRecurringSkipKeys,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries/finance";
import {
  plannedOccurrences,
  recurringOccurrenceKey,
} from "@finance/core/apply-recurring";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { resolveMonthScope } from "@/lib/month-scope";
import { CalendarView } from "@/components/finance/CalendarView";
import {
  getBankForecast,
  getConfirmedTransactionIds,
  getFulfilledKeys,
  getFulfilmentProposals,
} from "@/lib/queries/fulfilment";
import { hasBankFeed } from "@/lib/queries/bank";

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

  // Whose money: the person's, or their space's under « Commun ».
  const owner = await getOwner();
  const ownerId = owner?.ownerId ?? user.id;

  const params = await searchParams;
  const { year, month } = await resolveMonthScope(params);
  const [
    transactions,
    categories,
    recurringTemplates,
    confirmedTransactionIds,
    skippedKeys,
    fulfilledKeys,
    bankFed,
  ] = await Promise.all([
    getTransactions(ownerId, year, month),
    getCategories(ownerId),
    getRecurringTemplates(ownerId),
    // Which rows settle a recurring charge. Needs nothing else this batch
    // fetches, so it rides along rather than costing a second round trip.
    getConfirmedTransactionIds(ownerId),
    // What keeps an occurrence from being drawn as planned.
    getRecurringSkipKeys(ownerId, year, month),
    getFulfilledKeys(ownerId),
    hasBankFeed(ownerId),
  ]);

  // Asked after the batch, because they need the templates and categories
  // the batch fetched. Only the ids are handed on: a proposal carries twelve
  // fields explaining why it was offered, and a row needs none of them.
  const today = todayIsoLocal();
  const now = getCurrentMonth();
  const [proposals, bankForecast] = await Promise.all([
    // The ones Le point asks about, as the Ledger marks them.
    getFulfilmentProposals(
      ownerId,
      recurringTemplates,
      categories,
      now.year,
      now.month,
    ),
    getBankForecast(ownerId, recurringTemplates, bankFed, today),
  ]);

  // The Ledger list draws these too; see its page for why they are drawn
  // rather than stored.
  const planned = plannedOccurrences(
    recurringTemplates,
    new Set(
      transactions.flatMap((tx) =>
        tx.recurring_template_id
          ? [recurringOccurrenceKey(tx.recurring_template_id, tx.occurred_on)]
          : [],
      ),
    ),
    year,
    month,
    new Set([...skippedKeys, ...fulfilledKeys]),
    today,
    bankForecast,
  );

  return (
    <CalendarView
      transactions={transactions}
      planned={planned}
      categories={categories}
      recurringTemplates={recurringTemplates}
      confirmedTransactionIds={[...confirmedTransactionIds]}
      proposedTransactionIds={proposals.map(
        (proposal) => proposal.transactionId,
      )}
      year={year}
      month={month}
      // Bitstack's buys leave the account; a DCA bought at the broker does not.
      debitedCategoryIds={[...(bankForecast?.debited ?? [])]}
    />
  );
}
