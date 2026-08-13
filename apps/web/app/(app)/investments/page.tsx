import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getRecurringTemplates } from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { InvestmentsView } from "@/components/finance/InvestmentsView";
import { buildWalletFundingNeeds } from "@finance/core/investment-upcoming";
import { getCurrentMonth } from "@finance/core/constants";

export default async function InvestmentsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();
  const [portfolio, recurringTemplates] = await Promise.all([
    getWalletPortfolio(user.id),
    getRecurringTemplates(user.id),
  ]);

  const investmentTemplates = recurringTemplates.filter(
    (template) => template.categories.type === "investment",
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
      fundingNeeds={fundingNeeds}
    />
  );
}
