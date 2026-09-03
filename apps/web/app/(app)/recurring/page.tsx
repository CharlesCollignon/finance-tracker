import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getRecurringProposals, hasBankFeed } from "@/lib/queries/bank";
import { todayIsoLocal } from "@finance/core/constants";
import { RecurringView } from "@/components/finance/RecurringView";

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
    <RecurringView
      templates={templates}
      categories={categories}
      proposals={proposals}
    />
  );
}
