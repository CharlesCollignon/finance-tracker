import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import { CategoriesView } from "@/components/finance/CategoriesView";

export default async function CategoriesPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const categories = await getCategories(user.id, { includeArchived: true });

  return <CategoriesView categories={categories} />;
}
