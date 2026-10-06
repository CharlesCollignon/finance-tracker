import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
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

  const [templates, categories, bankFed, recordedThisMonth, params, flags] =
    await Promise.all([
      getRecurringTemplates(user.id),
      getCategories(user.id),
      hasBankFeed(user.id),
      // What editing a charge asks about: the days it is already recorded on
      // this month.
      getRecordedThisMonth(user.id),
      searchParams,
      getFlags(),
    ]);
  // What a charge can belong to, for an account that keeps properties.
  const properties = isFlagOn(flags, "property.track")
    ? await getPropertyNames(user.id)
    : [];

  // Only worth asking where there is a statement to read it out of. Without
  // one the transactions are the user's own typing, and they already know
  // what repeats.
  // And only a bank can have debited a wallet from the account.
  const [proposals, debited] = bankFed
    ? await Promise.all([
        getRecurringProposals(user.id, todayIsoLocal()),
        getDebitedWalletCategories(user.id),
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
    />
  );
}
