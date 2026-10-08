import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { getCategories } from "@/lib/queries/categories";
import { CategoriesView } from "@/components/finance/CategoriesView";

export default async function CategoriesPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const ownerId = (await getOwner())?.ownerId ?? user.id;
  const categories = await getCategories(ownerId, { includeArchived: true });

  return <CategoriesView categories={categories} />;
}
