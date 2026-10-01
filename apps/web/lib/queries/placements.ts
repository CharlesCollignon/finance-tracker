import { cache } from "react";
import type { AccountId, AccountTarget } from "@finance/core/allocation";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { monthlyContributions } from "@finance/core/future-plan";
import {
  buildWalletFundingNeeds,
  type WalletFundingNeed,
} from "@finance/core/investment-upcoming";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
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
} from "@/lib/queries/finance";
import { getWalletPlans } from "@/lib/queries/investments";
import {
  getSavingsAccounts,
  type SavingsAccountsRead,
} from "@/lib/queries/savings-accounts";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";

/**
 * What both Placements tabs read: the accounts the user keeps and what each
 * holds and receives. Gathered once here so Comptes and Analyse can never
 * disagree on which accounts there are, or on a savings account's monthly.
 */
export interface PlacementsBase {
  today: string;
  portfolio: InvestmentPortfolioSummary;
  /** The investment templates, for the wallets' funding and positions. */
  investmentTemplates: RecurringTemplateWithCategory[];
  plans: WalletPlan[];
  investmentTransactions: TransactionWithCategory[];
  savings: SavingsAccountsRead;
  /** The wallets the user keeps: those with holdings, and those added. */
  keptWallets: InvestmentWalletId[];
  /** Every account kept, savings first, in the usual order. */
  accounts: AccountId[];
  /** What the recurring entries put into each wallet a month. */
  fundingNeeds: WalletFundingNeed[];
  /** What the recurring entries put into each savings account a month. */
  savingsMonthly: Partial<Record<SavingsAccountKind, number>>;
  /** The target share each account was given, savings accounts included. */
  targets: AccountTarget[];
}

export const getPlacementsBase = cache(
  async (userId: string): Promise<PlacementsBase> => {
    const current = getCurrentMonth();
    const today = todayIsoLocal();
    const [
      portfolio,
      recurringTemplates,
      plans,
      investmentTransactions,
      savings,
    ] = await Promise.all([
      // No position-value history: neither tab plots it, and the monthly
      // closes behind `chartPoints` are a Yahoo round trip per symbol.
      getWalletPortfolio(userId, { includeHistory: false }),
      getRecurringTemplates(userId),
      getWalletPlans(userId),
      getInvestmentTransactions(userId),
      getSavingsAccounts(userId),
    ]);

    // Before migration 046 there is no `shown`, and every wallet with a plan
    // counts as added — what the migration itself sets.
    const kept = keptWallets({
      withPositions: portfolio.columns
        .filter((column) => column.items.length > 0)
        .map((column) => column.walletId),
      shown: plans
        .filter((plan) => (plan as { shown?: boolean }).shown ?? true)
        .map((plan) => plan.wallet),
    });

    // The Plan's own rule, so the two pages agree on a savings account's month.
    const savingsKinds = savings.accounts.map((account) => account.kind);
    const contributions = monthlyContributions({
      templates: recurringTemplates,
      wallets: {},
      templateWallets: {},
      savingsCategories: Object.fromEntries(
        savings.accounts.flatMap((account) =>
          account.categoryId ? [[account.categoryId, account.kind]] : [],
        ),
      ),
      defaultSavings: defaultSavingsKind(savingsKinds) ?? "savings",
      year: current.year,
      month: current.month,
      today,
    });
    const savingsMonthly: Partial<Record<SavingsAccountKind, number>> =
      Object.fromEntries(
        savingsKinds.map((kind) => [kind, contributions[kind] ?? 0]),
      );

    const investmentTemplates = recurringTemplates.filter(
      (template) => template.categories.type === "investment",
    );

    const planByWallet = new Map(plans.map((plan) => [plan.wallet, plan]));
    const targets: AccountTarget[] = [
      ...savings.accounts.map((account) => ({
        accountId: account.kind,
        targetWeight: account.targetWeight,
      })),
      ...kept.map((wallet) => {
        const weight = planByWallet.get(wallet)?.target_weight;
        return {
          accountId: wallet,
          targetWeight:
            weight === null || weight === undefined ? null : Number(weight),
        };
      }),
    ];

    return {
      today,
      portfolio,
      investmentTemplates,
      plans,
      investmentTransactions,
      savings,
      keptWallets: kept,
      accounts: [...savingsKinds, ...kept],
      fundingNeeds: buildWalletFundingNeeds(
        investmentTemplates,
        current.year,
        current.month,
      ),
      savingsMonthly,
      targets,
    };
  },
);
