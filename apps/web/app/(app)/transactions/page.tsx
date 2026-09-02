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
import {
  countSwallowedFeedItems,
  countFeedItems,
  getPendingFeedItems,
} from "@/lib/queries/bank";
import { SwallowedRecovery } from "@/components/finance/SwallowedRecovery";

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
  const [feedItems, swallowed, feedSize] = bankFeedConfigured()
    ? await Promise.all([
        getPendingFeedItems(user.id),
        countSwallowedFeedItems(user.id),
        countFeedItems(user.id),
      ])
    : [null, 0, 0];

  return (
    <>
      {feedItems ? (
        <PageContainer className="flex flex-col gap-4 pb-0">
          <SwallowedRecovery count={swallowed} />
          <BankInbox
            items={feedItems}
            categories={categories}
            // A statement worth of rows means the backfill has been done.
            showBackfill={feedSize < 400}
          />
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
