import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { getQuickEntryContext } from "@/lib/queries/quick-entry";
import { ImportView } from "@/components/finance/ImportView";

export const metadata = {
  title: "Import",
};

export default async function ImportPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Same context the quick-add sheet uses: the categories to file rows under,
  // and what the app has learned about where money goes.
  const ownerId = (await getOwner())?.ownerId ?? user.id;
  const { categories, merchants } = await getQuickEntryContext(ownerId);

  return <ImportView categories={categories} merchants={merchants} />;
}
