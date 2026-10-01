import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import type { InvestmentWalletId } from "@finance/core/investments";
import {
  buildForwardProjection,
  type ForwardProjection,
} from "@finance/core/projection";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { getLocale } from "@/lib/locale";
import { readCashBalance } from "@/lib/queries/bank-balance";
import {
  getRecurringTemplates,
  getSavingsReserve,
} from "@/lib/queries/finance";
import {
  getMonthCloseOverview,
  type MonthCloseOverview,
} from "@/lib/queries/month-close";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getSavingsAccounts } from "@/lib/queries/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";

/**
 * What the Plan page reads, in two loads — the phone's split
 * (`apps/mobile/src/lib/plan-future-data.ts`), so both draw the same page
 * from the same reads.
 *
 * The year ahead, the cushion and the run come from the ledger alone — a few
 * indexed reads — and are on screen at once. The milestones and the long view
 * also need what each investment account is worth today, which asks the
 * market for prices, so they stream in after and never hold the rest back.
 */

export interface PlanBase {
  /** Scopes what this browser remembers to the account it remembers it for. */
  userId: string;
  today: string;
  /** The month in progress, where the year ahead starts. */
  year: number;
  month: number;
  templates: RecurringTemplateWithCategory[];
  /** Whether any recurring entry is running: without one there is no year ahead to draw. */
  hasTemplates: boolean;
  /** Everything logged as savings, net of withdrawals. */
  savingsReserve: number;
  /**
   * The savings accounts the user has declared, with what each holds today.
   * Empty for someone who has declared none, whose savings then stand in as
   * one account built from the reserve.
   */
  savingsAccounts: PlanSavingsAccount[];
  closes: MonthCloseOverview;
  /** The next twelve months, from the recurring templates. */
  projection: ForwardProjection;
}

export interface PlanSavingsAccount {
  kind: SavingsAccountKind;
  balance: number;
  rate: number;
  /** The savings category that feeds it. */
  categoryId: string | null;
}

export async function gatherPlanBase(userId: string): Promise<PlanBase> {
  const { year, month } = getCurrentMonth();
  const today = todayIsoLocal();
  const locale = await getLocale();

  const [templates, savingsReserve, closes, cash, savings] = await Promise.all([
    getRecurringTemplates(userId),
    getSavingsReserve(userId),
    getMonthCloseOverview(userId, today),
    // Null for anyone with no spending accounts picked, which is everyone
    // who has not connected a bank.
    readCashBalance(userId, today),
    getSavingsAccounts(userId),
  ]);

  return {
    userId,
    today,
    year,
    month,
    templates,
    hasTemplates: templates.some(
      (template) =>
        template.active && (!template.ends_on || template.ends_on >= today),
    ),
    savingsReserve,
    savingsAccounts: savings.accounts.map((account) => ({
      kind: account.kind,
      balance: account.balance.balance,
      rate: account.rate,
      categoryId: account.categoryId,
    })),
    closes,
    projection: buildForwardProjection({
      templates,
      year,
      month,
      today,
      months: 12,
      // Never a partial sum: a reading missing an account is short by
      // whatever that account holds, so it is not a balance and cannot open
      // one.
      onHand: cash?.ok ? cash.total : null,
      closes: closes.summary,
      locale,
    }),
  };
}

export interface PlanWealth {
  /** What each investment account is worth today. */
  wallets: Partial<Record<InvestmentWalletId, number>>;
  /** The account each position-linked recurring purchase goes into. */
  templateWallets: Record<string, InvestmentWalletId>;
}

/**
 * What the investment accounts hold, at market prices.
 *
 * Null when the portfolio cannot be read — a quote source down, a timeout —
 * rather than an error: the page then shows the long view from the savings
 * alone, which is less than it could say and still true, where a thrown
 * error would take the year ahead and the run down with it.
 */
export async function gatherPlanWealth(
  userId: string,
): Promise<PlanWealth | null> {
  try {
    const portfolio = await getWalletPortfolio(userId, {
      includeHistory: false,
    });
    const wallets: PlanWealth["wallets"] = {};
    const templateWallets: PlanWealth["templateWallets"] = {};

    for (const column of portfolio.columns) {
      wallets[column.walletId] =
        (wallets[column.walletId] ?? 0) + column.totalMarketValue;
      for (const item of column.items) {
        if (item.recurringTemplateId) {
          templateWallets[item.recurringTemplateId] = column.walletId;
        }
      }
    }

    return { wallets, templateWallets };
  } catch {
    return null;
  }
}
