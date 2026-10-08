import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { getCategories } from "@/lib/queries/categories";
import {
  getRecordedThisMonth,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import {
  getDebitedWalletCategories,
  getRecurringProposals,
  hasBankFeed,
} from "@/lib/queries/bank";
import { todayIsoLocal } from "@finance/core/constants";
import { isFlagOn } from "@finance/core/flags";
import { getFlags } from "@/lib/flags";
import { getPropertyNames } from "@/lib/queries/properties";
import { RecurringView } from "@/components/finance/RecurringView";
import { readSubscriptions } from "@finance/data/subscriptions";
import { createClient } from "@/lib/supabase/server";

interface RecurringPageProps {
  searchParams: Promise<{ edit?: string }>;
}

export default async function RecurringPage({
  searchParams,
}: RecurringPageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Whose money: the person's, or their space's under « Commun ».
  const owner = await getOwner();
  const ownerId = owner?.ownerId ?? user.id;

  const [
    templates,
    categories,
    bankFed,
    recordedThisMonth,
    params,
    flags,
    watched,
  ] = await Promise.all([
    getRecurringTemplates(ownerId),
    getCategories(ownerId),
    hasBankFeed(ownerId),
    // What editing a charge asks about: the days it is already recorded on
    // this month.
    getRecordedThisMonth(ownerId),
    searchParams,
    getFlags(),
    // The services the ledger shows being paid, for « Abonnements ».
    readSubscriptions(await createClient(), ownerId, todayIsoLocal()).catch(
      () => ({ subscriptions: [], findings: [] }),
    ),
  ]);
  // What a charge can belong to, for an account that keeps properties.
  const properties = isFlagOn(flags, "property.track")
    ? await getPropertyNames(ownerId)
    : [];

  // Only worth asking where there is a statement to read it out of. Without
  // one the transactions are the user's own typing, and they already know
  // what repeats.
  // And only a bank can have debited a wallet from the account.
  const [proposals, debited] = bankFed
    ? await Promise.all([
        getRecurringProposals(ownerId, todayIsoLocal()),
        getDebitedWalletCategories(ownerId),
      ])
    : [[], []];

  return (
    <RecurringView
      templates={templates}
      categories={categories}
      proposals={proposals}
      recordedThisMonth={recordedThisMonth}
      // A planned row's "Edit the charge" lands here with the editor open.
      initialEditId={params.edit}
      properties={properties}
      debitedCategoryIds={debited}
      subscriptions={watched}
    />
  );
}
