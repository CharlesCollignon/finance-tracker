import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import {
  monthlyContributions,
  type EnvelopeId,
} from "@finance/core/future-plan";
import type { Locale } from "@finance/core/i18n/locale";
import {
  buildInvestmentReturns,
  type InvestmentReturns,
} from "@finance/core/investment-returns";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import {
  buildUpcomingInvestments,
  buildWalletFundingNeeds,
  type UpcomingInvestment,
  type WalletFundingNeed,
} from "@finance/core/investment-upcoming";
import {
  keptWallets,
  type InvestmentWalletId,
} from "@finance/core/investments";
import { defaultSavingsKind } from "@finance/core/savings-accounts";
import type {
  RecurringTemplateWithCategory,
  SavingsAccountKind,
  TransactionWithCategory,
  WalletPlan,
} from "@finance/core/types/database";

import {
  getInvestmentTransactions,
  getRecurringTemplates,
  getWalletPortfolio,
  getWalletPlans,
} from "@/lib/queries";
import {
  getSavingsState,
  savingsCategoryKinds,
  type SavingsState,
} from "@/lib/savings-accounts";

/**
 * What Placements' two own views read — the accounts, and their analysis —
 * gathered once, so both count the same accounts the same way.
 */
export interface PlacementsData {
  portfolio: InvestmentPortfolioSummary;
  upcoming: UpcomingInvestment[];
  fundingNeeds: WalletFundingNeed[];
  returns: InvestmentReturns;
  plans: WalletPlan[];
  templates: RecurringTemplateWithCategory[];
  savings: SavingsState;
}

export async function getPlacementsData(
  userId: string,
  locale: Locale,
  { includeHistory = false }: { includeHistory?: boolean } = {},
): Promise<PlacementsData> {
  const { year, month } = getCurrentMonth();
  const [portfolio, templates, transactions, plans, savings] =
    await Promise.all([
      getWalletPortfolio(userId, locale, { includeHistory }),
      getRecurringTemplates(userId),
      getInvestmentTransactions(userId),
      getWalletPlans(userId),
      getSavingsState(userId),
    ]);
  const allTemplates = templates as RecurringTemplateWithCategory[];
  const investmentTemplates = allTemplates.filter(
    (template) => template.categories.type === "investment",
  );
  return {
    portfolio,
    upcoming: buildUpcomingInvestments(
      investmentTemplates,
      transactions as TransactionWithCategory[],
      todayIsoLocal(),
      locale,
    ),
    fundingNeeds: buildWalletFundingNeeds(investmentTemplates, year, month),
    returns: buildInvestmentReturns(
      transactions as TransactionWithCategory[],
      portfolio,
      todayIsoLocal(),
    ),
    plans,
    templates: allTemplates,
    savings,
  };
}

export interface KeptAccounts {
  /** The wallets kept: with positions, or added (`wallet_plans.shown`). */
  wallets: InvestmentWalletId[];
  /** The savings accounts declared, in `SAVINGS_KINDS` order. */
  savingsKinds: SavingsAccountKind[];
  /** The portfolio, cut down to the wallets kept. */
  keptPortfolio: InvestmentPortfolioSummary;
  /** What each savings account has planned for it each month. */
  savingsMonthly: Partial<Record<EnvelopeId, number>>;
  /** What the savings accounts hold today. */
  savingsTotal: number;
}

export function keptAccounts(data: PlacementsData): KeptAccounts {
  const { year, month } = getCurrentMonth();
  const wallets = keptWallets({
    withPositions: data.portfolio.columns
      .filter((column) => column.items.length > 0)
      .map((column) => column.walletId),
    shown: data.plans.filter((plan) => plan.shown).map((plan) => plan.wallet),
  });
  const savingsKinds = data.savings.accounts.map((view) => view.account.kind);
  return {
    wallets,
    savingsKinds,
    keptPortfolio: {
      ...data.portfolio,
      columns: data.portfolio.columns.filter((column) =>
        wallets.includes(column.walletId),
      ),
    },
    savingsMonthly: monthlyContributions({
      templates: data.templates,
      wallets: {},
      templateWallets: {},
      savingsCategories: savingsCategoryKinds(data.savings.accounts),
      defaultSavings: defaultSavingsKind(savingsKinds) ?? "savings",
      year,
      month,
      today: todayIsoLocal(),
    }),
    savingsTotal: data.savings.accounts.reduce(
      (sum, view) => sum + view.balance.balance,
      0,
    ),
  };
}
