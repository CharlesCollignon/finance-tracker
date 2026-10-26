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
  monthlyFromCurrent,
  planAccounts,
} from "@finance/core/history/plan-accounts";
import {
  accountOdds,
  homesLine,
  investedAccounts,
  planMilestones,
  replayTrajectory,
  WITHDRAWAL_YEARS,
} from "@finance/core/history/plan-figures";
import {
  typedReturns,
  withEdits,
  type PlanEdits,
} from "@finance/core/history/plan-settings";
import {
  sustainableWithdrawal,
  type LossOdds,
  type ReplayAccount,
  type ReplayResult,
} from "@finance/core/history/replay";
import { buildRunway } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_MAX_MONTHS,
} from "@finance/core/year-ahead";
import type { PlanBase, PlanWealth } from "@/lib/queries/plan";
import { planEnvelopes } from "./plan-envelopes";

export interface PlanReplay {
  /** The reader's figures, untouched: what the milestones read. */
  dataEnvelopes: Envelope[];
  /** The same with « Vos comptes » laid over: what the trajectory reads. */
  envelopes: Envelope[];
  wallets: ReturnType<typeof walletMixes>;
  accounts: ReplayAccount[];
  months: number;
  result: ReplayResult;
  /** The homes' line, in today's euros, when they join the figure. */
  property: number[] | null;
  /** Everything today, the homes included when they join. */
  today: number;
  milestones: Milestone[];
  /** Savings and investments today, as the milestones count them. */
  wealth: number;
  cushion: ReturnType<typeof buildCushion>;
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
  withProperty,
}: {
  base: PlanBase;
  wealth: PlanWealth | null;
  edits: PlanEdits;
  years: number;
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
    () =>
      planAccounts({
        envelopes,
        wallets,
        returns,
        cash,
        // A transfer raised here comes from the current account.
        fromCurrent: monthlyFromCurrent(dataEnvelopes, envelopes),
      }),
    [envelopes, dataEnvelopes, wallets, returns, cash],
  );
  const result = useMemo(
    () => replayTrajectory(accounts, years),
    [accounts, years],
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

  // The withdrawal's rate is measured on what is invested, on the reader's
  // own figures rather than their edits: it has to be one that history
  // actually held to.
  const invested = useMemo(
    () => investedAccounts(planAccounts({ envelopes: dataEnvelopes, wallets })),
    [dataEnvelopes, wallets],
  );
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
    property,
    today,
    milestones,
    wealth: wealthNow,
    cushion,
    odds,
    withdrawal,
    investedIds: new Set(invested.map((account) => account.id)),
  };
}
