import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  getInvestmentTransactions,
  getRecurringSkipKeys,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { InvestmentsView } from "@/components/finance/InvestmentsView";
import {
  buildUpcomingInvestments,
  buildWalletFundingNeeds,
  nextUpcomingByWallet,
} from "@finance/core/investment-upcoming";
import {
  getCurrentMonth,
  shiftMonth,
  todayIsoLocal,
} from "@finance/core/constants";

export default async function InvestmentsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();
  const next = shiftMonth(current.year, current.month, 1);
  const [portfolio, recurringTemplates, transactions, skipThis, skipNext] =
    await Promise.all([
      getWalletPortfolio(user.id),
      getRecurringTemplates(user.id),
      getInvestmentTransactions(user.id),
      getRecurringSkipKeys(user.id, current.year, current.month),
      getRecurringSkipKeys(user.id, next.year, next.month),
    ]);

  const skippedKeys = new Set([...skipThis, ...skipNext]);
  const investmentTemplates = recurringTemplates.filter(
    (template) => template.categories.type === "investment",
  );
  const upcomingInvestments = buildUpcomingInvestments(
    investmentTemplates,
    transactions,
    todayIsoLocal(),
    skippedKeys,
  );
  const fundingNeeds = buildWalletFundingNeeds(
    investmentTemplates,
    current.year,
    current.month,
  );

  return (
    <InvestmentsView
      portfolio={portfolio}
      recurringTemplates={investmentTemplates}
      nextUpcomingByWallet={nextUpcomingByWallet(upcomingInvestments)}
      fundingNeeds={fundingNeeds}
    />
  );
}
