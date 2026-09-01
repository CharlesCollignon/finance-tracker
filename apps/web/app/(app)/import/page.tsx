import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
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
  const { categories, merchants } = await getQuickEntryContext(user.id);

  return <ImportView categories={categories} merchants={merchants} />;
}
