import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates, getTransactions } from "@/lib/queries/finance";
import { getTags, getTransactionTagMap } from "@/lib/queries/phase4";
import { parseMonthParams } from "@finance/core/constants";
import { TransactionsView } from "@/components/finance/TransactionsView";
import { BankInbox } from "@/components/finance/BankInbox";
import { PageContainer } from "@/components/layout/PageContainer";
import { bankFeedConfigured } from "@/lib/bank/client";
import { getPendingFeedItems } from "@/lib/queries/bank";

interface TransactionsPageProps {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { year, month } = parseMonthParams(params.y, params.m);
  const [transactions, categories, recurringTemplates, tags, transactionTags] =
    await Promise.all([
      getTransactions(user.id, year, month),
      getCategories(user.id),
      getRecurringTemplates(user.id),
      getTags(user.id),
      getTransactionTagMap(user.id, year, month),
    ]);

  const defaultDate = `${year}-${String(month).padStart(2, "0")}-01`;

  // Only queried when a bank is actually connected, so the page costs nothing
  // extra on a deployment that has never seen the feed.
  const feedItems = bankFeedConfigured()
    ? await getPendingFeedItems(user.id)
    : null;

  return (
    <>
      {feedItems ? (
        <PageContainer className="pb-0">
          <BankInbox items={feedItems} categories={categories} />
        </PageContainer>
      ) : null}
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
    </>
  );
}
