/**
 * Which history each of a reader's accounts follows.
 *
 * A fund the app can name (`etf-shortlist`) follows the series of its
 * index's family; anything else follows what its account usually holds —
 * world shares in a PEA, a CTO or a PER, the fonds euros in an assurance
 * vie, bitcoin in a crypto wallet. Savings accounts follow their regulated
 * rate, and a PEL its contract's. Wherever a series stands in for something
 * it is not — an emerging fund on developed markets' history, the Nasdaq-100
 * on the whole US market — the share of the account it covers is counted,
 * so the page can say so.
 */

import { shortlistEntry, type IndexFamily } from "../etf-shortlist";
import { isBitcoinSymbol } from "../crypto-holdings";
import { ENVELOPE_PRESETS, type Envelope } from "../future-plan";
import type { InvestmentWalletId } from "../investments";
import type { MixKey, ReplayAccount, SeriesMix } from "./replay";

/**
 * The series each index family follows. `standIn`: the series is broader or
 * narrower than the index — honest about the shape of a fall, not exact.
 */
const FAMILY_SERIES: Record<IndexFamily, { key: MixKey; standIn: boolean }> = {
  "world-developed": { key: "world", standIn: false },
  // An all-world index is about a tenth emerging markets, which have no
  // series of their own.
  "world-all-cap": { key: "world", standIn: true },
  "us-large": { key: "us", standIn: false },
  "us-tech": { key: "us", standIn: true },
  "us-small": { key: "us", standIn: true },
  europe: { key: "europe", standIn: false },
  emerging: { key: "world", standIn: true },
  // Euro government bonds, on France's ten-year bond.
  "bond-euro": { key: "bonds-fr", standIn: true },
};

/** What a wallet's unrecognised holdings follow. */
const WALLET_DEFAULT: Record<InvestmentWalletId, MixKey> = {
  pea: "world",
  cto: "world",
  per: "world",
  av: "fonds-euros",
  crypto: "bitcoin",
};

export interface PositionForMix {
  walletId: InvestmentWalletId;
  marketValue: number;
  isin: string | null;
  instrumentSymbol: string | null;
}

export interface WalletMix {
  mix: SeriesMix;
  /** The share followed by a series that only stands in for it. */
  standInShare: number;
  /** The share the app does not recognise, followed as the wallet's default. */
  unknownShare: number;
}

/**
 * Each wallet's holdings as shares of the series they follow, weighted by
 * what each position is worth today.
 */
export function walletMixes(
  positions: readonly PositionForMix[],
): Partial<Record<InvestmentWalletId, WalletMix>> {
  const sums = new Map<
    InvestmentWalletId,
    {
      total: number;
      byKey: Map<MixKey, number>;
      standIn: number;
      unknown: number;
    }
  >();
  for (const position of positions) {
    if (position.marketValue <= 0) {
      continue;
    }
    const sum = sums.get(position.walletId) ?? {
      total: 0,
      byKey: new Map<MixKey, number>(),
      standIn: 0,
      unknown: 0,
    };
    const entry = position.isin ? shortlistEntry(position.isin) : null;
    let key: MixKey;
    if (entry) {
      const family = FAMILY_SERIES[entry.indexFamily];
      key = family.key;
      if (family.standIn) {
        sum.standIn += position.marketValue;
      }
    } else {
      key = WALLET_DEFAULT[position.walletId];
      if (key === "bitcoin") {
        // Other coins follow bitcoin's history, which is not theirs.
        if (!isBitcoinSymbol(position.instrumentSymbol)) {
          sum.standIn += position.marketValue;
        }
      } else {
        sum.unknown += position.marketValue;
      }
    }
    sum.byKey.set(key, (sum.byKey.get(key) ?? 0) + position.marketValue);
    sum.total += position.marketValue;
    sums.set(position.walletId, sum);
  }

  const mixes: Partial<Record<InvestmentWalletId, WalletMix>> = {};
  for (const [wallet, sum] of sums) {
    mixes[wallet] = {
      mix: Object.fromEntries(
        [...sum.byKey].map(([key, value]) => [key, value / sum.total]),
      ),
      standInShare: sum.standIn / sum.total,
      unknownShare: sum.unknown / sum.total,
    };
  }
  return mixes;
}

/**
 * One of the Plan's accounts, ready to replay: its value, what goes in, its
 * fees and ceiling as the long view knows them, and the history it follows.
 * `shift` is the reader's edit to history's return, from « Hypothèses ».
 */
export function replayAccount(
  envelope: Envelope,
  wallets: Partial<Record<InvestmentWalletId, WalletMix>>,
  shift = 0,
): ReplayAccount {
  const base = {
    id: envelope.id,
    value: envelope.initial,
    monthly: envelope.monthly,
    ceiling: ENVELOPE_PRESETS[envelope.id]?.ceiling ?? null,
    shift,
  };
  switch (envelope.id) {
    case "savings":
    case "livret_a":
    case "ldds":
    case "livret":
      return { ...base, mix: { "livret-a": 1 } };
    case "lep":
      return { ...base, mix: { lep: 1 } };
    case "cel":
      // Two thirds of the Livret A's rate, as the rule sets it.
      return { ...base, mix: { "livret-a": 2 / 3, cash: 1 / 3 } };
    case "pel":
      return { ...base, mix: {}, fixedRate: envelope.annualReturn };
    default: {
      const mix = wallets[envelope.id]?.mix ?? {
        [WALLET_DEFAULT[envelope.id]]: 1,
      };
      // The fonds euros' published figure is already net of the contract's
      // management fees: those come off the rest of the account only.
      const fees = (envelope.fees ?? 0) * (1 - (mix["fonds-euros"] ?? 0));
      return { ...base, mix, fees };
    }
  }
}
