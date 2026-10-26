import { describe, expect, it } from "vitest";
import type { Envelope } from "../future-plan";
import {
  cashFromYearAhead,
  historyReturnFor,
  monthlyFromCurrent,
  planAccounts,
} from "./plan-accounts";
import type { HistorySeries, HistorySeriesId } from "./series";
import { replayPlan, type SeriesReader } from "./replay";

/** 2000–2002, world shares at 1 % a month, everything else still. */
const read: SeriesReader = (id: HistorySeriesId) =>
  ({
    id,
    start: "2000-01",
    end: "2002-12",
    returns: Array(36).fill(id === "world" ? 0.01 : 0),
    reconstructedUntil: null,
  }) satisfies HistorySeries;

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

describe("historyReturnFor", () => {
  it("is what the account's series returned, before fees", () => {
    expect(historyReturnFor(envelope({ fees: 0.01 }), {}, read)).toBeCloseTo(
      1.01 ** 12 - 1,
      10,
    );
  });

  it("is not offered for a PEL or for bitcoin", () => {
    expect(historyReturnFor(envelope({ id: "pel" }), {}, read)).toBeNull();
    expect(historyReturnFor(envelope({ id: "crypto" }), {}, read)).toBeNull();
  });
});

describe("planAccounts", () => {
  it("puts the cash first, and the envelopes in their order", () => {
    const accounts = planAccounts({
      envelopes: [envelope({ id: "livret_a" }), envelope({})],
      wallets: {},
      cash: [{ id: "current", value: 500, schedule: [200, -50], monthly: 80 }],
      read,
    });
    expect(accounts.map((account) => account.id)).toEqual([
      "current",
      "livret_a",
      "pea",
    ]);
    expect(accounts[0]).toMatchObject({ mix: {}, schedule: [200, -50] });
  });

  it("turns a typed return into a shift from history", () => {
    const [account] = planAccounts({
      envelopes: [envelope({ initial: 1000, monthly: 0 })],
      wallets: {},
      returns: { pea: 0.05 },
      read,
    });
    expect(account.shift).toBeCloseTo(1.05 / 1.01 ** 12 - 1, 10);
    // Every start then returns what was typed, history's shape kept.
    const result = replayPlan({ accounts: [account], months: 12, read });
    expect(result.end.p50).toBeCloseTo(1000 * 1.05, 6);
  });

  it("sets a PEL's contract rate from its typed return", () => {
    const [pel] = planAccounts({
      envelopes: [envelope({ id: "pel", annualReturn: 0.02 })],
      wallets: {},
      returns: { pel: 0.03 },
      read,
    });
    expect(pel.fixedRate).toBe(0.03);
  });
});

describe("monthlyFromCurrent", () => {
  it("takes a raised transfer off the current account", () => {
    const own = [
      envelope({ monthly: 100 }),
      envelope({ id: "av", monthly: 50 }),
    ];
    const edited = [
      envelope({ monthly: 300 }),
      envelope({ id: "av", monthly: 0 }),
    ];
    expect(monthlyFromCurrent(own, edited)).toBe(150);
    const accounts = planAccounts({
      envelopes: edited,
      wallets: {},
      cash: [{ id: "current", value: 0, schedule: [400, 380], monthly: 390 }],
      fromCurrent: monthlyFromCurrent(own, edited),
      read,
    });
    expect(accounts[0]).toMatchObject({ monthly: 240, schedule: [250, 230] });
  });
});

describe("cashFromYearAhead", () => {
  it("reads the ledger's months off the bands, as things stand", () => {
    const band = (id: string, baseline: number[]) => ({
      id,
      values: baseline.map((value) => value + 999),
      baseline,
      hidden: false,
    });
    const cash = cashFromYearAhead({
      bands: [
        band("current", [1000, 1300, 1200, 1500]),
        band("livret_a", [5000, 5100, 5200, 5300]),
        band("elsewhere", [0, 50, 100, 150]),
      ] as Parameters<typeof cashFromYearAhead>[0]["bands"],
    });
    expect(cash).toEqual([
      {
        id: "current",
        value: 1000,
        schedule: [300, -100, 300],
        monthly: 500 / 3,
      },
      { id: "elsewhere", value: 0, schedule: [50, 50, 50], monthly: 50 },
    ]);
  });
});
