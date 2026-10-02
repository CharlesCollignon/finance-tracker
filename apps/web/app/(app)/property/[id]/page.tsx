import { notFound, redirect } from "next/navigation";
import { todayIsoLocal } from "@finance/core/constants";
import { isFlagOn } from "@finance/core/flags";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PropertyDetail } from "@/components/finance/property/PropertyDetail";
import { getAuthUser } from "@/lib/auth/get-user";
import { getFlags } from "@/lib/flags";
import { getPropertyDetail } from "@/lib/queries/properties";

// The actions on this page read the market, and finish a slow reading after
// the response (`readPropertyMarketSoon`): a minute is what that may take.
export const maxDuration = 60;
/**
 * One property: its value and on whose word, its loans, and what is attached
 * to it. A property that is not the user's, or no longer exists, is no page.
 */
export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `lecture=1`: just added, its market still being read. */
  searchParams: Promise<{ lecture?: string }>;
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
        <PropertyDetail
          detail={detail}
          today={todayIsoLocal()}
          readingPending={(await searchParams).lecture === "1"}
        />
      </PageContainer>
    </>
  );
}
