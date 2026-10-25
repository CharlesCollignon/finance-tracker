/**
 * The Plan's accounts as the replay takes them: the savings accounts and
 * wallets from the reader's figures, the current account walked forward by
 * the ledger, the reader's own returns from « Hypothèses », and « Et si… ».
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
import type { YearAheadAccountId } from "../year-ahead";
import { replayAccount, type WalletMix } from "./mix";
import {
  historicalReturn,
  type ReplayAccount,
  type SeriesReader,
} from "./replay";
import { historySeries } from "./series";

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
  /** The reader's own yearly returns, from « Hypothèses ». */
  returns?: Partial<Record<EnvelopeId, number>>;
  cash?: readonly CashAccount[];
  /** « Et si… »: so much more each month, into this account. */
  extra?: { monthly: number; to: YearAheadAccountId } | null;
  read?: SeriesReader;
}

/**
 * What an account's history returned a year, before fees: where its return
 * starts in « Hypothèses », and what a typed return is measured from. Null
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

/** The accounts to replay, the cash first, in the envelopes' order after. */
export function planAccounts(input: PlanAccountsInput): ReplayAccount[] {
  const read = input.read ?? historySeries;
  const extra = input.extra && input.extra.monthly > 0 ? input.extra : null;

  const cash = (input.cash ?? []).map((account): ReplayAccount => {
    const more = extra?.to === account.id ? extra.monthly : 0;
    return {
      id: account.id,
      value: account.value,
      mix: {},
      monthly: account.monthly + more,
      schedule: more
        ? account.schedule.map((payment) => payment + more)
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
    if (extra?.to === envelope.id) {
      account = { ...account, monthly: account.monthly + extra.monthly };
    }
    return account;
  });

  return [...cash, ...envelopes];
}
