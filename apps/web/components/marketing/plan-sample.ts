import { formatMonthLabel } from "@finance/core/constants";
import {
  buildCushion,
  type Cushion,
  type Envelope,
  type Milestone,
} from "@finance/core/future-plan";
import {
  cashFromYearAhead,
  monthlyFromCurrent,
  planAccounts,
} from "@finance/core/history/plan-accounts";
import {
  planMilestones,
  replayTrajectory,
  taxAtHorizon,
} from "@finance/core/history/plan-figures";
import { historyReturnFor } from "@finance/core/history/plan-accounts";
import type { ReplayAccount, ReplayResult } from "@finance/core/history/replay";
import type { ProjectionPoint } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_MAX_MONTHS,
} from "@finance/core/year-ahead";

/**
 * The landing sample's Plan, worked out by the app's own rules
 * (`@finance/core/history`): its accounts replayed from every start since
 * 1970, for the Plan mock and the Plan page's demo.
 *
 * Apart from `landing-sample.ts`, which keeps no runtime edge to core so a
 * test runner can load it bare; the figures are that file's sample person:
 * the 3 200 € salary, 959 € of charges, an everyday's spending, the
 * « Emergency fund » into a Livret A, the PEA DCA, and the CTO and crypto
 * from Placements. With no fund named, each wallet follows its default
 * history: developed shares for the PEA and the CTO, bitcoin for the crypto.
 */

/** The sample person's accounts, as the Plan reads them. */
const SAMPLE_ENVELOPES: Envelope[] = [
  {
    id: "livret_a",
    initial: 2900,
    monthly: 150,
    annualReturn: 0.017,
    taxOnGains: 0,
  },
  {
    id: "pea",
    initial: 6800,
    monthly: 200,
    annualReturn: 0.07,
    taxOnGains: 0.186,
    // An MSCI World ETF's 0.2 % or so, and a little for the broker.
    fees: 0.0025,
  },
  {
    id: "cto",
    initial: 4200,
    monthly: 0,
    annualReturn: 0.07,
    taxOnGains: 0.314,
    fees: 0.003,
  },
  {
    id: "crypto",
    initial: 1480,
    monthly: 0,
    annualReturn: 0.05,
    taxOnGains: 0.314,
  },
];

/** What the current account holds on the 19th: Le point's balance. */
const ON_HAND = 2410;
const INCOME = 3200;
const COMMITTED = 959;
/** The Livret A's 150 € and the PEA's 200 €, leaving the current account. */
const SET_ASIDE = 350;
const EVERYDAY = 1500;

/** Five years of the sample's months, from April 2026. */
function samplePoints(): ProjectionPoint[] {
  return Array.from({ length: YEAR_AHEAD_MAX_MONTHS }, (_, index) => {
    const year = 2026 + Math.floor((3 + index) / 12);
    const month = ((3 + index) % 12) + 1;
    const left = (INCOME - COMMITTED - SET_ASIDE - EVERYDAY) * (index + 1);
    return {
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      label: formatMonthLabel(year, month, "fr"),
      year,
      month,
      income: INCOME,
      expense: COMMITTED,
      setAside: SET_ASIDE,
      deployed: 0,
      unrecorded: EVERYDAY,
      onHand: ON_HAND + left,
      kept: ON_HAND + left + SET_ASIDE * (index + 1),
    };
  });
}

/** The current account walked forward by the sample's months, as the app does. */
const SAMPLE_CASH = cashFromYearAhead(
  buildYearAhead({
    points: samplePoints(),
    onHandToday: ON_HAND,
    envelopes: SAMPLE_ENVELOPES,
    horizon: YEAR_AHEAD_MAX_MONTHS,
  }),
);

/** The sample's accounts the demo lets a visitor pay into, and how much. */
export type SampleMonthly = Partial<Record<"livret_a" | "pea", number>>;

/** What the sample puts into each of them now. */
export const SAMPLE_MONTHLY = { livret_a: 150, pea: 200 } as const;

export interface SampleTrajectory {
  accounts: ReplayAccount[];
  result: ReplayResult;
  /** Everything today, the start of every line. */
  today: number;
  /** The middle start, less what selling everything would cost in tax. */
  afterTax: number;
}

/**
 * The sample's accounts replayed to `years`, with what goes into its Livret
 * A and PEA each month changed if a visitor changed it.
 */
export function sampleTrajectory(
  years: number,
  monthly: SampleMonthly = {},
): SampleTrajectory {
  const envelopes = SAMPLE_ENVELOPES.map((envelope) => ({
    ...envelope,
    monthly: monthly[envelope.id as keyof SampleMonthly] ?? envelope.monthly,
  }));
  const accounts = planAccounts({
    envelopes,
    wallets: {},
    cash: SAMPLE_CASH,
    // What a visitor moves into an account leaves the current account.
    fromCurrent: monthlyFromCurrent(SAMPLE_ENVELOPES, envelopes),
  });
  const result = replayTrajectory(accounts, years);
  return {
    accounts,
    result,
    today: accounts.reduce((sum, account) => sum + account.value, 0),
    afterTax: result.end.p50 - taxAtHorizon({ result, accounts, envelopes }),
  };
}

/** One of the sample's accounts as « Vos comptes » lists it. */
export interface SampleAccountRow {
  id: string;
  today: number;
  monthly: number;
  /** What its history returned a year; null for the cash and for bitcoin. */
  annualReturn: number | null;
}

/** The sample's accounts, the cash first, as « Vos comptes » lists them. */
export function sampleAccountRows(): SampleAccountRow[] {
  return sampleTrajectory(1).accounts.map((account) => {
    const envelope = SAMPLE_ENVELOPES.find((each) => each.id === account.id);
    return {
      id: account.id,
      today: account.value,
      monthly: account.monthly,
      annualReturn: envelope ? historyReturnFor(envelope, {}) : null,
    };
  });
}

/** The sample's milestones, dated on the middle start. */
export function sampleMilestones(): Milestone[] {
  return planMilestones({ envelopes: SAMPLE_ENVELOPES, wallets: {} });
}

/** The Livret A against the fixed charges: about three months. */
export function sampleCushion(): Cushion {
  return buildCushion(SAMPLE_ENVELOPES[0]!.initial / COMMITTED);
}
