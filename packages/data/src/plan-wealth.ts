import { envelopesFromData, wealthToday } from "@finance/core/future-plan";
import type { Locale } from "@finance/core/i18n/locale";
import {
  buildInvestmentPortfolio,
  planWealthFromPortfolio,
  portfolioQuoteSymbols,
} from "@finance/core/investment-positions";
import { fetchQuotesInEur } from "@finance/core/market/fx";

import { getCategories } from "./categories";
import type { Db } from "./client";
import { getInvestmentTransactions, getSavingsReserve } from "./history";
import { getInvestmentPositions } from "./positions";
import { getSavingsAccounts } from "./savings-accounts";
import { getRecurringTemplates } from "./templates";

/**
 * What the Plan stands on today — every account, savings and investments,
 * at today's prices — worked out from the same reads and the same core
 * arithmetic as the Plan on both apps, so a milestone the server announces
 * is the one the Plan shows as passed.
 *
 * Prices every wallet, which is the cost: one quote per symbol held.
 */
export async function getWealthToday(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<number> {
  const [categories, transactions, positions, templates, savings, reserve] =
    await Promise.all([
      getCategories(db, userId, { includeArchived: true }),
      getInvestmentTransactions(db, userId),
      getInvestmentPositions(db, userId),
      getRecurringTemplates(db, userId),
      getSavingsAccounts(db, userId),
      getSavingsReserve(db, userId),
    ]);

  const quotes = await fetchQuotesInEur(
    portfolioQuoteSymbols(positions, templates),
  );
  const portfolio = buildInvestmentPortfolio(
    categories,
    transactions,
    positions,
    templates,
    quotes,
    locale,
    today,
    {},
  );

  return wealthToday(
    envelopesFromData({
      wallets: planWealthFromPortfolio(portfolio).wallets,
      savingsAccounts: savings.accounts.map((view) => ({
        kind: view.account.kind,
        balance: view.balance.balance,
        rate: view.rate,
      })),
      savingsReserve: reserve,
      // What goes in each month does not move where the accounts stand.
      monthly: {},
    }),
  );
}
