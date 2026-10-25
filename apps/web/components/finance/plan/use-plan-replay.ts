"use client";

import { useMemo } from "react";
import {
  buildCushion,
  cushionEnvelopes,
  cushionSavings,
  wealthToday,
  type Envelope,
  type Milestone,
} from "@finance/core/future-plan";
import { walletMixes } from "@finance/core/history/mix";
import {
  cashFromYearAhead,
  planAccounts,
} from "@finance/core/history/plan-accounts";
import {
  accountOdds,
  crashTests,
  homesLine,
  investedAccounts,
  planMilestones,
  replayTrajectory,
  WITHDRAWAL_YEARS,
} from "@finance/core/history/plan-figures";
import {
  typedReturns,
  withEdits,
  type HypothesesEdits,
} from "@finance/core/history/plan-settings";
import {
  sustainableWithdrawal,
  type CrashEpisodeId,
  type CrashTest,
  type LossOdds,
  type ReplayAccount,
  type ReplayResult,
} from "@finance/core/history/replay";
import { buildRunway } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_MAX_MONTHS,
  type YearAheadAccountId,
} from "@finance/core/year-ahead";
import type { PlanBase, PlanWealth } from "@/lib/queries/plan";
import { planEnvelopes } from "./plan-envelopes";

export interface PlanReplay {
  /** The reader's figures, untouched: what the milestones and crashes read. */
  dataEnvelopes: Envelope[];
  /** The same with « Hypothèses » laid over: what the trajectory reads. */
  envelopes: Envelope[];
  wallets: ReturnType<typeof walletMixes>;
  accounts: ReplayAccount[];
  months: number;
  /** As things stand, and with « Et si… » when there is one. */
  result: ReplayResult;
  withExtra: ReplayResult | null;
  /** The homes' line, in today's euros, when they join the figure. */
  property: number[] | null;
  /** Everything today, the homes included when they join. */
  today: number;
  milestones: Milestone[];
  /** Months until each milestone ahead with « Et si… », by amount. */
  milestonesWithExtra: Map<number, number | null> | null;
  /** Savings and investments today, as the milestones count them. */
  wealth: number;
  cushion: ReturnType<typeof buildCushion>;
  crashes: Record<CrashEpisodeId, CrashTest> | null;
  /** How often each account ended below prices at the horizon. */
  odds: Map<string, LossOdds>;
  withdrawal: ReturnType<typeof sustainableWithdrawal>;
  /** The accounts the withdrawal is measured on: what is invested. */
  investedIds: Set<string>;
}

/**
 * Everything the Plan's cards draw, worked out from the reader's figures
 * and the market history, each piece remembered until what it reads moves.
 * The figures are core's (`history/plan-figures`), as the phone's are.
 */
export function usePlanReplay({
  base,
  wealth,
  edits,
  years,
  extra,
  target,
  withProperty,
}: {
  base: PlanBase;
  wealth: PlanWealth | null;
  edits: HypothesesEdits;
  years: number;
  extra: number;
  target: YearAheadAccountId;
  withProperty: boolean;
}): PlanReplay {
  const months = years * 12;

  const dataEnvelopes = useMemo(
    () => planEnvelopes(base, wealth),
    [base, wealth],
  );
  const wallets = useMemo(() => walletMixes(wealth?.positions ?? []), [wealth]);
  // The current account walked forward by the ledger, as the year ahead does.
  const cash = useMemo(
    () =>
      cashFromYearAhead(
        buildYearAhead({
          points: base.projection.points,
          onHandToday: base.projection.opening.onHand,
          envelopes: dataEnvelopes,
          horizon: YEAR_AHEAD_MAX_MONTHS,
          complete: wealth !== null,
        }),
      ),
    [base.projection, dataEnvelopes, wealth],
  );
  const envelopes = useMemo(
    () => withEdits(dataEnvelopes, edits),
    [dataEnvelopes, edits],
  );
  const returns = useMemo(() => typedReturns(edits), [edits]);

  const accounts = useMemo(
    () => planAccounts({ envelopes, wallets, returns, cash }),
    [envelopes, wallets, returns, cash],
  );
  const result = useMemo(
    () => replayTrajectory(accounts, years),
    [accounts, years],
  );
  const withExtra = useMemo(
    () =>
      extra > 0
        ? replayTrajectory(
            planAccounts({
              envelopes,
              wallets,
              returns,
              cash,
              extra: { monthly: extra, to: target },
            }),
            years,
          )
        : null,
    [envelopes, wallets, returns, cash, extra, target, years],
  );

  const property = useMemo(
    () =>
      withProperty && base.properties && base.properties.length > 0
        ? homesLine(base.properties, base.today, months)
        : null,
    [withProperty, base.properties, base.today, months],
  );
  const today =
    accounts.reduce((sum, account) => sum + account.value, 0) +
    (property?.[0] ?? 0);

  const wealthNow = wealthToday(dataEnvelopes);
  const milestones = useMemo(
    () => planMilestones({ envelopes: dataEnvelopes, wallets }),
    [dataEnvelopes, wallets],
  );
  const milestonesWithExtra = useMemo(() => {
    if (extra <= 0 || !dataEnvelopes.some((each) => each.id === target)) {
      return null;
    }
    return new Map(
      planMilestones({
        envelopes: dataEnvelopes,
        wallets,
        extra: { monthly: extra, to: target },
      }).map((each) => [each.amount, each.monthsAway]),
    );
  }, [extra, target, dataEnvelopes, wallets]);

  const cushion = useMemo(
    () =>
      buildCushion(
        buildRunway(
          cushionSavings(cushionEnvelopes(null, planEnvelopes(base, null))),
          base.templates,
          base.year,
          base.month,
        ).months,
      ),
    [base],
  );

  // History's falls, on what is invested today: the reader's figures, not
  // their edits — these are the markets as they were.
  const invested = useMemo(
    () => investedAccounts(planAccounts({ envelopes: dataEnvelopes, wallets })),
    [dataEnvelopes, wallets],
  );
  const crashes = useMemo(() => crashTests(invested), [invested]);
  const odds = useMemo(() => accountOdds(accounts, years), [accounts, years]);
  const withdrawal = useMemo(
    () =>
      invested.length > 0
        ? sustainableWithdrawal(invested, WITHDRAWAL_YEARS)
        : null,
    [invested],
  );

  return {
    dataEnvelopes,
    envelopes,
    wallets,
    accounts,
    months,
    result,
    withExtra,
    property,
    today,
    milestones,
    milestonesWithExtra,
    wealth: wealthNow,
    cushion,
    crashes,
    odds,
    withdrawal,
    investedIds: new Set(invested.map((account) => account.id)),
  };
}
