import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getPlacementsBase } from "@/lib/queries/placements";
import { getCachedPriceSeries } from "@/lib/queries/market-quotes";
import { InvestmentsView } from "@/components/finance/InvestmentsView";

/**
 * Placements, Comptes: every account the user keeps, one at a time. What is
 * asked of all of them at once — returns, the split, the fees — is the
 * Analyse tab's.
 */
export default async function InvestmentsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const base = await getPlacementsBase(user.id);

  const heldSymbols = Array.from(
    new Set(
      base.portfolio.columns.flatMap((column) =>
        column.items
          .map((item) => item.instrumentSymbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    ),
  );
  const priceSeries = await getCachedPriceSeries(heldSymbols, base.today);

  return (
    <InvestmentsView
      portfolio={base.portfolio}
      recurringTemplates={base.investmentTemplates}
      fundingNeeds={base.fundingNeeds}
      priceSeries={priceSeries}
      savings={base.savings}
      keptWallets={base.keptWallets}
      savingsMonthly={base.savingsMonthly}
      plans={base.plans}
    />
  );
}
