import { createClient } from "@/lib/supabase/server";
import { todayIsoLocal } from "@/lib/constants";
import { buildInvestmentPortfolio } from "@/lib/investment-positions";
import { syncAllRecurringInvestmentPositions } from "@/lib/investment-recurring-sync";
import type { InvestmentPortfolioSummary } from "@/lib/investment-positions";
import { getCategories } from "@/lib/queries/categories";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import {
  fetchLiveQuotes,
  getInvestmentPositions,
} from "@/lib/queries/investments";

function collectQuoteSymbols(
  positionRows: Awaited<ReturnType<typeof getInvestmentPositions>>,
  recurringTemplates: Awaited<ReturnType<typeof getRecurringTemplates>>,
): string[] {
  const symbols = new Set<string>();

  for (const row of positionRows) {
    if (row.instrument_symbol) {
      symbols.add(row.instrument_symbol);
    }
  }

  for (const template of recurringTemplates) {
    if (template.instrument_symbol) {
      symbols.add(template.instrument_symbol);
    }
  }

  return Array.from(symbols);
}

export async function getWalletPortfolio(
  userId: string,
): Promise<InvestmentPortfolioSummary> {
  const supabase = await createClient();
  await syncAllRecurringInvestmentPositions(supabase, userId);

  const [categories, transactions, positionRows, recurringTemplates] =
    await Promise.all([
      getCategories(userId),
      getInvestmentTransactions(userId),
      getInvestmentPositions(userId),
      getRecurringTemplates(userId),
    ]);

  const liveQuotes = await fetchLiveQuotes(
    collectQuoteSymbols(positionRows, recurringTemplates),
  );

  return buildInvestmentPortfolio(
    categories,
    transactions,
    positionRows,
    recurringTemplates,
    liveQuotes,
    todayIsoLocal(),
  );
}
