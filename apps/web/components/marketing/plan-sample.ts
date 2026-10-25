import { formatMonthLabel } from "@finance/core/constants";
import {
  buildCushion,
  type Cushion,
  type Envelope,
  type Milestone,
} from "@finance/core/future-plan";
import {
  cashFromYearAhead,
  planAccounts,
} from "@finance/core/history/plan-accounts";
import {
  crashTests,
  investedAccounts,
  planMilestones,
  replayTrajectory,
  taxAtHorizon,
} from "@finance/core/history/plan-figures";
import type {
  CrashEpisodeId,
  CrashTest,
  ReplayAccount,
  ReplayResult,
} from "@finance/core/history/replay";
import type { ProjectionPoint } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_MAX_MONTHS,
  type YearAheadAccountId,
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

/** Where « Et si… » can go in the sample. */
export const SAMPLE_TARGETS: YearAheadAccountId[] = [
  "livret_a",
  "pea",
  "current",
];

export interface SampleTrajectory {
  accounts: ReplayAccount[];
  result: ReplayResult;
  /** Everything today, the start of every line. */
  today: number;
  /** The middle start, less what selling everything would cost in tax. */
  afterTax: number;
}

/** The sample's accounts replayed to `years`, with an extra if one is played. */
export function sampleTrajectory(
  years: number,
  extra?: { monthly: number; to: YearAheadAccountId },
): SampleTrajectory {
  const accounts = planAccounts({
    envelopes: SAMPLE_ENVELOPES,
    wallets: {},
    cash: SAMPLE_CASH,
    extra,
  });
  const result = replayTrajectory(accounts, years);
  return {
    accounts,
    result,
    today: accounts.reduce((sum, account) => sum + account.value, 0),
    afterTax:
      result.end.p50 -
      taxAtHorizon({
        result,
        accounts,
        envelopes: SAMPLE_ENVELOPES,
        extra: extra ?? null,
      }),
  };
}

/** The sample's investments through one of the great falls. */
export function sampleCrash(episode: CrashEpisodeId): CrashTest {
  const invested = investedAccounts(
    planAccounts({ envelopes: SAMPLE_ENVELOPES, wallets: {} }),
  );
  return crashTests(invested)![episode];
}

/** The sample's milestones, dated on the middle start. */
export function sampleMilestones(): Milestone[] {
  return planMilestones({ envelopes: SAMPLE_ENVELOPES, wallets: {} });
}

/** The Livret A against the fixed charges: about three months. */
export function sampleCushion(): Cushion {
  return buildCushion(SAMPLE_ENVELOPES[0]!.initial / COMMITTED);
}
