/**
 * The Plan page's arithmetic: where the savings and investments are heading,
 * the milestones on the way, the cushion they make, and what an extra euro a
 * month changes.
 *
 * Pure and shared, so the web and the phone show the same future from the
 * same figures. Everything here is an estimate and is labelled as one on
 * screen: returns are the user's assumption, taxes are the 2026 French rules
 * simplified to one rate per account, and nothing here is advice.
 */

import type { Key } from "./i18n/t";
import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_NAME_KEYS,
  matchWalletId,
  type InvestmentWalletId,
} from "./investments";
import type { ProjectionPoint } from "./projection";
import { estimateMonthlyAmount } from "./recurrence";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KINDS,
  SAVINGS_KIND_NAME_KEYS,
  SAVINGS_KIND_SHORT_KEYS,
  SAVINGS_KIND_TAX_KEYS,
} from "./savings-accounts";
import type {
  RecurringTemplateWithCategory,
  SavingsAccountKind,
} from "./types/database";

/* ------------------------------------------------------------ taxes, 2026 */

/**
 * French taxes on investment gains, as they stand in 2026.
 *
 * The social contributions rose from 17.2% to 18.6% on 1 January 2026 (LFSS
 * 2026) on most capital income, PEA and crypto included, which took the flat
 * tax (PFU) to 31.4%. Life insurance was left out of the rise: 17.2%, flat
 * tax 30%, and after eight years 7.5% + 17.2% = 24.7% on gains above a yearly
 * allowance of €4,600 (€9,200 for a couple). Livret A, LDDS and LEP pay no
 * tax at all; the Livret A pays 1.7% since 1 August 2026 and the LEP 2.5%.
 *
 * Checked October 2026 against impots.gouv.fr and the press on the LFSS
 * (Meilleurtaux, Ramify, Nalo, economie.gouv.fr). Revisit each January and
 * each August, when the regulated rates move.
 */
export const FRENCH_TAX_2026 = {
  socialContributions: 0.186,
  socialContributionsLifeInsurance: 0.172,
  flatTax: 0.314,
  lifeInsuranceAfterEightYears: 0.247,
  lifeInsuranceAllowance: { single: 4600, couple: 9200 },
  cryptoYearlyExemption: 305,
  peaContributionCeiling: 150_000,
  livretARate: 0.017,
  lepRate: 0.025,
} as const;

/**
 * One account in the long view: a wallet, a savings account the user has
 * declared, or — when they have declared none — `savings`, everything logged
 * as savings in one.
 */
export type EnvelopeId = "savings" | SavingsAccountKind | InvestmentWalletId;

export interface EnvelopePreset {
  /** A sensible yearly return to start from; the user changes it. */
  annualReturn: number;
  /**
   * The tax on gains, as one rate — the long-held case: a PEA past five
   * years, life insurance past eight. The note under it says what it
   * assumes.
   */
  taxOnGains: number;
  /**
   * The most that can be paid in, after which the monthly payment stops — a
   * Livret A's 22,950 €. Read against what the account holds, which for a
   * livret is its deposits and their interest. Null for the PEA too: its
   * ceiling is on what was paid in, which its market value does not tell.
   */
  ceiling: number | null;
}

function savingsPreset(kind: SavingsAccountKind): EnvelopePreset {
  const preset = FRENCH_SAVINGS_2026[kind];
  return {
    annualReturn: preset.rate,
    taxOnGains: preset.taxOnInterest,
    ceiling: preset.ceiling,
  };
}

/**
 * Where each account starts. Equities at 7% a year is the long-run figure a
 * diversified world fund has returned; life insurance at 4% is a mix of a
 * euro fund and units; crypto at 5% is deliberately cautious, because there
 * is no long run to speak of.
 */
