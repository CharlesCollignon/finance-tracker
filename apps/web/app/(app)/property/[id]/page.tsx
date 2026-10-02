import { notFound, redirect } from "next/navigation";
import { todayIsoLocal } from "@finance/core/constants";
import { isFlagOn } from "@finance/core/flags";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PropertyDetail } from "@/components/finance/property/PropertyDetail";
import { getAuthUser } from "@/lib/auth/get-user";
import { getFlags } from "@/lib/flags";
import { getPropertyDetail } from "@/lib/queries/properties";

/**
 * One property: its value and on whose word, its loans, and what is attached
 * to it. A property that is not the user's, or no longer exists, is no page.
 */
export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  if (!isFlagOn(await getFlags(), "property.track")) {
    notFound();
  }

  const { id } = await params;
  const detail = await getPropertyDetail(user.id, id);
  if (!detail) {
    notFound();
  }

  return (
    <>
      <PageHeader titleKey="nav.property" />
      <PageContainer>
        <PropertyDetail detail={detail} today={todayIsoLocal()} />
      </PageContainer>
    </>
  );
}
