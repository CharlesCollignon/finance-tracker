import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { RecurringView } from "@/components/finance/RecurringView";

export default async function RecurringPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [templates, categories] = await Promise.all([
    getRecurringTemplates(user.id),
    getCategories(user.id),
  ]);

  return <RecurringView templates={templates} categories={categories} />;
}
