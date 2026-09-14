import { describe, expect, it } from "vitest";

import {
  WALLET_READS_PER_MONTH,
  citedDatums,
  decideWalletReadWrite,
  describeWalletReadFreshness,
  explainWalletReadRefusal,
  walletReadsRemaining,
} from "./wallet-read-budget";
import { factsDigest } from "./month-facts";
import { buildLookThroughFacts, type LookThroughFacts } from "./look-through-facts";
import { buildLookThrough } from "./look-through";
import { buildTargetAllocation } from "./look-through-target";
import { READING_VERSION, type InstrumentReading } from "./instrument-reading";
import type { MonthReadTally } from "./month-read-budget";

const NOW = "2026-09-14T12:00:00.000Z";
const WORLD = "FR001400U5Q4";

function reading(partial: Partial<InstrumentReading> = {}): InstrumentReading {
  return {
    isin: WORLD,
    ongoingCharge: 0.002,
    currency: "EUR",
    countryWeights: { US: 0.7, FR: 0.05 },
    sectorWeights: { "information-technology": 0.25 },
    topConstituents: [],
    constituentsCoverage: 0,
    sources: [],
    sourcedAt: NOW,
    model: null,
    version: READING_VERSION,
    ...partial,
  };
}

function facts(marketValue = 10000): LookThroughFacts {
  const lookThrough = buildLookThrough({
    positions: [
      {
        positionId: "p1",
        name: "World",
        walletId: "pea",
        isin: WORLD,
        marketValue,
        ongoingCharge: null,
      },
    ],
    readings: new Map([[WORLD, reading()]]),
    now: new Date(NOW),
  });
  return buildLookThroughFacts(
    lookThrough,
    buildTargetAllocation([
      { isin: WORLD, role: "core-world", wallet: "pea", weightClass: "lead" },
    ]),
    ["pea"],
  );
}

/** A portfolio with nothing in it: the thin case. */
function thinFacts(): LookThroughFacts {
  const lookThrough = buildLookThrough({
    positions: [],
    readings: new Map(),
    now: new Date(NOW),
  });
  return buildLookThroughFacts(lookThrough, buildTargetAllocation([]), []);
}

function tally(partial: Partial<MonthReadTally> = {}): MonthReadTally {
  return {
    writes: 0,
    refused: 0,
    lastWrittenAt: null,
    pendingSince: null,
    ...partial,
  };
}

function ask(overrides: Parameters<typeof decideWalletReadWrite>[0] | null = null) {
  return (
    overrides ?? {
      tally: tally(),
      facts: facts(),
      storedDigest: null,
      now: NOW,
      tracked: true,
    }
  );
}

describe("decideWalletReadWrite", () => {
  it("writes for a portfolio it can see, with the allowance untouched", () => {
    expect(decideWalletReadWrite(ask())).toEqual({ write: true });
  });

  /**
   * Checked first, and the reason is the same one `decideMonthReadWrite`
   * gives: a confident verdict on a portfolio the app cannot see is the worst
   * output this feature could produce.
   */
  it("refuses a portfolio there is nothing to say about", () => {
    const decision = decideWalletReadWrite({
      ...ask(),
      facts: thinFacts(),
    });
    expect(decision).toEqual({ write: false, reason: "nothing-to-say" });
  });

  it("refuses before the migration has been run", () => {
    const decision = decideWalletReadWrite({ ...ask(), tracked: false });
    expect(decision).toEqual({ write: false, reason: "untracked" });
  });

  it("refuses once the month's allowance is spent", () => {
    const decision = decideWalletReadWrite({
      ...ask(),
      tally: tally({ writes: WALLET_READS_PER_MONTH }),
    });
    expect(decision.write).toBe(false);
    if (decision.write) return;
    expect(decision.reason).toBe("allowance-spent");
  });

  it("refuses while a call is still in flight", () => {
    const decision = decideWalletReadWrite({
      ...ask(),
      tally: tally({ pendingSince: "2026-09-14T11:59:30.000Z" }),
    });
    expect(decision).toEqual({ write: false, reason: "in-flight" });
  });

  it("forgives a reservation nothing ever came back for", () => {
    const decision = decideWalletReadWrite({
      ...ask(),
      tally: tally({ pendingSince: "2026-09-14T11:00:00.000Z" }),
    });
    expect(decision).toEqual({ write: true });
  });

  it("refuses a second press within the cooldown", () => {
    const decision = decideWalletReadWrite({
      ...ask(),
      tally: tally({ lastWrittenAt: "2026-09-14T11:59:30.000Z" }),
    });
    expect(decision.write).toBe(false);
    if (decision.write) return;
    expect(decision.reason).toBe("cooling-down");
  });

  /**
   * The refusal that is this surface's own. A portfolio mostly sits still,
   * and spending an allowance to be told the same thing twice is worse than
   * saying so.
   */
  describe("when nothing has moved", () => {
    it("refuses a read of figures identical to the last one", () => {
      const pack = facts();
      const decision = decideWalletReadWrite({
        ...ask(),
        facts: pack,
        storedDigest: factsDigest(pack),
      });
      expect(decision).toEqual({ write: false, reason: "unchanged" });
    });

    it("writes once the figures have moved", () => {
      const before = facts(10000);
      const decision = decideWalletReadWrite({
        ...ask(),
        facts: facts(14000),
        storedDigest: factsDigest(before),
      });
      expect(decision).toEqual({ write: true });
    });

    it("writes when there is no stored read to compare against", () => {
      expect(
        decideWalletReadWrite({ ...ask(), storedDigest: null }),
      ).toEqual({ write: true });
    });

    it("says nothing-to-say rather than unchanged for an empty portfolio", () => {
      // Both are true; the first is the more useful thing to be told, and
      // "nothing has moved" would imply there had been something to move.
      const pack = thinFacts();
      const decision = decideWalletReadWrite({
        ...ask(),
        facts: pack,
        storedDigest: factsDigest(pack),
      });
      expect(decision).toEqual({ write: false, reason: "nothing-to-say" });
    });
  });
});

