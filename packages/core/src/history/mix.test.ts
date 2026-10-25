import { describe, expect, it } from "vitest";
import { ETF_SHORTLIST, type IndexFamily } from "../etf-shortlist";
import type { Envelope } from "../future-plan";
import { replayAccount, walletMixes, type PositionForMix } from "./mix";

/** A fund the shortlist names, of a family. */
function isinOf(family: IndexFamily): string {
  const entry = Object.values(ETF_SHORTLIST).find(
    (each) => each.indexFamily === family,
  );
  if (!entry) {
    throw new Error(`No shortlisted fund tracks ${family}.`);
  }
  return entry.isin;
}

function position(over: Partial<PositionForMix>): PositionForMix {
  return {
    walletId: "pea",
    marketValue: 1000,
    isin: null,
    instrumentSymbol: null,
    ...over,
  };
}

function envelope(over: Partial<Envelope>): Envelope {
  return {
    id: "pea",
    initial: 1000,
    monthly: 100,
    annualReturn: 0.07,
    taxOnGains: 0.186,
    ...over,
  };
}

describe("walletMixes", () => {
  it("weights each wallet's funds by value, by their index's series", () => {
    const mixes = walletMixes([
      position({ isin: isinOf("world-developed"), marketValue: 3000 }),
      position({ isin: isinOf("us-large"), marketValue: 1000 }),
    ]);
    expect(mixes.pea?.mix).toEqual({ world: 0.75, us: 0.25 });
    expect(mixes.pea?.standInShare).toBe(0);
    expect(mixes.pea?.unknownShare).toBe(0);
  });

  it("counts what only a stand-in follows", () => {
    const mixes = walletMixes([
      position({ isin: isinOf("world-developed") }),
      position({ isin: isinOf("emerging") }),
    ]);
    expect(mixes.pea?.mix).toEqual({ world: 1 });
    expect(mixes.pea?.standInShare).toBe(0.5);
  });

  it("follows a wallet's usual holding for what it cannot name", () => {
    const mixes = walletMixes([
      position({ walletId: "av", isin: null }),
      position({ walletId: "cto", isin: "XX0000000000" }),
    ]);
    expect(mixes.av?.mix).toEqual({ "fonds-euros": 1 });
    expect(mixes.av?.unknownShare).toBe(1);
    expect(mixes.cto?.mix).toEqual({ world: 1 });
  });

  it("follows bitcoin for every coin, and says so for the others", () => {
    const mixes = walletMixes([
      position({ walletId: "crypto", instrumentSymbol: "BTC-EUR" }),
      position({ walletId: "crypto", instrumentSymbol: "ETH-EUR" }),
    ]);
    expect(mixes.crypto?.mix).toEqual({ bitcoin: 1 });
    expect(mixes.crypto?.standInShare).toBe(0.5);
    expect(mixes.crypto?.unknownShare).toBe(0);
  });

  it("leaves out what is worth nothing", () => {
    expect(walletMixes([position({ marketValue: 0 })])).toEqual({});
  });
});

describe("replayAccount", () => {
  it("follows a wallet's own mix, with its value, payments and shift", () => {
    const account = replayAccount(
      envelope({ fees: 0.003 }),
      walletMixes([position({ isin: isinOf("europe") })]),
      -0.01,
    );
    expect(account).toMatchObject({
      id: "pea",
      value: 1000,
      monthly: 100,
      mix: { europe: 1 },
      fees: 0.003,
      shift: -0.01,
    });
  });

  it("takes the contract's fees off an assurance vie's units only", () => {
    const account = replayAccount(
      envelope({ id: "av", fees: 0.01 }),
      walletMixes([
        position({ walletId: "av", isin: null, marketValue: 3000 }),
        position({ walletId: "av", isin: isinOf("world-developed") }),
      ]),
    );
    expect(account.mix).toEqual({ "fonds-euros": 0.75, world: 0.25 });
    expect(account.fees).toBeCloseTo(0.0025, 10);
  });

  it("follows the regulated rates, and a PEL's contract", () => {
    expect(replayAccount(envelope({ id: "ldds" }), {}).mix).toEqual({
      "livret-a": 1,
    });
    expect(replayAccount(envelope({ id: "lep" }), {}).mix).toEqual({ lep: 1 });
    expect(replayAccount(envelope({ id: "cel" }), {}).mix).toEqual({
      "livret-a": 2 / 3,
      cash: 1 / 3,
    });
    const pel = replayAccount(
      envelope({ id: "pel", annualReturn: 0.02 }),
      {},
    );
    expect(pel.fixedRate).toBe(0.02);
    expect(replayAccount(envelope({ id: "livret_a" }), {}).ceiling).toBe(22950);
  });

  it("follows the wallet's usual holding when nothing in it is known", () => {
    expect(replayAccount(envelope({ id: "crypto" }), {}).mix).toEqual({
      bitcoin: 1,
    });
  });
});
