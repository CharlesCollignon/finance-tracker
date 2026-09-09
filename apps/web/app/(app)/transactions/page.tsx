import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import {
  getRecurringSkipKeys,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries/finance";
import { getTags, getTransactionTagMap } from "@/lib/queries/phase4";
import {
  getConfirmedTransactionIds,
  getFulfilmentProposals,
} from "@/lib/queries/fulfilment";
import { resolveMonthScope } from "@/lib/month-scope";
import { TransactionsView } from "@/components/finance/TransactionsView";
import { BankInbox } from "@/components/finance/BankInbox";
import { bankFeedConfigured } from "@/lib/bank/client";
import {
  countSwallowedFeedItems,
  countFeedItems,
  getDecidedFeedItems,
  getPendingFeedItems,
} from "@/lib/queries/bank";
import { SwallowedRecovery } from "@/components/finance/SwallowedRecovery";
import { getLocale } from "@/lib/locale";

interface TransactionsPageProps {
  searchParams: Promise<{ y?: string; m?: string; review?: string }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  // The month the user was last looking at. The proxy has already put
  // it into the address; this reads it back, and falls back to the cookie for
  // a request that did not pass through there.
  const { year, month } = await resolveMonthScope(params);
  const [
    transactions,
    categories,
    recurringTemplates,
    tags,
    transactionTags,
    skippedKeys,
    confirmedTransactionIds,
  ] = await Promise.all([
    getTransactions(user.id, year, month),
    getCategories(user.id),
    getRecurringTemplates(user.id),
    getTags(user.id),
    getTransactionTagMap(user.id, year, month),
    getRecurringSkipKeys(user.id, year, month),
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

  const defaultDate = `${year}-${String(month).padStart(2, "0")}-01`;

  // Only queried when a bank is actually connected, so the page costs nothing
  // extra on a deployment that has never seen the feed.
  const [feedItems, swallowed, feedSize, decided] = bankFeedConfigured()
    ? await Promise.all([
        getPendingFeedItems(user.id, await getLocale()),
        countSwallowedFeedItems(user.id),
        countFeedItems(user.id),
        getDecidedFeedItems(user.id),
      ])
    : [null, 0, 0, []];

  return (
    <TransactionsView
      transactions={transactions}
      categories={categories}
      recurringTemplates={recurringTemplates}
      skippedKeys={[...skippedKeys]}
      confirmedTransactionIds={[...confirmedTransactionIds]}
      proposedTransactionIds={proposals.map(
        (proposal) => proposal.transactionId,
      )}
      tags={tags}
      transactionTags={transactionTags}
      year={year}
      month={month}
      defaultDate={defaultDate}
      bankSlot={
        feedItems ? (
          <div className="flex flex-col gap-3">
            <SwallowedRecovery count={swallowed} />
            <BankInbox
              items={feedItems}
              decided={decided}
              categories={categories}
              // A statement worth of rows means the backfill has been done.
              showBackfill={feedSize < 400}
              // Only when there is something in it. `?review=inbox` is a
              // link somebody followed, possibly hours after the count it
              // promised was true, and a sheet that opens onto "Nothing
              // waiting" is a worse answer than the page itself.
              openOnArrival={params.review === "inbox" && feedItems.length > 0}
            />
          </div>
        ) : null
      }
    />
  );
}