describe("walletReadsRemaining", () => {
  it("is the whole allowance before anything is spent", () => {
    expect(walletReadsRemaining(null)).toBe(WALLET_READS_PER_MONTH);
  });

  it("counts down", () => {
    expect(walletReadsRemaining(tally({ writes: 1 }))).toBe(
      WALLET_READS_PER_MONTH - 1,
    );
  });

  it("never goes below zero", () => {
    expect(walletReadsRemaining(tally({ writes: 99 }))).toBe(0);
  });
});

describe("explainWalletReadRefusal", () => {
  it("has words for every refusal", () => {
    const refusals = [
      { reason: "allowance-spent" as const, used: 4, allowance: 4 },
      { reason: "cooling-down" as const, retryAfterSeconds: 30 },
      { reason: "in-flight" as const },
      { reason: "nothing-to-say" as const },
      { reason: "unchanged" as const },
      { reason: "untracked" as const },
    ];
    for (const refusal of refusals) {
      const said = explainWalletReadRefusal(refusal);
      expect(said.length).toBeGreaterThan(0);
      // Never the raw key: an unresolved key reaching a reader is the failure
      // this assertion exists to catch.
      expect(said).not.toContain("walletRead.");
    }
  });

  it("says them in French too", () => {
    const said = explainWalletReadRefusal({ reason: "unchanged" }, "fr");
    expect(said).not.toContain("walletRead.");
    expect(said).toContain("bougé");
  });
});

describe("describeWalletReadFreshness", () => {
  const cited = ["invested-value"];

  it("is current while the cited figures stand still", () => {
    const pack = facts();
    const freshness = describeWalletReadFreshness({
      storedFacts: pack,
      currentFacts: pack,
      cited,
      readAt: NOW,
      now: NOW,
    });
    expect(freshness.standing).toBe("current");
    expect(freshness.moved).toEqual([]);
  });

  it("has moved once a cited figure has", () => {
    const freshness = describeWalletReadFreshness({
      storedFacts: facts(10000),
      currentFacts: facts(14000),
      cited,
      readAt: NOW,
      now: NOW,
    });
    expect(freshness.standing).toBe("moved");
    expect(freshness.moved[0]!.id).toBe("invested-value");
    expect(freshness.moved[0]!.was).toBe(10000);
    expect(freshness.moved[0]!.now).toBe(14000);
  });

  /** A figure nobody leaned on moving is not staleness, it is Tuesday. */
  it("ignores a figure the read never rested on", () => {
    const freshness = describeWalletReadFreshness({
      storedFacts: facts(10000),
      currentFacts: facts(14000),
      cited: ["us-share"],
      readAt: NOW,
      now: NOW,
    });
    expect(freshness.standing).toBe("current");
  });
});

describe("citedDatums", () => {
  it("gathers every id a read leans on, once each", () => {
    const cited = citedDatums({
      observations: [{ basis: ["us-share", "annual-cost"] }],
      suggestions: [{ basis: ["us-share"] }],
    });
    expect(new Set(cited)).toEqual(new Set(["us-share", "annual-cost"]));
    expect(cited).toHaveLength(2);
  });

  it("is empty for a read that cited nothing", () => {
    expect(citedDatums({ observations: [], suggestions: [] })).toEqual([]);
  });
});