export const ENVELOPE_PRESETS: Record<EnvelopeId, EnvelopePreset> = {
  savings: {
    annualReturn: FRENCH_TAX_2026.livretARate,
    taxOnGains: 0,
    ceiling: null,
  },
  livret_a: savingsPreset("livret_a"),
  ldds: savingsPreset("ldds"),
  lep: savingsPreset("lep"),
  cel: savingsPreset("cel"),
  pel: savingsPreset("pel"),
  livret: savingsPreset("livret"),
  pea: {
    annualReturn: 0.07,
    taxOnGains: FRENCH_TAX_2026.socialContributions,
    ceiling: null,
  },
  cto: {
    annualReturn: 0.07,
    taxOnGains: FRENCH_TAX_2026.flatTax,
    ceiling: null,
  },
  av: {
    annualReturn: 0.04,
    taxOnGains: FRENCH_TAX_2026.lifeInsuranceAfterEightYears,
    ceiling: null,
  },
  per: {
    annualReturn: 0.07,
    taxOnGains: FRENCH_TAX_2026.flatTax,
    ceiling: null,
  },
  crypto: {
    annualReturn: 0.05,
    taxOnGains: FRENCH_TAX_2026.flatTax,
    ceiling: null,
  },
};

/** The order accounts are listed in: savings, then the common wallets. */
export const ENVELOPE_ORDER: readonly EnvelopeId[] = [
  "savings",
  ...SAVINGS_KINDS,
  "pea",
  "av",
  "cto",
  "per",
  "crypto",
];

/** "Livret A", "PEA", "Assurance vie": the account in a short list. */
export const ENVELOPE_SHORT_KEYS: Record<EnvelopeId, Key> = {
  savings: "accounts.shortSavings",
  ...SAVINGS_KIND_SHORT_KEYS,
  pea: "accounts.shortPea",
  cto: "accounts.shortCto",
  av: "accounts.shortAv",
  per: "accounts.shortPer",
  crypto: "accounts.shortCrypto",
};

/** The account's full name. */
export const ENVELOPE_NAME_KEYS: Record<EnvelopeId, Key> = {
  savings: "futurePlan.envelopeLivret",
  ...SAVINGS_KIND_NAME_KEYS,
  ...INVESTMENT_WALLET_NAME_KEYS,
};

/** How the account's gains are taxed, in a sentence. */
export const ENVELOPE_TAX_KEYS: Record<EnvelopeId, Key> = {
  savings: "futurePlan.taxLivret",
  ...SAVINGS_KIND_TAX_KEYS,
  pea: "futurePlan.taxPea",
  cto: "futurePlan.taxCto",
  av: "futurePlan.taxAv",
  per: "futurePlan.taxPer",
  crypto: "futurePlan.taxCrypto",
};

/* -------------------------------------------------------------- the engine */

export interface Envelope {
  id: EnvelopeId;
  /** What it holds today. */
  initial: number;
  /** What goes into it each month. */
  monthly: number;
  /** Yearly, as a fraction: 0.07 for 7%. */
  annualReturn: number;
  /** On gains, as a fraction. */
  taxOnGains: number;
}

export interface EnvelopeProjectionInput {
  envelopes: readonly Envelope[];
  years: number;
  /** Yearly, as a fraction. */
  inflation: number;
  /** The share of the net value one could take out each year, as a fraction. */
  withdrawalRate: number;
}

export interface EnvelopeShare {
  id: EnvelopeId;
  /** What the account would be worth that year, after the tax on its gains. */
  netValue: number;
}

export interface EnvelopeYear {
  /** Years from now: 0 is today. */
  year: number;
  /** What was already there, carried untouched. */
  initial: number;
  /** Everything paid in since today. */
  contributions: number;
  /** Gains after the tax on them, as if everything were sold that year. */
  netGains: number;
  /** All three. */
  netValue: number;
  /** The same net value, account by account, in the envelopes' order. */
  accounts: EnvelopeShare[];
}

