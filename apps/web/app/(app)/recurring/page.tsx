import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, seedDefaultCategories } from "@/lib/queries/categories";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { RecurringView } from "@/components/finance/RecurringView";

export default async function RecurringPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await seedDefaultCategories(user.id);

  const [templates, categories] = await Promise.all([
    getRecurringTemplates(user.id),
    getCategories(user.id),
  ]);

  return <RecurringView templates={templates} categories={categories} />;
}
