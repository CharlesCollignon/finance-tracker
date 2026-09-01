import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getWalletPlans } from "@/lib/queries/investments";
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
  const [portfolio, recurringTemplates, plans, investmentTransactions] =
    await Promise.all([
      getWalletPortfolio(user.id),
      getRecurringTemplates(user.id),
      getWalletPlans(user.id),
      getInvestmentTransactions(user.id),
    ]);

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
    todayIsoLocal(),
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
