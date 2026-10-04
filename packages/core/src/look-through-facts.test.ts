import { describe, expect, it } from "vitest";

import { buildLookThrough } from "./look-through";
import { buildLookThroughFacts } from "./look-through-facts";
import { buildTargetAllocation } from "./look-through-target";
import { READING_VERSION, type InstrumentReading } from "./instrument-reading";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const WORLD = "IE00BK5BQT80";
const GOLD = "DE000A1EK0G3";

function reading(
  isin: string,
  partial: Partial<InstrumentReading> = {},
): InstrumentReading {
  return {
    isin,
    assetKind: "companies",
    ongoingCharge: 0.0022,
    currency: "EUR",
    countryWeights: { US: 0.65, FR: 0.05 },
    sectorWeights: { "information-technology": 0.28 },
    topConstituents: [],
    constituentsCoverage: 0,
    sources: [],
    sourcedAt: NOW.toISOString(),
    model: "fake",
    version: READING_VERSION,
    ...partial,
  };
}

function factsFor(withUnread = false) {
  const positions = [
    { isin: WORLD, walletId: "pea" as const, marketValue: 6000 },
    { isin: null, walletId: "crypto" as const, marketValue: 3000 },
    { isin: GOLD, walletId: "cto" as const, marketValue: 1000 },
    ...(withUnread
      ? [{ isin: "LU0000000001", walletId: "cto" as const, marketValue: 2000 }]
      : []),
  ].map((partial, index) => ({
    positionId: `p${index}`,
    name: `Position ${index}`,
    ongoingCharge: null,
    ...partial,
  }));
  const lookThrough = buildLookThrough({
    positions,
    readings: new Map([
      [WORLD, reading(WORLD)],
      [
        GOLD,
        reading(GOLD, {
          assetKind: "commodity",
          countryWeights: {},
          sectorWeights: {},
        }),
      ],
    ]),
    now: NOW,
  });
  return buildLookThroughFacts(lookThrough, buildTargetAllocation([]), ["pea"])
    .facts;
}

describe("buildLookThroughFacts, crypto and gold", () => {
  it("says what crypto and gold weigh in the whole portfolio", () => {
    const facts = factsFor();
    const value = (id: string) => facts.find((fact) => fact.id === id)?.value;

    expect(value("holding:equity")).toBeCloseTo(60);
    expect(value("holding:crypto")).toBeCloseTo(30);
    expect(value("holding:commodity")).toBeCloseTo(10);
  });

  it("does not count them as value the app could not read", () => {
    expect(factsFor().some((fact) => fact.id === "unclassified-share")).toBe(
      false,
    );

    const unseen = factsFor(true).find(
      (fact) => fact.id === "unclassified-share",
    );
    // The unread fund alone: 2,000 of 12,000.
    expect(unseen?.value).toBeCloseTo((2000 / 12000) * 100);
  });
});
