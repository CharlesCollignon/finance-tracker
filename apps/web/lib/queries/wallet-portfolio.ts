import { todayIsoLocal } from "@finance/core/constants";
import { buildInvestmentPortfolio } from "@finance/core/investment-positions";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import { getCategories } from "@/lib/queries/categories";
import {
  getInvestmentTransactions,
  getRecurringTemplates,
} from "@/lib/queries/finance";
import { getInvestmentPositions } from "@/lib/queries/investments";
import {
  getCachedHistoricalQuotes,
  getCachedLiveQuotes,
} from "@/lib/queries/market-quotes";

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

export interface GetWalletPortfolioOptions {
  /** When false, skip historical quotes (faster dashboards). Default true. */
  includeHistory?: boolean;
}

export async function getWalletPortfolio(
  userId: string,
  options: GetWalletPortfolioOptions = {},
): Promise<InvestmentPortfolioSummary> {
  const includeHistory = options.includeHistory !== false;

  // Positions are kept in sync when recurring templates are mutated
  // (see lib/actions/finance.ts), so reads don't need to re-sync.
  const [categories, transactions, positionRows, recurringTemplates] =
    await Promise.all([
      // Archived categories stay included: existing positions still
      // reference them for icon/name lookups.
      getCategories(userId, { includeArchived: true }),
      getInvestmentTransactions(userId),
      getInvestmentPositions(userId),
      getRecurringTemplates(userId),
    ]);

  const symbols = collectQuoteSymbols(positionRows, recurringTemplates);
  const [liveQuotes, historicalQuotes] = await Promise.all([
    getCachedLiveQuotes(symbols),
    includeHistory
      ? getCachedHistoricalQuotes(symbols)
      : Promise.resolve({}),
  ]);

  return buildInvestmentPortfolio(
    categories,
    transactions,
    positionRows,
    recurringTemplates,
    liveQuotes,
    todayIsoLocal(),
    historicalQuotes,
  );
}
