import { notFound, redirect } from "next/navigation";
import { todayIsoLocal } from "@finance/core/constants";
import { isFlagOn } from "@finance/core/flags";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PropertyDetail } from "@/components/finance/property/PropertyDetail";
import { getAuthUser } from "@/lib/auth/get-user";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { getPropertyShares } from "@finance/data/properties";
import type { JointDeedView } from "@/components/finance/property/JointDeed";
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
  // The person's home, or their space's under « Commun ».
  const owner = await getOwner();
  const read = await getPropertyDetail(owner?.ownerId ?? user.id, id);
  if (!read) {
    notFound();
  }

  // A home the space owns: each partner's part of the deed, the space's
  // split until it is set (6c).
  let deed: JointDeedView | null = null;
  if (owner?.joint && owner.space) {
    const shares = (await getPropertyShares(await createClient(), [id])).get(
      id,
    );
    const self = owner.space.members.find(
      (member) => member.userId === owner.userId,
    );
    const partner = owner.space.members.find(
      (member) => member.userId !== owner.userId,
    );
    deed = {
      mine: shares?.get(owner.userId) ?? self?.share ?? 0.5,
      selfName: self?.name ?? "",
      partnerName: partner?.name ?? "",
    };
  }

  return (
    <>
      <PageHeader titleKey="nav.property" />
      <PageContainer>
        <PropertyDetail
          detail={read.detail}
          looseTemplates={read.looseTemplates}
          today={todayIsoLocal()}
          readingPending={(await searchParams).lecture === "1"}
          deed={deed}
        />
      </PageContainer>
    </>
  );
}
