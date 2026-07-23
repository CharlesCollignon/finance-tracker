import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { buildUpcomingInvestments, nextUpcomingByWallet } from "@finance/core/investment-upcoming";
import { todayIsoLocal } from "@finance/core/constants";
import { InvestmentsView } from "@/components/finance/InvestmentsView";

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await seedDefaultCategories(user.id);

  const [portfolio, recurringTemplates, transactions] = await Promise.all([
    getWalletPortfolio(user.id),
    getRecurringTemplates(user.id),
    getInvestmentTransactions(user.id),
  ]);

  const upcomingInvestments = buildUpcomingInvestments(
    recurringTemplates,
    transactions,
    todayIsoLocal(),
  );

  return (
    <InvestmentsView
      portfolio={portfolio}
      recurringTemplates={recurringTemplates.filter(
        (template) => template.categories.type === "investment",
      )}
      nextUpcomingByWallet={nextUpcomingByWallet(upcomingInvestments)}
    />
  );
}
