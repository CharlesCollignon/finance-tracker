import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getWalletPlans } from "@/lib/queries/investments";
import { getCachedPriceSeries } from "@/lib/queries/market-quotes";
import { getInvestmentTransactions } from "@/lib/queries/finance";
import { InvestmentsView } from "@/components/finance/InvestmentsView";
import { WalletPlanPanel } from "@/components/finance/WalletPlanPanel";
import { FundCostCard } from "@/components/finance/FundCostCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { buildWalletFundingNeeds } from "@finance/core/investment-upcoming";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { buildInvestmentReturns } from "@finance/core/investment-returns";

export default async function InvestmentsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();
  const today = todayIsoLocal();
  const [portfolio, recurringTemplates, plans, investmentTransactions] =
    await Promise.all([
      // No position-value history: this page plots instrument prices now, and
      // the monthly closes behind `chartPoints` are a Yahoo round trip per
      // symbol that nothing here would draw.
      getWalletPortfolio(user.id, { includeHistory: false }),
      getRecurringTemplates(user.id),
      getWalletPlans(user.id),
      getInvestmentTransactions(user.id),
    ]);

  const heldSymbols = Array.from(
    new Set(
      portfolio.columns.flatMap((column) =>
        column.items
          .map((item) => item.instrumentSymbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    ),
  );
  const priceSeries = await getCachedPriceSeries(heldSymbols, today);

  const investmentTemplates = recurringTemplates.filter(
    (template) => template.categories.type === "investment",
  );
  const fundingNeeds = buildWalletFundingNeeds(
    investmentTemplates,
    current.year,
    current.month,
  );

  const returns = buildInvestmentReturns(
    investmentTransactions,
    portfolio,
    today,
  );

  // What a typical month puts in, so the split suggestion is in real money
  // rather than an abstract percentage.
  const monthlyContribution = fundingNeeds.reduce(
    (sum, need) => sum + need.monthlyTotal,
    0,
  );

  return (
    <>
      <InvestmentsView
        portfolio={portfolio}
        recurringTemplates={investmentTemplates}
        fundingNeeds={fundingNeeds}
        priceSeries={priceSeries}
      />

      <PageContainer className="pt-0">
        <WalletPlanPanel
          portfolio={portfolio}
          returns={returns}
          plans={plans}
          monthlyContribution={monthlyContribution}
        />

        <div className="mt-4">
          <FundCostCard portfolio={portfolio} />
        </div>
      </PageContainer>
    </>
  );
}
