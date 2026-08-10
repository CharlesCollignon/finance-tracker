import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries/categories";
import { CategoriesView } from "@/components/finance/CategoriesView";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const categories = await getCategories(user.id, { includeArchived: true });

  return <CategoriesView categories={categories} />;
}
