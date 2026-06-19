import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncAllRecurringInvestmentPositions } from "@/lib/investment-recurring-sync";
import { getCategories, seedDefaultCategories } from "@/lib/queries/categories";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import {
  fetchLiveQuotes,
  getInvestmentPositions,
} from "@/lib/queries/investments";
import { buildInvestmentPortfolio } from "@/lib/investment-positions";
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
  await syncAllRecurringInvestmentPositions(supabase, user.id);

  const [categories, transactions, positionRows, recurringTemplates] =
    await Promise.all([
      getCategories(user.id),
      getInvestmentTransactions(user.id),
      getInvestmentPositions(user.id),
      getRecurringTemplates(user.id),
    ]);

  const quoteSymbols = new Set<string>();

  for (const row of positionRows) {
    if (row.instrument_symbol) {
      quoteSymbols.add(row.instrument_symbol);
    }
  }

  for (const template of recurringTemplates) {
    if (template.instrument_symbol) {
      quoteSymbols.add(template.instrument_symbol);
    }
  }

  const liveQuotes = await fetchLiveQuotes(Array.from(quoteSymbols));
  const portfolio = buildInvestmentPortfolio(
    categories,
    transactions,
    positionRows,
    recurringTemplates,
    liveQuotes,
  );

  return (
    <InvestmentsView
      portfolio={portfolio}
      recurringTemplates={recurringTemplates.filter(
        (template) => template.categories.type === "investment",
      )}
    />
  );
}