export interface EnvelopeProjection {
  /** One per year, from today to the horizon. */
  years: EnvelopeYear[];
  /** The gross value at the end of each month, for milestones. */
  monthly: number[];
  futureValue: number;
  gains: number;
  taxes: number;
  netValue: number;
  /** The net value in today's euros. */
  realNetValue: number;
  /** A month's income at the withdrawal rate, in today's euros. */
  monthlyIncome: number;
  /** The net value at the horizon, account by account. */
  accounts: EnvelopeShare[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Where the accounts are heading, month by month.
 *
 * A yearly return is applied as its equivalent monthly rate, and each month's
 * payment goes in at the end of the month — the convention compound-interest
 * calculators use, so a reader comparing figures finds the same ones. Tax is
 * taken on each account's gains as if everything were sold at the horizon,
 * which is the figure a person planning to live off it needs.
 */
export function projectEnvelopes(
  input: EnvelopeProjectionInput,
): EnvelopeProjection {
  const months = Math.max(0, Math.round(input.years * 12));
  const accounts = input.envelopes.map((envelope) => ({
    ...envelope,
    rate: Math.pow(1 + envelope.annualReturn, 1 / 12) - 1,
    ceiling: ENVELOPE_PRESETS[envelope.id]?.ceiling ?? null,
    value: envelope.initial,
    paidIn: 0,
  }));

  const netOf = (account: (typeof accounts)[number]) => {
    const gains = account.value - account.initial - account.paidIn;
    return gains > 0 ? gains * (1 - account.taxOnGains) : gains;
  };

  const snapshot = (year: number): EnvelopeYear => {
    let initial = 0;
    let contributions = 0;
    let netGains = 0;
    for (const account of accounts) {
      initial += account.initial;
      contributions += account.paidIn;
      netGains += netOf(account);
    }
    return {
      year,
      initial: roundMoney(initial),
      contributions: roundMoney(contributions),
      netGains: roundMoney(netGains),
      netValue: roundMoney(initial + contributions + netGains),
      accounts: accounts.map((account) => ({
        id: account.id,
        netValue: roundMoney(account.initial + account.paidIn + netOf(account)),
      })),
    };
  };

  const years: EnvelopeYear[] = [snapshot(0)];
  const monthly: number[] = [];

  for (let month = 1; month <= months; month += 1) {
    let total = 0;
    for (const account of accounts) {
      // A full account takes no more: the payment stops at its ceiling.
      const room =
        account.ceiling === null
          ? account.monthly
          : Math.max(
              0,
              Math.min(account.monthly, account.ceiling - account.value),
            );
      account.value = account.value * (1 + account.rate) + room;
      account.paidIn += room;
      total += account.value;
    }
    monthly.push(roundMoney(total));
    if (month % 12 === 0) {
      years.push(snapshot(month / 12));
    }
  }

  let futureValue = 0;
  let gains = 0;
  let taxes = 0;
  for (const account of accounts) {
    const gain = account.value - account.initial - account.paidIn;
    futureValue += account.value;
    gains += gain;
    taxes += gain > 0 ? gain * account.taxOnGains : 0;
  }
  const netValue = futureValue - taxes;
  const realNetValue = netValue / Math.pow(1 + input.inflation, input.years);

  return {
    years,
    monthly,
    futureValue: roundMoney(futureValue),
    gains: roundMoney(gains),
    taxes: roundMoney(taxes),
    netValue: roundMoney(netValue),
    realNetValue: roundMoney(realNetValue),
    monthlyIncome: roundMoney((realNetValue * input.withdrawalRate) / 12),
    accounts: accounts.map((account) => ({
      id: account.id,
      netValue: roundMoney(account.initial + account.paidIn + netOf(account)),
    })),
  };
}

/* ----------------------------------------------------- filled from the data */

export interface ContributionSource {
  templates: readonly RecurringTemplateWithCategory[];
  /** What each investment account holds today, by wallet. */
  wallets: Partial<Record<InvestmentWalletId, number>>;
  /** The account each position-linked recurring purchase goes into. */
  templateWallets: Readonly<Record<string, InvestmentWalletId>>;
  /** The savings account each savings category feeds, by category id. */
  savingsCategories?: Readonly<Record<string, SavingsAccountKind>>;
  /**
   * Where savings logged in no account's own category go: the account
   * `defaultSavingsKind` picks, or `savings` when none is declared.
   */
  defaultSavings?: EnvelopeId;
  year: number;
  month: number;
  today: string;
}

/**
 * What the recurring templates put into each account in a month.
 *
 * Savings go to the account whose category they are logged in, else to the
 * default one (the Livret A, or everything saved in one when no account is
 * declared), withdrawals excepted. Investments go
 * to the account their position names, or the one their category's name
 * does ("Virement PEA"). Two kinds of investment template can describe the
 * same euros — the transfer to the broker and the purchase made with it
 * inside the account — so an account with purchases counts those alone, and
 * a transfer that names no account is only used when nothing else says
 * where the money goes: it is put on the largest account, or a CTO.
 */
export function monthlyContributions(
  source: ContributionSource,
): Partial<Record<EnvelopeId, number>> {
  const live = source.templates.filter(
    (template) =>
      template.active &&
      (!template.ends_on || template.ends_on >= source.today),
  );
  const monthly: Partial<Record<EnvelopeId, number>> = {};
  const add = (id: EnvelopeId, amount: number) => {
    monthly[id] = (monthly[id] ?? 0) + amount;
  };

  const purchases: Partial<Record<InvestmentWalletId, number>> = {};
  const transfers: Partial<Record<InvestmentWalletId, number>> = {};
  let unplaced = 0;

  for (const template of live) {
    const amount = estimateMonthlyAmount(template, source.year, source.month);
    const counts = template.categories.counts_toward_summary !== false;

    if (template.categories.type === "savings") {
      if (counts) {
        add(
          source.savingsCategories?.[template.category_id] ??
            source.defaultSavings ??
            "savings",
          amount,
        );
      }
      continue;
    }
    if (template.categories.type !== "investment") {
      continue;
    }

    const wallet =
      source.templateWallets[template.id] ??
      matchWalletId(template.categories.name);
    if (!counts) {
      if (wallet) {
        purchases[wallet] = (purchases[wallet] ?? 0) + amount;
      }
      continue;
    }
    if (wallet) {
      transfers[wallet] = (transfers[wallet] ?? 0) + amount;
    } else {
      unplaced += amount;
    }
  }

  let placed = 0;
  for (const wallet of INVESTMENT_WALLET_IDS) {
    const amount = purchases[wallet] ?? transfers[wallet] ?? 0;
    if (amount > 0) {
      add(wallet, amount);
      placed += amount;
    }
  }

  if (unplaced > 0 && placed === 0) {
    const largest = INVESTMENT_WALLET_IDS.reduce<InvestmentWalletId>(
      (best, wallet) =>
        (source.wallets[wallet] ?? 0) > (source.wallets[best] ?? 0)
          ? wallet
          : best,
      "cto",
    );
    add(largest, unplaced);
  }

  return monthly;
}

export interface DeclaredSavings {
  kind: SavingsAccountKind;
  /** What it holds today (`savingsBalance`). */
  balance: number;
  /** Its yearly rate (`savingsRate`). */
  rate: number;
}

export interface EnvelopeSource {
  /** What each investment account holds today, by wallet. */
  wallets: Partial<Record<InvestmentWalletId, number>>;
  /**
   * The savings accounts the user has declared. Each is an account of its
   * own, empty or not, since the user added it; with none, everything logged
   * as savings stands in as one account.
   */
  savingsAccounts?: readonly DeclaredSavings[];
  /** What the user has put into savings, net of withdrawals. */
  savingsReserve: number;
  /** What the recurring templates put in each month, by account. */
  monthly: Partial<Record<EnvelopeId, number>>;
}

/**
 * The accounts as the user's own figures describe them, with the presets for
 * return and tax. A wallet with nothing in it and nothing going in is left
 * out — the form has a way to add one. Savings always start the list.
 */
export function envelopesFromData(source: EnvelopeSource): Envelope[] {
  const declared = source.savingsAccounts ?? [];
  const savings: Envelope[] =
    declared.length > 0
      ? SAVINGS_KINDS.flatMap((kind) => {
          const account = declared.find((row) => row.kind === kind);
          return account
            ? [
                {
                  id: kind,
                  initial: roundMoney(Math.max(0, account.balance)),
                  monthly: roundMoney(Math.max(0, source.monthly[kind] ?? 0)),
                  annualReturn: account.rate,
                  taxOnGains: ENVELOPE_PRESETS[kind].taxOnGains,
                },
              ]
            : [];
        })
      : [
          {
            id: "savings",
            initial: roundMoney(Math.max(0, source.savingsReserve)),
            monthly: roundMoney(Math.max(0, source.monthly.savings ?? 0)),
            annualReturn: ENVELOPE_PRESETS.savings.annualReturn,
            taxOnGains: ENVELOPE_PRESETS.savings.taxOnGains,
          },
        ];

  const wallets = ENVELOPE_ORDER.flatMap((id): Envelope[] => {
    if (!INVESTMENT_WALLET_IDS.includes(id as InvestmentWalletId)) {
      return [];
    }
    const wallet = id as InvestmentWalletId;
    const initial = Math.max(0, source.wallets[wallet] ?? 0);
    const monthly = Math.max(0, source.monthly[wallet] ?? 0);
    if (initial === 0 && monthly === 0) {
      return [];
    }
    return [
      {
        id: wallet,
        initial: roundMoney(initial),
        monthly: roundMoney(monthly),
        annualReturn: ENVELOPE_PRESETS[wallet].annualReturn,
        taxOnGains: ENVELOPE_PRESETS[wallet].taxOnGains,
      },
    ];
  });

  return [...savings, ...wallets];
}

/* ---------------------------------------------- which account, discreetly */

/**
 * The accounts the breakdown names, in the long view's order: the largest at
 * the horizon, up to `max`; the rest are one "Others". Decided once from the
 * horizon and then held while the chart is read year by year, so an
 * account's colour — its place in this list — follows the account and never
 * its rank in whichever year is under the pointer.
 */
export function breakdownAccounts(
  horizon: readonly EnvelopeShare[],
  max = 4,
): EnvelopeId[] {
  const largest = new Set(
    horizon
      .filter((share) => share.netValue > 0)
      .sort((left, right) => right.netValue - left.netValue)
      .slice(0, max)
      .map((share) => share.id),
  );
  return ENVELOPE_ORDER.filter((id) => largest.has(id));
}

export interface BreakdownPart {
  id: EnvelopeId | "others";
  netValue: number;
  /** The account's place in `breakdownAccounts`, which picks its colour; null for "Others". */
  slot: number | null;
}

/** One year's shares, as the named accounts and one "Others". */
export function breakdownParts(
  shares: readonly EnvelopeShare[],
  named: readonly EnvelopeId[],
): BreakdownPart[] {
  const parts: BreakdownPart[] = named.flatMap((id, slot) => {
    const netValue = shares.find((share) => share.id === id)?.netValue ?? 0;
    return netValue > 0 ? [{ id, netValue, slot }] : [];
  });
  const others = shares
    .filter((share) => !named.includes(share.id) && share.netValue > 0)
    .reduce((sum, share) => sum + share.netValue, 0);
  return others > 0
    ? [...parts, { id: "others", netValue: roundMoney(others), slot: null }]
    : parts;
}

/**
 * What the cushion is made of: the savings envelopes whose money is at hand —
 * everything saved in one, or each declared account but a PEL, which a
 * withdrawal closes. Read from the envelopes, so a balance the reader
 * corrected in the long view is the one the cushion counts.
 */
export function cushionSavings(envelopes: readonly Envelope[]): number {
  return roundMoney(
    envelopes
      .filter(
        (envelope) =>
          envelope.id === "savings" ||
          (SAVINGS_KINDS.includes(envelope.id as SavingsAccountKind) &&
            FRENCH_SAVINGS_2026[envelope.id as SavingsAccountKind].liquid),
      )
      .reduce((sum, envelope) => sum + envelope.initial, 0),
  );
}

/* ------------------------------------------------------------- milestones */

/** The round amounts worth celebrating, smallest first. */
export const MILESTONE_TIERS: readonly number[] = [
  1_000, 2_500, 5_000, 10_000, 15_000, 20_000, 25_000, 50_000, 75_000, 100_000,
  150_000, 200_000, 250_000, 500_000, 750_000, 1_000_000,
];

export interface Milestone {
  amount: number;
  /** Already there today. */
  reached: boolean;
  /** Months from now until the projection crosses it, or null if it never does inside the horizon. */
  monthsAway: number | null;
}

/**
 * The last two milestones already passed and the next three ahead, with
 * when the projection crosses each — so there is always something just done
 * and something close enough to want.
 */
export function buildMilestones(
  current: number,
  monthlyValues: readonly number[],
  tiers: readonly number[] = MILESTONE_TIERS,
): Milestone[] {
  const reached = tiers.filter((amount) => amount <= current).slice(-2);
  const ahead = tiers
    .filter((amount) => amount > current)
    .slice(0, 3)
    .map((amount) => {
      const index = monthlyValues.findIndex((value) => value >= amount);
      return {
        amount,
        reached: false,
        monthsAway: index === -1 ? null : index + 1,
      };
    });
  return [
    ...reached.map((amount) => ({ amount, reached: true, monthsAway: 0 })),
    ...ahead,
  ];
}

/* ---------------------------------------------------------------- cushion */

/** One, three and six months of fixed costs: the usual rungs. */
export const CUSHION_TARGETS: readonly number[] = [1, 3, 6];

export interface Cushion {
  /** Months of fixed costs the savings cover, or null when nothing is fixed. */
  months: number | null;
  /** How many rungs are done: 0 to 3. */
  level: number;
  /** The next rung, or null once the last is reached. */
  nextTarget: number | null;
  /** Progress towards the last rung, 0 to 1, for the gauge. */
  ratio: number;
}

export function buildCushion(runwayMonths: number | null): Cushion {
  if (runwayMonths === null) {
    return {
      months: null,
      level: 0,
      nextTarget: CUSHION_TARGETS[0]!,
      ratio: 0,
    };
  }
  const level = CUSHION_TARGETS.filter(
    (target) => runwayMonths >= target,
  ).length;
  const last = CUSHION_TARGETS[CUSHION_TARGETS.length - 1]!;
  return {
    months: runwayMonths,
    level,
    nextTarget: CUSHION_TARGETS[level] ?? null,
    ratio:
      Math.round(Math.min(1, Math.max(0, runwayMonths / last)) * 100) / 100,
  };
}

/* ---------------------------------------------------------------- what if */

export interface WhatIfPoint {
  monthKey: string;
  label: string;
  /** The projection as it stands. */
  value: number;
  /** With the extra put aside every month from this one. */
  withExtra: number;
}

/**
 * The year ahead with an extra amount put aside each month.
 *
 * Money kept rather than spent, so it adds to what is kept month after month:
 * the first month gains one extra, the twelfth twelve. `value` is the
 * projection's kept track — what is on the accounts and set aside when there
 * is a balance to start from, what the months add when there is not.
 */
export function withExtraSaving(
  points: readonly ProjectionPoint[],
  extraMonthly: number,
): WhatIfPoint[] {
  return points.map((point, index) => ({
    monthKey: point.monthKey,
    label: point.label,
    value: roundMoney(point.kept),
    withExtra: roundMoney(point.kept + extraMonthly * (index + 1)),
  }));
}

/**
 * In how many months a series first reaches an amount, with `extraMonthly`
 * more each month; null when it does not inside the series. Two calls — with
 * and without the extra — say how much sooner a milestone comes.
 */
export function monthsUntil(
  amount: number,
  monthlyValues: readonly number[],
  extraMonthly = 0,
): number | null {
  const index = monthlyValues.findIndex(
    (value, i) => value + extraMonthly * (i + 1) >= amount,
  );
  return index === -1 ? null : index + 1;
}

/** What the Plan stands on today: every account's opening amount, added up. */
export function wealthToday(envelopes: readonly Envelope[]): number {
  return envelopes.reduce((sum, envelope) => sum + envelope.initial, 0);
}

/**
 * The milestone worth announcing, if one is: the highest tier now passed,
 * when it is above the one already celebrated. Nothing before the first
 * celebration — a first visit records where things stand rather than
 * announcing everything already behind the user, as the Plan itself does.
 */
export function milestoneToAnnounce(
  current: number,
  seen: number | null,
  tiers: readonly number[] = MILESTONE_TIERS,
): number | null {
  if (seen === null) {
    return null;
  }
  const reached = tiers.filter((tier) => tier <= current).at(-1);
  return reached !== undefined && reached > seen ? reached : null;
}
