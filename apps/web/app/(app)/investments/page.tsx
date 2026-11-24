import { redirect } from "next/navigation";
import { heldSymbols } from "@finance/core/holdings-overview";
import { buildUpcomingInvestments } from "@finance/core/investment-upcoming";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import { getPlacementsBase } from "@/lib/queries/placements";
import { getCachedPriceSeries } from "@/lib/queries/market-quotes";
import { InvestmentsView } from "@/components/finance/InvestmentsView";

/**
 * Placements, Comptes: every account the user keeps, one at a time, in their
 * order. What is
 * asked of all of them at once — returns, the split, the fees — is the
 * Analyse tab's.
 */
export default async function InvestmentsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const base = await getPlacementsBase(user.id);

  const priceSeries = await getCachedPriceSeries(
    heldSymbols(base.portfolio),
    base.today,
  );

  // The next purchase the recurring entries plan, as the phone's summary
  // says it: the earliest one not yet made.
  const nextPurchase =
    buildUpcomingInvestments(
      base.investmentTemplates,
      base.investmentTransactions,
      base.today,
      await getLocale(),
    )[0] ?? null;

  return (
    <InvestmentsView
      portfolio={base.portfolio}
      recurringTemplates={base.investmentTemplates}
      fundingNeeds={base.fundingNeeds}
      nextPurchase={nextPurchase}
      priceSeries={priceSeries}
      savings={base.savings}
      keptWallets={base.keptWallets}
      accounts={base.accounts}
      savingsMonthly={base.savingsMonthly}
      plans={base.plans}
      events={base.events}
    />
  );
}
