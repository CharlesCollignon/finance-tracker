import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import {
  getRecurringSkipKeys,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries/finance";
import {
  getConfirmedTransactionIds,
  getFulfilledKeys,
  getFulfilmentProposals,
} from "@/lib/queries/fulfilment";
import {
  plannedOccurrences,
  recurringOccurrenceKey,
} from "@finance/core/apply-recurring";
import { todayIsoLocal } from "@finance/core/constants";
import { resolveMonthScope } from "@/lib/month-scope";
import { TransactionsView } from "@/components/finance/TransactionsView";
import { BankInbox } from "@/components/finance/BankInbox";
import {
  countSwallowedFeedItems,
  countFeedItems,
  getBankMerchantIndex,
  getDecidedFeedItems,
  getPendingFeedItems,
  hasBankFeed,
} from "@/lib/queries/bank";
import { groupPendingFeed } from "@finance/core/bank-inbox-groups";
import { SwallowedRecovery } from "@/components/finance/SwallowedRecovery";
import { ConnectBankInvite } from "@/components/finance/bank/ConnectBankInvite";
import { shouldInviteToConnect } from "@/lib/bank/invite";
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
    skippedKeys,
    confirmedTransactionIds,
    fulfilledKeys,
  ] = await Promise.all([
    getTransactions(user.id, year, month),
    getCategories(user.id),
    getRecurringTemplates(user.id),
    getRecurringSkipKeys(user.id, year, month),
    // Which rows settle a recurring charge. Needs nothing else this batch
    // fetches, so it rides along rather than costing a second round trip.
    getConfirmedTransactionIds(user.id),
    getFulfilledKeys(user.id),
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

  // What the month's charges still have to bring, drawn rather than stored:
  // the rows a future month shows, and the rest of this one. An occurrence
  // already written, skipped, or fulfilled by another row is not planned.
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
    todayIsoLocal(),
  );

  // Only queried for someone whose ledger a bank has fed, so the page costs
  // nothing extra for everyone else. Per user rather than per deployment now
  // that anyone can connect — and still true after a disconnect that kept
  // the rows, whose decisions can still be taken back.
  const bankFed = await hasBankFeed(user.id);
  const [feedItems, swallowed, feedSize, decided, bankMerchants] = bankFed
    ? await Promise.all([
        getPendingFeedItems(user.id, await getLocale()),
        countSwallowedFeedItems(user.id),
        countFeedItems(user.id),
        getDecidedFeedItems(user.id),
        getBankMerchantIndex(user.id),
      ])
    : [null, 0, 0, [], null];

  // Without a feed, the slot the inbox would fill invites one instead: this
  // page is where typing every line in is felt most.
  const bankInvite =
    !bankFed && (await shouldInviteToConnect(user.id, "ledger"));

  // One answer per shop rather than per row: the review is grouped by the
  // key the matcher files on, with the user's own history suggesting the
  // category — see `groupPendingFeed`.
  const feedGroups =
    feedItems && bankMerchants
      ? groupPendingFeed(feedItems, { bankMerchants, categories })
      : [];

  return (
    <TransactionsView
      transactions={transactions}
      planned={planned}
      categories={categories}
      recurringTemplates={recurringTemplates}
      skippedKeys={[...skippedKeys]}
      fulfilledKeys={[...fulfilledKeys]}
      confirmedTransactionIds={[...confirmedTransactionIds]}
      proposedTransactionIds={proposals.map(
        (proposal) => proposal.transactionId,
      )}
      year={year}
      month={month}
      defaultDate={defaultDate}
      bankSlot={
        feedItems ? (
          <div className="flex flex-col gap-3">
            <SwallowedRecovery count={swallowed} />
            <BankInbox
              items={feedItems}
              groups={feedGroups}
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
        ) : bankInvite ? (
          <ConnectBankInvite surface="ledger" />
        ) : null
      }
    />
  );
}
