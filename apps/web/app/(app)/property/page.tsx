import { notFound, redirect } from "next/navigation";
import { isFlagOn } from "@finance/core/flags";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PropertyList } from "@/components/finance/property/PropertyList";
import { getAuthUser } from "@/lib/auth/get-user";
import { getFlags } from "@/lib/flags";
import { getPropertiesView } from "@/lib/queries/properties";

// The actions on this page read the market, and finish a slow reading after
// the response (`readPropertyMarketSoon`): a minute is what that may take.
export const maxDuration = 60;
/**
 * Immobilier: the homes a user owns, what each is worth to them once its
 * loans are counted, and the way to add one. Only for an account with
 * `property.track` while it is built; anyone else finds no such page.
 */
export default async function PropertyPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  if (!isFlagOn(await getFlags(), "property.track")) {
    notFound();
  }

  const view = await getPropertiesView(user.id);

  return (
    <>
      <PageHeader titleKey="nav.property" />
      <PageContainer>
        <PropertyList view={view} />
      </PageContainer>
    </>
  );
}
