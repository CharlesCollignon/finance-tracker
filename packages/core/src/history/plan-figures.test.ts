import { describe, expect, it } from "vitest";
import type { Envelope } from "../future-plan";
import {
  accountOdds,
  crashTests,
  investedAccounts,
  mixKeys,
  planMilestones,
  taxAtHorizon,
  trajectoryAccountKey,
} from "./plan-figures";
import type { ReplayAccount, ReplayResult } from "./replay";

function account(over: Partial<ReplayAccount>): ReplayAccount {
  return { id: "pea", value: 10_000, monthly: 200, mix: { world: 1 }, ...over };
}

function envelope(over: Partial<Envelope>): Envelope {
  return {
    id: "pea",
    initial: 30_000,
    monthly: 500,
    annualReturn: 0.07,
    taxOnGains: 0.172,
    ...over,
  };
}

describe("investedAccounts", () => {
  it("keeps what follows markets, not the livrets or cash", () => {
    const kept = investedAccounts([
      account({ id: "current", mix: {} }),
      account({ id: "livret_a", mix: { "livret-a": 1 } }),
      account({ id: "lep", mix: { lep: 1 } }),
      account({ id: "pea" }),
      account({ id: "av", mix: { "fonds-euros": 0.7, world: 0.3 } }),
    ]);
    expect(kept.map((each) => each.id)).toEqual(["pea", "av"]);
  });
});

describe("crashTests", () => {
  it("is null with nothing invested, and puts the rest through each fall", () => {
    expect(crashTests([])).toBeNull();
    const tests = crashTests([account({})])!;
    expect(Object.keys(tests)).toEqual(["2000", "2008", "2020", "2022"]);
    expect(tests["2008"].low.loss).toBeLessThan(0);
  });
});

describe("planMilestones", () => {
  it("counts what is there today and dates what is ahead", () => {
    const milestones = planMilestones({
      envelopes: [envelope({})],
      wallets: {},
    });
    const reached = milestones.filter((each) => each.reached);
    expect(reached.at(-1)?.amount).toBeLessThanOrEqual(30_000);
    const next = milestones.find((each) => !each.reached)!;
    expect(next.monthsAway).toBeGreaterThan(0);
  });

  it("brings a milestone closer with an extra, and not on the current account", () => {
    const envelopes = [envelope({})];
    const next = (to: "pea" | "current") =>
      planMilestones({
        envelopes,
        wallets: {},
        extra: { monthly: 500, to },
      }).find((each) => !each.reached)!;
    const without = planMilestones({ envelopes, wallets: {} }).find(
      (each) => !each.reached,
    )!;
    expect(next("pea").monthsAway!).toBeLessThan(without.monthsAway!);
    expect(next("current").monthsAway).toBe(without.monthsAway);
  });
});

describe("accountOdds", () => {
  it("is measured on accounts that follow a history only", () => {
    const odds = accountOdds(
      [account({ id: "current", mix: {} }), account({})],
      10,
    );
    expect([...odds.keys()]).toEqual(["pea"]);
    expect(odds.get("pea")!.windows).toBeGreaterThan(400);
  });
});

describe("taxAtHorizon", () => {
  const result = {
    months: 12,
    accounts: [{ id: "pea", median: 3_000 }],
  } as ReplayResult;
  const accounts = [account({ value: 1_000, monthly: 100 })];
  const envelopes = [envelope({ taxOnGains: 0.3 })];

  it("taxes the gain over what went in, at the account's rate", () => {
    expect(
      taxAtHorizon({ result, accounts, envelopes, extra: null }),
    ).toBeCloseTo((3_000 - 1_000 - 1_200) * 0.3, 6);
  });

  it("counts the extra as money put in, and never taxes a loss", () => {
    expect(
      taxAtHorizon({
        result,
        accounts,
        envelopes,
        extra: { monthly: 50, to: "pea" },
      }),
    ).toBeCloseTo((3_000 - 1_000 - 1_800) * 0.3, 6);
    expect(
      taxAtHorizon({
        result: { ...result, accounts: [{ id: "pea", median: 900 }] },
        accounts,
        envelopes,
        extra: null,
      }),
    ).toBe(0);
  });
});

describe("mixKeys and trajectoryAccountKey", () => {
  it("lists a mix's sources, the largest first", () => {
    expect(mixKeys({ "bonds-fr": 0.2, world: 0.8, us: 0 })).toEqual([
      "world",
      "bonds-fr",
    ]);
  });

  it("names the cash and the envelopes", () => {
    expect(trajectoryAccountKey("current")).toBe("futurePlan.accountCurrent");
    expect(trajectoryAccountKey("pea")).toBe("accounts.shortPea");
  });
});
