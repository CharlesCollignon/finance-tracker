import { describe, expect, it } from "vitest";
import type { Envelope } from "../future-plan";
import {
  accountOdds,
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
    expect(taxAtHorizon({ result, accounts, envelopes })).toBeCloseTo(
      (3_000 - 1_000 - 1_200) * 0.3,
      6,
    );
  });

  it("never taxes a loss", () => {
    expect(
      taxAtHorizon({
        result: { ...result, accounts: [{ id: "pea", median: 900 }] },
        accounts,
        envelopes,
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
