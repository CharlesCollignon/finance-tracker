/**
 * The Plan's figures around the replay, worked out one way for the web and
 * the phone: the trajectory's rule for a full livret, what counts as
 * invested, the great falls, the milestones on the middle start, how often
 * each account ended below prices, what selling at the horizon would cost in
 * tax, and the homes' line.
 *
 * One function each, so each app's hook can remember each apart and moving
 * « Et si… » redoes only what reads it.
 */

import { formatMonthLabel } from "../constants";
import {
  buildMilestones,
  ENVELOPE_SHORT_KEYS,
  wealthToday,
  type Envelope,
  type EnvelopeId,
  type Milestone,
} from "../future-plan";
import type { Locale } from "../i18n/locale";
import type { Key } from "../i18n/t";
import type { InvestmentWalletId } from "../investments";
import type { MarketContext } from "../property";
import { DEFAULT_PROPERTY_GROWTH, projectProperty } from "../property-future";
import type { Property, PropertyLoan } from "../types/database";
import type { YearAheadAccountId } from "../year-ahead";
import type { WalletMix } from "./mix";
import { planAccounts } from "./plan-accounts";
import {
  CRASH_EPISODES,
  crashTest,
  lossOdds,
  replayPlan,
  type CrashEpisodeId,
  type CrashTest,
  type LossOdds,
  type MixKey,
  type ReplayAccount,
  type ReplayResult,
  type SeriesMix,
} from "./replay";

/** How far ahead the milestones look, whatever the horizon says. */
export const MILESTONE_MONTHS = 360;
/** The withdrawal is the one that has lasted this long. */
export const WITHDRAWAL_YEARS = 30;
/** Prices, for the homes alone: they have no market history to replay. */
const PROPERTY_INFLATION = 0.02;

/**
 * The accounts replayed to the horizon. A full livret refuses the transfer
 * and the money stays on the current account, so « Et si… » into a Livret
 * at its ceiling still counts.
 */
export function replayTrajectory(
  accounts: readonly ReplayAccount[],
  years: number,
): ReplayResult {
  return replayPlan({ accounts, months: years * 12, overflowTo: "current" });
}

/**
 * What is invested: every account following something other than the
 * regulated livrets and cash. History's falls and the withdrawal are about
 * these.
 */
export function investedAccounts(
  accounts: readonly ReplayAccount[],
): ReplayAccount[] {
  return accounts.filter((account) =>
    Object.keys(account.mix).some(
      (key) => key !== "livret-a" && key !== "lep" && key !== "cash",
    ),
  );
}

/** Today's investments through each great fall; null with none. */
export function crashTests(
  invested: readonly ReplayAccount[],
): Record<CrashEpisodeId, CrashTest> | null {
  if (invested.length === 0) {
    return null;
  }
  return Object.fromEntries(
    (Object.keys(CRASH_EPISODES) as CrashEpisodeId[]).map((id) => [
      id,
      crashTest(invested, id),
    ]),
  ) as Record<CrashEpisodeId, CrashTest>;
}

/**
 * The milestones, on money that exists: the reader's own savings and
 * investments, never their edits in « Hypothèses », dated on the middle
 * start in the euros of the day, thirty years out whatever the horizon.
 * With « Et si… », the same with so much more a month into one account; on
 * the current account it moves nothing, as the milestones do not count it.
 */
export function planMilestones({
  envelopes,
  wallets,
  extra = null,
}: {
  envelopes: readonly Envelope[];
  wallets: Partial<Record<InvestmentWalletId, WalletMix>>;
  extra?: { monthly: number; to: YearAheadAccountId } | null;
}): Milestone[] {
  const median = replayPlan({
    accounts: planAccounts({ envelopes, wallets, extra }),
    months: MILESTONE_MONTHS,
    overflowTo: null,
  }).nominalMedian;
  return buildMilestones(wealthToday(envelopes), median);
}

/** How often each account that follows a history ended below prices. */
export function accountOdds(
  accounts: readonly ReplayAccount[],
  years: number,
): Map<string, LossOdds> {
  return new Map(
    accounts
      .filter((account) => Object.keys(account.mix).length > 0)
      .map((account) => [account.id, lossOdds(account, years)]),
  );
}

/**
 * What selling everything at the horizon would cost in tax, in today's
 * euros: each account's gain over what went in, read on its own middle
 * start, at its own rate. The payments counted are the plan's, the extra
 * included where it goes.
 */
export function taxAtHorizon({
  result,
  accounts,
  envelopes,
  extra,
}: {
  result: ReplayResult;
  accounts: readonly ReplayAccount[];
  envelopes: readonly Envelope[];
  extra: { monthly: number; to: YearAheadAccountId } | null;
}): number {
  return result.accounts.reduce((sum, end) => {
    const envelope = envelopes.find((each) => each.id === end.id);
    const account = accounts.find((each) => each.id === end.id);
    if (!envelope || !account) {
      return sum;
    }
    const monthly =
      account.monthly + (extra && end.id === extra.to ? extra.monthly : 0);
    const gains = end.median - account.value - monthly * result.months;
    return sum + Math.max(0, gains) * envelope.taxOnGains;
  }, 0);
}

/** A home as its line reads it. */
export interface HomeForLine {
  property: Property;
  loans: readonly PropertyLoan[];
  market: MarketContext | null;
}

/**
 * The homes' net value, month by month from today to the horizon, in
 * today's euros: each grown at its own rate, less what its loans would
 * still owe and the tax a sale would take, as their own page reckons it.
 * Between year-ends the line runs straight.
 */
export function homesLine(
  homes: readonly HomeForLine[],
  today: string,
  months: number,
): number[] {
  const years = Math.ceil(months / 12);
  const yearly = Array.from({ length: years + 1 }, () => 0);
  for (const home of homes) {
    const growth =
      home.property.yearly_growth === null
        ? DEFAULT_PROPERTY_GROWTH
        : Number(home.property.yearly_growth);
    projectProperty(home.property, home.loans, home.market, {
      years,
      growth,
      today,
    }).forEach((year) => {
      yearly[year.year] += year.net / (1 + PROPERTY_INFLATION) ** year.year;
    });
  }
  return Array.from({ length: months + 1 }, (_, month) => {
    const year = Math.floor(month / 12);
    const into = (month % 12) / 12;
    const from = yearly[year];
    const to = yearly[Math.min(year + 1, years)];
    return from + (to - from) * into;
  });
}

/** « mars 2009 » from `2009-03`. */
export function historyMonthLabel(month: string, locale: Locale): string {
  const [year, number] = month.split("-").map(Number);
  return formatMonthLabel(year, number, locale);
}

/** A mix's sources, the largest first. */
export function mixKeys(mix: SeriesMix): MixKey[] {
  return (Object.entries(mix) as [MixKey, number][])
    .filter(([, weight]) => weight > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([key]) => key);
}

/** The name of an account in the trajectory: an envelope, or the cash. */
export function trajectoryAccountKey(id: string): Key {
  if (id === "current") {
    return "futurePlan.accountCurrent";
  }
  if (id === "elsewhere") {
    return "futurePlan.accountElsewhere";
  }
  return ENVELOPE_SHORT_KEYS[id as EnvelopeId];
}
