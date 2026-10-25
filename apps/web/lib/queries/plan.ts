import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import type { PositionForMix } from "@finance/core/history/mix";
import type { InvestmentWalletId } from "@finance/core/investments";
import { planWealthFromPortfolio } from "@finance/core/investment-positions";
import {
  buildForwardProjection,
  type ForwardProjection,
} from "@finance/core/projection";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { YEAR_AHEAD_MAX_MONTHS } from "@finance/core/year-ahead";
import { getLocale } from "@/lib/locale";
import { readCashBalance } from "@/lib/queries/bank-balance";
import {
  getRecurringTemplates,
  getSavingsReserve,
} from "@/lib/queries/finance";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getWalletPlans } from "@/lib/queries/investments";
import { walletFeeRates, wrapperFeesFromPlans } from "@finance/core/fund-costs";
import { getSavingsAccounts } from "@/lib/queries/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { getNotificationSettings } from "@finance/data/preferences";
import { createClient } from "@/lib/supabase/server";
import { isFlagOn } from "@finance/core/flags";
import {
  getJointPropertiesFor,
  getProperties,
  type PropertyRead,
} from "@finance/data/properties";
import { getFlags } from "@/lib/flags";

/**
 * What the Plan page reads, in two loads — the phone's split
 * (`apps/mobile/src/lib/plan-future-data.ts`), so both draw the same page
 * from the same reads.
 *
 * The ledger's part — the recurring entries, the savings, the run — comes
 * from a few indexed reads. What each investment account is worth asks the
 * market for prices, so it arrives on its own; the page waits for both,
 * because every card counts the investments.
 */

export interface PlanBase {
  /** Scopes what this browser remembers to the account it remembers it for. */
  userId: string;
  today: string;
  /** The month in progress, where the trajectory starts. */
  year: number;
  month: number;
  templates: RecurringTemplateWithCategory[];
  /**
   * The highest milestone already celebrated, on any device, or null before
   * the first. Read with the page and held by it: the page writes the new one
   * as soon as it has shown it.
   */
  milestoneSeen: number | null;
  /** Everything logged as savings, net of withdrawals. */
  savingsReserve: number;
  /**
   * The savings accounts the user has declared, with what each holds today.
   * Empty for someone who has declared none, whose savings then stand in as
   * one account built from the reserve.
   */
  savingsAccounts: PlanSavingsAccount[];
  /**
   * The run of months closed inside the allowance, for « Progression »;
   * null before a month has been measured. The close itself is on Le point.
   */
  run: { streak: number; best: number } | null;
  /**
   * The months ahead from the recurring templates, which walk the current
   * account forward in the trajectory.
   */
  projection: ForwardProjection;
  /**
   * The user's properties, for « Avec vos biens » — null for an
   * account without `property.track`, which sees neither.
   */
  properties: PropertyRead[] | null;
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

  const [templates, savingsReserve, closes, cash, savings, settings, flags] =
    await Promise.all([
      getRecurringTemplates(userId),
      getSavingsReserve(userId),
      getMonthCloseOverview(userId, today),
      // Null for anyone with no spending accounts picked, which is everyone
      // who has not connected a bank.
      readCashBalance(userId, today),
      getSavingsAccounts(userId),
      // A celebration missed is better than a Plan that fails to open.
      getNotificationSettings(await createClient(), userId).catch(() => null),
      getFlags(),
    ]);
  const properties = isFlagOn(flags, "property.track")
    ? await Promise.all([
        getProperties(await createClient(), userId),
        // The homes owned through the shared space, as this person's part
        // of each (6c).
        getJointPropertiesFor(await createClient(), userId).catch(() => []),
      ]).then(([own, joint]) => [...own.properties, ...joint])
    : null;

  return {
    userId,
    today,
    year,
    month,
    templates,
    milestoneSeen: settings?.milestoneSeen ?? null,
    run:
      closes.summary.sample > 0
        ? { streak: closes.summary.streak, best: closes.summary.bestStreak }
        : null,
    savingsReserve,
    savingsAccounts: savings.accounts.map((account) => ({
      kind: account.kind,
      balance: account.balance.balance,
      rate: account.rate,
      categoryId: account.categoryId,
    })),
    properties,
    projection: buildForwardProjection({
      templates,
      year,
      month,
      today,
      months: YEAR_AHEAD_MAX_MONTHS,
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
  /**
   * Every position, with what it is worth and what it is: the history each
   * wallet follows is read from its funds (`walletMixes`).
   */
  positions: PositionForMix[];
  /** The account each position-linked recurring purchase goes into. */
  templateWallets: Record<string, InvestmentWalletId>;
  /**
   * What each account costs a year, funds and envelope together, as a
   * fraction — taken off its return in the replay.
   */
  fees: Partial<Record<InvestmentWalletId, number>>;
}

/**
 * What the investment accounts hold, at market prices.
 *
 * Null when the portfolio cannot be read — a quote source down, a timeout —
 * rather than an error: the page then replays the savings alone, which is
 * less than it could say and still true, where a thrown error would take
 * the whole page down with it.
 */
export async function gatherPlanWealth(
  userId: string,
): Promise<PlanWealth | null> {
  try {
    const [portfolio, plans] = await Promise.all([
      getWalletPortfolio(userId, { includeHistory: false }),
      // Fees left unknown are better than a Plan without its investments.
      getWalletPlans(userId).catch(() => []),
    ]);
    return {
      ...planWealthFromPortfolio(portfolio),
      fees: walletFeeRates(
        portfolio.columns.flatMap((column) => column.items),
        wrapperFeesFromPlans(plans),
      ),
    };
  } catch {
    return null;
  }
}
