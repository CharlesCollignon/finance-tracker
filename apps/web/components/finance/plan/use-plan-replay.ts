"use client";

import { useMemo } from "react";
import {
  buildCushion,
  buildMilestones,
  cushionEnvelopes,
  cushionSavings,
  wealthToday,
  type Envelope,
} from "@finance/core/future-plan";
import { walletMixes } from "@finance/core/history/mix";
import {
  cashFromYearAhead,
  planAccounts,
} from "@finance/core/history/plan-accounts";
import {
  CRASH_EPISODES,
  crashTest,
  lossOdds,
  replayPlan,
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
import { typedReturns, withEdits, type HypothesesEdits } from "./plan-storage";
import { propertyLine } from "./trajectory-data";

/** How far ahead the milestones look, whatever the horizon says. */
const MILESTONE_MONTHS = 360;
/** The withdrawal is the one that lasted this long. */
const WITHDRAWAL_YEARS = 30;

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
  milestones: ReturnType<typeof buildMilestones>;
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
  // A full livret refuses the transfer, and the money stays on the account.
  const result = useMemo(
    () => replayPlan({ accounts, months, overflowTo: "current" }),
    [accounts, months],
  );
  const withExtra = useMemo(
    () =>
      extra > 0
        ? replayPlan({
            accounts: planAccounts({
              envelopes,
              wallets,
              returns,
              cash,
              extra: { monthly: extra, to: target },
            }),
            months,
            overflowTo: "current",
          })
        : null,
    [envelopes, wallets, returns, cash, extra, target, months],
  );

  const property = useMemo(
    () =>
      withProperty && base.properties && base.properties.length > 0
        ? propertyLine(base.properties, base.today, months)
        : null,
    [withProperty, base.properties, base.today, months],
  );
  const today =
    accounts.reduce((sum, account) => sum + account.value, 0) +
    (property?.[0] ?? 0);

  // The milestones count money that exists: the reader's own savings and
  // investments, never their edits, over a long view whatever the horizon.
  const saved = useMemo(
    () => planAccounts({ envelopes: dataEnvelopes, wallets }),
    [dataEnvelopes, wallets],
  );
  const wealthNow = wealthToday(dataEnvelopes);
  const milestones = useMemo(
    () =>
      buildMilestones(
        wealthNow,
        replayPlan({
          accounts: saved,
          months: MILESTONE_MONTHS,
          overflowTo: null,
        }).nominalMedian,
      ),
    [saved, wealthNow],
  );
  const milestonesWithExtra = useMemo(() => {
    if (extra <= 0 || !dataEnvelopes.some((each) => each.id === target)) {
      return null;
    }
    const boosted = replayPlan({
      accounts: planAccounts({
        envelopes: dataEnvelopes,
        wallets,
        extra: { monthly: extra, to: target },
      }),
      months: MILESTONE_MONTHS,
      overflowTo: null,
    }).nominalMedian;
    return new Map(
      buildMilestones(wealthNow, boosted).map((each) => [
        each.amount,
        each.monthsAway,
      ]),
    );
  }, [extra, target, dataEnvelopes, wallets, wealthNow]);

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
    () =>
      saved.filter((account) =>
        Object.keys(account.mix).some(
          (key) => key !== "livret-a" && key !== "lep" && key !== "cash",
        ),
      ),
    [saved],
  );
  const crashes = useMemo(
    () =>
      invested.length > 0
        ? (Object.fromEntries(
            (Object.keys(CRASH_EPISODES) as CrashEpisodeId[]).map((id) => [
              id,
              crashTest(invested, id),
            ]),
          ) as Record<CrashEpisodeId, CrashTest>)
        : null,
    [invested],
  );

  const odds = useMemo(
    () =>
      new Map(
        accounts
          .filter((account) => Object.keys(account.mix).length > 0)
          .map((account) => [account.id, lossOdds(account, years)]),
      ),
    [accounts, years],
  );
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
