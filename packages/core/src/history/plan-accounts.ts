/**
 * The Plan's accounts as the replay takes them: the savings accounts and
 * wallets from the reader's figures, the current account walked forward by
 * the ledger, and the reader's own returns from « Vos comptes ».
 *
 * A return the reader types is a shift from history, not a replacement for
 * it (the owner's call, October 2026): the account keeps every rise and fall
 * its series had, scaled so that over the whole history it returns what was
 * typed, and a crash keeps its shape at any return. A PEL has no history to
 * shift — it pays its contract's rate, which is what the field then sets —
 * and bitcoin's is too short to start from, so its return is not offered.
 */

import type { Envelope, EnvelopeId } from "../future-plan";
import type { InvestmentWalletId } from "../investments";
import type { YearAhead } from "../year-ahead";
import { replayAccount, type WalletMix } from "./mix";
import {
  historicalReturn,
  type ReplayAccount,
  type SeriesReader,
} from "./replay";
import { historySeries } from "./series";

/**
 * The horizons the trajectory offers, in years. Thirty is the ceiling: from
 * January 1970 a thirty-year window leaves about three hundred starts, which
 * overlap heavily already, and forty would be fiction dressed as history.
 */
export const TRAJECTORY_YEARS = [1, 5, 10, 20, 30] as const;
export type TrajectoryYears = (typeof TRAJECTORY_YEARS)[number];
export const TRAJECTORY_DEFAULT_YEARS: TrajectoryYears = 10;

/** Money the ledger leaves somewhere that earns nothing. */
export interface CashAccount {
  /** The current account, or what is set aside with no account to take it. */
  id: "current" | "elsewhere";
  value: number;
  /** What the ledger moves onto it, month by month, for the months it knows. */
  schedule: readonly number[];
  /** Each month after those. */
  monthly: number;
}

export interface PlanAccountsInput {
  envelopes: readonly Envelope[];
  wallets: Partial<Record<InvestmentWalletId, WalletMix>>;
  /** The reader's own yearly returns, from « Vos comptes ». */
  returns?: Partial<Record<EnvelopeId, number>>;
  cash?: readonly CashAccount[];
  /**
   * What the reader's edits put into the accounts each month beyond their
   * own figures (`monthlyFromCurrent`), taken off the current account: money
   * moved, not made.
   */
  fromCurrent?: number;
  read?: SeriesReader;
}

/**
 * How much more goes into the accounts each month with the reader's edits
 * than with their own figures — or less, as a negative. A transfer raised in
 * « Vos comptes » comes from the current account, where that money was
 * otherwise left: counting it in both would count it twice.
 */
export function monthlyFromCurrent(
  own: readonly Envelope[],
  edited: readonly Envelope[],
): number {
  return edited.reduce((sum, envelope) => {
    const before = own.find((each) => each.id === envelope.id);
    return sum + envelope.monthly - (before?.monthly ?? envelope.monthly);
  }, 0);
}

/**
 * What an account's history returned a year, before fees: where its return
 * starts in « Vos comptes », and what a typed return is measured from. Null
 * for a PEL, which pays its contract, and for anything holding bitcoin,
 * whose eleven years are no long run to start from.
 */
export function historyReturnFor(
  envelope: Envelope,
  wallets: Partial<Record<InvestmentWalletId, WalletMix>>,
  read: SeriesReader = historySeries,
): number | null {
  const account = replayAccount(envelope, wallets);
  if (account.fixedRate !== undefined || (account.mix.bitcoin ?? 0) > 0) {
    return null;
  }
  return historicalReturn({ mix: account.mix }, read).nominal;
}

/**
 * The current account and what is set aside with no account, as the year
 * ahead walks them forward from the ledger, as things stand: what each holds
 * today, what each month moves onto it for as long as the projection reads,
 * and after that the last year's average.
 */
export function cashFromYearAhead(
  ahead: Pick<YearAhead, "bands">,
): CashAccount[] {
  return ahead.bands.flatMap((band): CashAccount[] => {
    if (band.id !== "current" && band.id !== "elsewhere") {
      return [];
    }
    const values = band.baseline;
    const schedule = values
      .slice(1)
      .map((value, index) => value - values[index]!);
    const lastYear = schedule.slice(-12);
    return [
      {
        id: band.id,
        value: values[0] ?? 0,
        schedule,
        monthly:
          lastYear.length > 0
            ? lastYear.reduce((sum, value) => sum + value, 0) / lastYear.length
            : 0,
      },
    ];
  });
}

/** The accounts to replay, the cash first, in the envelopes' order after. */
export function planAccounts(input: PlanAccountsInput): ReplayAccount[] {
  const read = input.read ?? historySeries;

  const moved = input.fromCurrent ?? 0;
  const cash = (input.cash ?? []).map((account): ReplayAccount => {
    const less = account.id === "current" ? moved : 0;
    return {
      id: account.id,
      value: account.value,
      mix: {},
      monthly: account.monthly - less,
      schedule: less
        ? account.schedule.map((payment) => payment - less)
        : account.schedule,
    };
  });

  const envelopes = input.envelopes.map((envelope): ReplayAccount => {
    let account = replayAccount(envelope, input.wallets);
    const typed = input.returns?.[envelope.id];
    if (typed !== undefined) {
      if (account.fixedRate !== undefined) {
        account = { ...account, fixedRate: typed };
      } else {
        const base = historyReturnFor(envelope, input.wallets, read);
        if (base !== null) {
          // The replay multiplies each month by the shift, so this is the
          // one that makes history return what was typed.
          account = { ...account, shift: (1 + typed) / (1 + base) - 1 };
        }
      }
    }
    return account;
  });

  return [...cash, ...envelopes];
}
