import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import {
  ENVELOPE_ORDER,
  envelopesFromData,
  monthlyContributions,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
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
import {
  parseYearAheadSettings,
  YEAR_AHEAD_DEFAULT_SETTINGS,
  YEAR_AHEAD_MAX_MONTHS,
  type YearAheadSettings,
} from "@finance/core/year-ahead";
import * as preferences from "@finance/data/preferences";

import {
  getMonthCloseOverview,
  getRecurringTemplates,
  getSavingsReserve,
  getWalletPlans,
  getWalletPortfolio,
  readCashBalance,
  readCloseWait,
  type MonthCloseOverview,
} from "@/lib/queries";
import type { CloseWaitAccount } from "@finance/data/bank-balance";
import { supabase } from "@/lib/supabase";
import {
  getSavingsState,
  savingsCategoryKinds,
  type SavingsAccountView,
} from "@/lib/savings-accounts";

/**
 * What the Plan screen reads, in two loads.
 *
 * The year ahead, the cushion and the run come from the ledger alone — a few
 * indexed reads — and are on screen at once. The long view also needs what
 * each investment account is worth today, which asks the market for prices,
 * so it arrives on its own and never holds the rest of the screen back.
 */

export interface PlanBase {
  year: number;
  month: number;
  templates: RecurringTemplateWithCategory[];
  /** Whether any recurring entry is running: without one there is no year ahead to draw. */
  hasTemplates: boolean;
  /** Everything logged as savings, net of withdrawals. */
  savingsReserve: number;
  /** The savings accounts the user declared, with today's balances. */
  savings: SavingsAccountView[];
  closes: MonthCloseOverview;
  /**
   * The accounts the month due waits on, when a bank should have closed it
   * and cannot read one of them. Empty otherwise.
   */
  closeWait: CloseWaitAccount[];
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
  const closeWait = await readCloseWait(userId, closes.next, today);

  return {
    year,
    month,
    templates,
    hasTemplates: templates.some(
      (template) =>
        template.active && (!template.ends_on || template.ends_on >= today),
    ),
    savingsReserve,
    savings: savings.accounts,
    closes,
    closeWait,
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
      today: todayIsoLocal(),
    }),
  });
}

/* ------------------------------------------------------- what is remembered */

/**
 * The long view's knobs, kept on the phone. `envelopes` is null until the
 * user changes one, so the accounts follow their figures until then and go
 * back to following them on "Back to my figures".
 */
export interface PlanSettings {
  envelopes: Envelope[] | null;
  years: number;
  inflation: number;
  withdrawalRate: number;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  envelopes: null,
  years: 20,
  inflation: 0.02,
  withdrawalRate: 0.04,
};

// v2: the accounts gained the savings kinds, and the all-savings account
// was renamed from "livret" (now "Autre livret") to "savings".
const SETTINGS_KEY = "plan-future:v2:";

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Anything stored by an older build, or by hand, is read defensively. */
function readEnvelopes(value: unknown): Envelope[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const envelopes = value.flatMap((entry): Envelope[] => {
    const id = (entry as { id?: unknown })?.id;
    if (!ENVELOPE_ORDER.includes(id as EnvelopeId)) {
      return [];
    }
    const row = entry as Record<string, unknown>;
    return [
      {
        id: id as EnvelopeId,
        initial: Math.max(0, finite(row.initial, 0)),
        monthly: Math.max(0, finite(row.monthly, 0)),
        annualReturn: finite(row.annualReturn, 0),
        taxOnGains: Math.min(1, Math.max(0, finite(row.taxOnGains, 0))),
        // Absent in settings saved before fees: the known ones fill it.
        ...(typeof row.fees === "number" && Number.isFinite(row.fees)
          ? { fees: Math.min(0.05, Math.max(0, row.fees)) }
          : {}),
      },
    ];
  });
  return envelopes;
}

export async function loadPlanSettings(userId: string): Promise<PlanSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY + userId);
    if (!raw) {
      return DEFAULT_PLAN_SETTINGS;
    }
    const stored = JSON.parse(raw) as Record<string, unknown>;
    return {
      envelopes: readEnvelopes(stored.envelopes),
      years: Math.min(
        40,
        Math.max(
          1,
          Math.round(finite(stored.years, DEFAULT_PLAN_SETTINGS.years)),
        ),
      ),
      inflation: finite(stored.inflation, DEFAULT_PLAN_SETTINGS.inflation),
      withdrawalRate: finite(
        stored.withdrawalRate,
        DEFAULT_PLAN_SETTINGS.withdrawalRate,
      ),
    };
  } catch {
    return DEFAULT_PLAN_SETTINGS;
  }
}

export async function savePlanSettings(
  userId: string,
  settings: PlanSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY + userId, JSON.stringify(settings));
  } catch {
    // A plan that is not remembered is still a plan.
  }
}

/**
 * How the reader last left the year ahead: its window, where « Et si… »
 * goes, the accounts taken out, the events added — read with the web's own
 * rule, so a setting means the same thing on both. The extra is not kept:
 * it is something to play with.
 */
const YEAR_AHEAD_KEY = "plan-year-ahead:v1:";

export async function loadYearAheadSettings(
  userId: string,
): Promise<YearAheadSettings> {
  try {
    const raw = await AsyncStorage.getItem(YEAR_AHEAD_KEY + userId);
    return raw
      ? parseYearAheadSettings(JSON.parse(raw))
      : YEAR_AHEAD_DEFAULT_SETTINGS;
  } catch {
    return YEAR_AHEAD_DEFAULT_SETTINGS;
  }
}

export async function saveYearAheadSettings(
  userId: string,
  settings: YearAheadSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      YEAR_AHEAD_KEY + userId,
      JSON.stringify(settings),
    );
  } catch {
    // Settings that are not remembered still drew the card.
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
