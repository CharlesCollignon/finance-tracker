import { redirect } from "next/navigation";
import type { AccountId } from "@finance/core/allocation";
import { buildInvestmentReturns } from "@finance/core/investment-returns";
import { getAuthUser } from "@/lib/auth/get-user";
import { getPlacementsBase } from "@/lib/queries/placements";
import { AnalysisView } from "@/components/finance/analysis/AnalysisView";
import { RefreshQuotesButton } from "@/components/finance/RefreshQuotesButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";

/**
 * Placements, Analyse: what each account earns, how the money is spread
 * across all of them, and what it costs to hold. Read from the same base as
 * Comptes, so the two tabs never disagree on which accounts there are.
 */
export default async function AnalysisPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const base = await getPlacementsBase(user.id);

  const returns = buildInvestmentReturns(
    base.investmentTransactions,
    base.portfolio,
    base.today,
  );

  const values: Partial<Record<AccountId, number>> = Object.fromEntries([
    ...base.savings.accounts.map((account) => [
      account.kind,
      account.balance.balance,
    ]),
    ...base.portfolio.columns.map((column) => [
      column.walletId,
      column.totalMarketValue,
    ]),
  ]);
  const monthly: Partial<Record<AccountId, number>> = Object.fromEntries([
    ...Object.entries(base.savingsMonthly),
    ...base.fundingNeeds.map((need) => [need.walletId, need.monthlyTotal]),
  ]);

  // What a typical month puts in, so the split suggestion is in real money
  // rather than an abstract percentage — savings accounts included, since
  // they are in the split.
  const monthlyContribution = base.accounts.reduce(
    (sum, accountId) => sum + (monthly[accountId] ?? 0),
    0,
  );

  return (
    <>
      <PageHeader titleKey="nav.wallets" />
      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SurfaceTabs tabs={WALLET_TABS} />
          {base.keptWallets.length > 0 ? <RefreshQuotesButton /> : null}
        </div>

        <AnalysisView
          portfolio={base.portfolio}
          returns={returns}
          plans={base.plans}
          savingsAccounts={base.savings.accounts}
          keptWallets={base.keptWallets}
          accounts={base.accounts}
          values={values}
          monthly={monthly}
          targets={base.targets}
          monthlyContribution={monthlyContribution}
        />
      </PageContainer>
    </>
  );
}
