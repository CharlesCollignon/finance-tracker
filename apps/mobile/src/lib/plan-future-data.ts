import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import {
  envelopesFromData,
  monthlyContributions,
  type Envelope,
} from "@finance/core/future-plan";
import type { PositionForMix } from "@finance/core/history/mix";
import {
  parseHypothesesEdits,
  parseTrajectorySettings,
  TRAJECTORY_DEFAULT_SETTINGS,
  type HypothesesEdits,
  type TrajectorySettings,
} from "@finance/core/history/plan-settings";
import type { Locale } from "@finance/core/i18n/locale";
import type { InvestmentWalletId } from "@finance/core/investments";
import { planWealthFromPortfolio } from "@finance/core/investment-positions";
import { walletFeeRates, wrapperFeesFromPlans } from "@finance/core/fund-costs";
import { defaultSavingsKind } from "@finance/core/savings-accounts";
import {
  buildForwardProjection,
  type ForwardProjection,
} from "@finance/core/projection";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { YEAR_AHEAD_MAX_MONTHS } from "@finance/core/year-ahead";
import * as preferences from "@finance/data/preferences";

import {
  getMonthCloseOverview,
  getRecurringTemplates,
  getSavingsReserve,
  getWalletPlans,
  getWalletPortfolio,
  readCashBalance,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import {
  getSavingsState,
  savingsCategoryKinds,
  type SavingsAccountView,
} from "@/lib/savings-accounts";

/**
 * What the Plan screen reads, in two loads, as the web's page does
 * (`apps/web/lib/queries/plan.ts`).
 *
 * The ledger's part — the recurring entries, the savings, the run — comes
 * from a few indexed reads. What each investment account is worth asks the
 * market for prices, so it arrives on its own; the screen waits for both,
 * because every card counts the investments.
 */

export interface PlanBase {
  today: string;
  year: number;
  month: number;
  templates: RecurringTemplateWithCategory[];
  /** Whether any recurring entry is running: without one there is no year ahead to draw. */
  hasTemplates: boolean;
  /** Everything logged as savings, net of withdrawals. */
  savingsReserve: number;
  /** The savings accounts the user declared, with today's balances. */
  savings: SavingsAccountView[];
  /**
   * The run of months closed inside the allowance, for « Progression »;
   * null before a month has been measured. The close itself is on Le point.
   */
  run: { streak: number; best: number } | null;
  /**
   * The months ahead from the recurring templates, as far as the year
   * ahead's longest window: the card draws as many as the reader asks.
   */
  projection: ForwardProjection;
}

export async function gatherPlanBase(
  userId: string,
  locale: Locale,
): Promise<PlanBase> {
  const { year, month } = getCurrentMonth();
  const today = todayIsoLocal();

  const [templates, savingsReserve, closes, cash, savings] = await Promise.all([
    getRecurringTemplates(userId),
    getSavingsReserve(userId),
    getMonthCloseOverview(userId, today, locale),
    // What the year starts from: the stored statement, no network. Null when
    // no account is ticked as spending money, which is ordinary.
    readCashBalance(userId, today),
    getSavingsState(userId),
  ]);

  return {
    today,
    year,
    month,
    templates,
    hasTemplates: templates.some(
      (template) =>
        template.active && (!template.ends_on || template.ends_on >= today),
    ),
    savingsReserve,
    savings: savings.accounts,
    run:
      closes.summary.sample > 0
        ? { streak: closes.summary.streak, best: closes.summary.bestStreak }
        : null,
    projection: buildForwardProjection({
      templates,
      year,
      month,
      today,
      months: YEAR_AHEAD_MAX_MONTHS,
      // Never a partial sum: a reading missing an account is short by what
      // that account holds, so it is not a balance.
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
  /**
   * Every position, with what it is worth and what it is: the history each
   * wallet follows is read from its funds (`walletMixes`).
   */
  positions: PositionForMix[];
  /**
   * What each account costs a year, funds and envelope together, as a
   * fraction — taken off its return in the year ahead. The web reads the
   * same.
   */
  fees: Partial<Record<InvestmentWalletId, number>>;
}

export async function gatherPlanWealth(
  userId: string,
  locale: Locale,
): Promise<PlanWealth> {
  const [portfolio, plans] = await Promise.all([
    getWalletPortfolio(userId, locale),
    // Fees left unknown are better than a Plan without its long view.
    getWalletPlans(userId).catch(() => []),
  ]);
  return {
    ...planWealthFromPortfolio(portfolio),
    fees: walletFeeRates(
      portfolio.columns.flatMap((column) => column.items),
      wrapperFeesFromPlans(plans),
    ),
  };
}

/** The accounts as the user's own figures describe them. */
export function planEnvelopes(
  base: PlanBase,
  wealth: PlanWealth | null,
): Envelope[] {
  return envelopesFromData({
    wallets: wealth?.wallets ?? {},
    savingsAccounts: base.savings.map((view) => ({
      kind: view.account.kind,
      balance: view.balance.balance,
      rate: view.rate,
    })),
    savingsReserve: base.savingsReserve,
    fees: wealth?.fees,
    monthly: monthlyContributions({
      templates: base.templates,
      wallets: wealth?.wallets ?? {},
      templateWallets: wealth?.templateWallets ?? {},
      savingsCategories: savingsCategoryKinds(base.savings),
      defaultSavings:
        defaultSavingsKind(base.savings.map((view) => view.account.kind)) ??
        "savings",
      year: base.year,
      month: base.month,
      today: base.today,
    }),
  });
}

/* ------------------------------------------------------- what is remembered */

/**
 * How the reader left the trajectory, and what they changed in
 * « Hypothèses », kept on the phone and read with the web's rule
 * (`@finance/core/history/plan-settings`). The keys before October 2026 —
 * the long view's and the year ahead's — are no longer read: their returns
 * were presets, not history.
 */
const TRAJECTORY_KEY = "plan-trajectory:v1:";
const HYPOTHESES_KEY = "plan-hypotheses:v1:";

async function readStored(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export async function loadTrajectorySettings(
  userId: string,
): Promise<TrajectorySettings> {
  const stored = await readStored(TRAJECTORY_KEY + userId);
  return stored === null
    ? TRAJECTORY_DEFAULT_SETTINGS
    : parseTrajectorySettings(stored);
}

export async function saveTrajectorySettings(
  userId: string,
  settings: TrajectorySettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TRAJECTORY_KEY + userId,
      JSON.stringify(settings),
    );
  } catch {
    // Settings that are not remembered still drew the card.
  }
}

export async function loadHypothesesEdits(
  userId: string,
): Promise<HypothesesEdits> {
  return parseHypothesesEdits(await readStored(HYPOTHESES_KEY + userId));
}

export async function saveHypothesesEdits(
  userId: string,
  edits: HypothesesEdits,
): Promise<void> {
  try {
    if (Object.keys(edits).length === 0) {
      await AsyncStorage.removeItem(HYPOTHESES_KEY + userId);
    } else {
      await AsyncStorage.setItem(HYPOTHESES_KEY + userId, JSON.stringify(edits));
    }
  } catch {
    // A plan that is not remembered is still a plan.
  }
}

/**
 * The highest milestone already celebrated, on any device, or null on a
 * first visit. The account's rather than the phone's
 * (`user_preferences.milestone_seen`), so the laptop and the phone do not
 * each celebrate the same one.
 */
export async function loadSeenMilestone(
  userId: string,
): Promise<number | null> {
  try {
    return (await preferences.getNotificationSettings(supabase, userId))
      .milestoneSeen;
  } catch {
    return null;
  }
}

export async function saveSeenMilestone(
  userId: string,
  amount: number,
  locale: Locale,
): Promise<void> {
  try {
    await preferences.markMilestoneSeen(supabase, userId, amount, locale);
  } catch {
    // Celebrated twice is the worst that can happen.
  }
}
