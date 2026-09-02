import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getRecurringProposals, hasBankFeed } from "@/lib/queries/bank";
import { todayIsoLocal } from "@finance/core/constants";
import { PageContainer } from "@/components/layout/PageContainer";
import { RecurringView } from "@/components/finance/RecurringView";
import { RecurringProposals } from "@/components/finance/RecurringProposals";

export default async function RecurringPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [templates, categories, bankFed] = await Promise.all([
    getRecurringTemplates(user.id),
    getCategories(user.id),
    hasBankFeed(user.id),
  ]);

  // Only worth asking where there is a statement to read it out of. Without
  // one the transactions are the user's own typing, and they already know
  // what repeats.
  const proposals = bankFed
    ? await getRecurringProposals(user.id, todayIsoLocal())
    : [];

  return (
    <>
      {proposals.length > 0 ? (
        <PageContainer className="pb-0">
          <RecurringProposals proposals={proposals} />
        </PageContainer>
      ) : null}
      <RecurringView templates={templates} categories={categories} />
    </>
  );
}
