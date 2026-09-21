import { describe, expect, it } from "vitest";

import {
  WORLD_EQUITY_REFERENCE,
  buildLookThrough,
  constituentKey,
  lookThroughIsThin,
  type LookThroughPosition,
} from "./look-through";
import {
  READING_VERSION,
  type InstrumentReading,
} from "./instrument-reading";

const NOW = new Date("2026-09-14T12:00:00.000Z");

function position(
  partial: Partial<LookThroughPosition> = {},
): LookThroughPosition {
  return {
    positionId: partial.positionId ?? "pos-1",
    name: "World",
    walletId: "pea",
    isin: "FR001400U5Q4",
    marketValue: 10000,
    ongoingCharge: null,
    ...partial,
  };
}

function reading(
  isin: string,
  partial: Partial<InstrumentReading> = {},
): InstrumentReading {
  return {
    isin,
    ongoingCharge: 0.002,
    currency: "EUR",
    countryWeights: { US: 0.7, JP: 0.06, FR: 0.03 },
    sectorWeights: { "information-technology": 0.25, financials: 0.15 },
    topConstituents: [],
    constituentsCoverage: 0,
    sources: [],
    sourcedAt: NOW.toISOString(),
    model: "fake",
    version: READING_VERSION,
    ...partial,
  };
}

function readings(...entries: InstrumentReading[]) {
  return new Map(entries.map((entry) => [entry.isin, entry]));
}

describe("buildLookThrough", () => {
  it("weights a single position by its fund's countries", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });

    const us = result.countries.find((row) => row.id === "US")!;
    // What the factsheet published, not a share of what it happened to
    // list: the fund is 70% United States and says so.
    expect(us.weight).toBeCloseTo(0.7, 6);
    expect(result.classifiedShare).toBe(1);
  });

  /**
   * The bug this replaced was worth a test of its own.
   *
   * An earlier version normalised each fund's weights to one before scaling
   * them. A real reading came back with three of eleven sectors, covering
   * 37% of the fund, and normalising reported a 25%-technology fund as
   * 69% technology — the headline finding of the surface, wrong by nearly
   * threefold and stated with complete confidence.
   */
  it("reports what was published rather than normalising a partial list", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(
        reading("FR001400U5Q4", {
          // A third of the fund, as a real search actually returned.
          sectorWeights: { "information-technology": 0.25, financials: 0.12 },
        }),
      ),
      now: NOW,
    });

    const tech = result.sectors.find(
      (row) => row.id === "information-technology",
    )!;
    expect(tech.weight).toBeCloseTo(0.25, 6);
    expect(result.sectorCoverage).toBeCloseTo(0.37, 6);

    // And it says so, rather than letting the figures imply completeness.
    // One caveat per axis: this fixture's countries are partial too.
    const caveat = result.caveats.find(
      (c) => c.kind === "partial-axis" && c.axis === "sector",
    );
    expect(caveat).toBeDefined();
    if (caveat?.kind !== "partial-axis") return;
    expect(caveat.coverage).toBeCloseTo(0.37, 6);
  });

  it("stays quiet about coverage when a factsheet was complete", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(
        reading("FR001400U5Q4", {
          countryWeights: { US: 0.71, JP: 0.06, GB: 0.04, FR: 0.03, DE: 0.02, CA: 0.03, CH: 0.03, AU: 0.02, NL: 0.01, SE: 0.05 },
          sectorWeights: { "information-technology": 0.25, financials: 0.16, "health-care": 0.12, industrials: 0.11, "consumer-discretionary": 0.1, "communication-services": 0.09, "consumer-staples": 0.06, energy: 0.04, materials: 0.03, utilities: 0.025, "real-estate": 0.02 },
        }),
      ),
      now: NOW,
    });
    expect(result.sectorCoverage).toBeGreaterThan(0.8);
    expect(result.caveats.some((c) => c.kind === "partial-axis")).toBe(false);
  });

  it("sorts countries by value, largest first", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });
    const values = result.countries.map((row) => row.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  /**
   * The honesty rule. An unread position is money the app cannot see, and
   * treating it as zero-weight everywhere would present a portfolio as
   * fully analysed when half of it is invisible.
   */
  describe("what it cannot see", () => {
    it("keeps unread value out of the weights and names it", () => {
      const result = buildLookThrough({
        positions: [
          position({ positionId: "known", marketValue: 6000 }),
          position({
            positionId: "unknown",
            name: "Mystery fund",
            isin: "LU1681038243",
            marketValue: 4000,
          }),
        ],
        readings: readings(reading("FR001400U5Q4")),
        now: NOW,
      });

      expect(result.totalValue).toBe(10000);
      expect(result.classifiedValue).toBe(6000);
      expect(result.unclassifiedValue).toBe(4000);
      expect(result.classifiedShare).toBeCloseTo(0.6, 6);
      expect(result.unclassifiedPositions.map((p) => p.name)).toEqual([
        "Mystery fund",
      ]);
      expect(result.unreadCount).toBe(1);

      // Weights are shares of the classified value, so the unread position
      // does not dilute them — and they add to what the factsheet reported,
      // not to one.
      const total = result.countries.reduce((sum, row) => sum + row.weight, 0);
      expect(total).toBeCloseTo(0.79, 6);
      expect(result.countryCoverage).toBeCloseTo(0.79, 6);
    });

    it("raises a caveat naming the share it could not resolve", () => {
      const result = buildLookThrough({
        positions: [
          position({ positionId: "known", marketValue: 6000 }),
          position({
            positionId: "unknown",
            isin: "LU1681038243",
            marketValue: 4000,
          }),
        ],
        readings: readings(reading("FR001400U5Q4")),
        now: NOW,
      });

      const caveat = result.caveats.find((c) => c.kind === "unclassified");
      expect(caveat).toBeDefined();
      if (caveat?.kind !== "unclassified") return;
      expect(caveat.share).toBeCloseTo(0.4, 6);
      expect(caveat.positionCount).toBe(1);
    });

    it("counts a position with no identifier apart from an unread one", () => {
      const result = buildLookThrough({
        positions: [position({ isin: null })],
        readings: new Map(),
        now: NOW,
      });
      expect(result.unidentifiedCount).toBe(1);
      expect(result.unreadCount).toBe(0);
    });

    it("ignores a position worth nothing entirely", () => {
      const result = buildLookThrough({
        positions: [position(), position({ positionId: "empty", marketValue: 0 })],
        readings: readings(reading("FR001400U5Q4")),
        now: NOW,
      });
      expect(result.totalValue).toBe(10000);
      expect(result.unclassifiedPositions).toEqual([]);
    });

    it("survives an empty portfolio without dividing by zero", () => {
      const result = buildLookThrough({
        positions: [],
        readings: new Map(),
        now: NOW,
      });
      expect(result.totalValue).toBe(0);
      expect(result.classifiedShare).toBe(0);
      expect(result.countries).toEqual([]);
      expect(result.caveats.some((c) => c.kind === "no-market-value")).toBe(
        true,
      );
      expect(lookThroughIsThin(result)).toBe(true);
    });
  });

  describe("home bias", () => {
    it("states each region as a share and as a multiple of the market", () => {
      const result = buildLookThrough({
        positions: [position()],
        readings: readings(
          reading("FR001400U5Q4", { countryWeights: { FR: 0.3, US: 0.7 } }),
        ),
        now: NOW,
      });

      expect(result.regions.france).toBeCloseTo(0.3, 6);
      expect(result.regions.unitedStates).toBeCloseTo(0.7, 6);
      // The claim worth making is the factor, not the percentage point gap.
      expect(result.regionBias.france).toBeCloseTo(
        0.3 / WORLD_EQUITY_REFERENCE.france,
        4,
      );
    });

    it("counts the eurozone and wider Europe separately", () => {
      const result = buildLookThrough({
        positions: [position()],
        readings: readings(
          reading("FR001400U5Q4", {
            countryWeights: { FR: 0.25, DE: 0.25, GB: 0.25, US: 0.25 },
          }),
        ),
        now: NOW,
      });

      expect(result.regions.eurozone).toBeCloseTo(0.5, 6);
      // Great Britain is Europe but not the eurozone.
      expect(result.regions.europe).toBeCloseTo(0.75, 6);
    });

    it("reports no bias rather than a wrong one when nothing is classified", () => {
      const result = buildLookThrough({
        positions: [position({ isin: null })],
        readings: new Map(),
        now: NOW,
      });
      expect(result.regions.france).toBe(0);
      expect(result.regionBias.france).toBe(0);
    });
  });

  /**
   * The case that decides how overlap is presented.
   *
   * A world tracker and an S&P 500 tracker are roughly seventy per cent the
   * same bet. Their published top tens are nearly the same names, but the
   * world fund's top ten is about a fifth of it while the S&P's is about a
   * third — so intersecting the two scores about twenty per cent. "At least
   * 20% overlap" is true and reads as "that is fine", which is the opposite
   * of the truth. The index relationship says the real thing with no weights
   * at all, so it is the headline and the floor is a footnote.
   */
  describe("overlap", () => {
    const worldTop = [
      { name: "Apple Inc.", weight: 0.05 },
      { name: "Microsoft Corp", weight: 0.045 },
      { name: "NVIDIA Corporation", weight: 0.04 },
    ];
    const spTop = [
      { name: "Apple", weight: 0.075 },
      { name: "Microsoft", weight: 0.07 },
      { name: "NVIDIA", weight: 0.065 },
    ];

    const pair = () => ({
      positions: [
        position({ positionId: "world", name: "MSCI World", isin: "FR001400U5Q4" }),
        position({ positionId: "sp", name: "S&P 500", isin: "FR0013412285" }),
      ],
      readings: readings(
        reading("FR001400U5Q4", {
          topConstituents: worldTop,
          constituentsCoverage: 0.22,
        }),
        reading("FR0013412285", {
          isin: "FR0013412285",
          topConstituents: spTop,
          constituentsCoverage: 0.35,
        }),
      ),
      now: NOW,
    });

    it("names the index relationship as the finding", () => {
      const result = buildLookThrough(pair());
      expect(result.indexCollisions).toHaveLength(1);

      const collision = result.indexCollisions[0]!;
      expect(collision.indexes).toEqual(["MSCI World", "S&P 500"]);
      // Not the same index — one contains the other.
      expect(collision.identical).toBe(false);
      expect(collision.combinedWeight).toBeCloseTo(1, 6);
    });

    it("reports the constituent figure as a floor well under the truth", () => {
      const result = buildLookThrough(pair());
      expect(result.constituentOverlaps).toHaveLength(1);

      const overlap = result.constituentOverlaps[0]!;
      // min(0.05,0.075) + min(0.045,0.07) + min(0.04,0.065)
      expect(overlap.floor).toBeCloseTo(0.135, 6);
      // Which is nowhere near the ~0.70 these two really share. The coverage
      // is carried precisely so a reader can see how loose that is.
      expect(overlap.coverage).toEqual([0.22, 0.35]);
      expect(overlap.sharedNames).toHaveLength(3);
    });

    it("always says the floor is a floor", () => {
      const result = buildLookThrough(pair());
      expect(
        result.caveats.some((c) => c.kind === "overlap-is-a-floor"),
      ).toBe(true);
    });

    it("matches the same company written three different ways", () => {
      const result = buildLookThrough(pair());
      expect(result.constituentOverlaps[0]!.sharedNames).toContain(
        "Apple Inc.",
      );
    });

    it("sees two funds on the very same index", () => {
      const result = buildLookThrough({
        positions: [
          position({ positionId: "a", isin: "FR001400U5Q4" }),
          position({ positionId: "b", isin: "IE0002XZSHO1" }),
        ],
        readings: readings(
          reading("FR001400U5Q4"),
          reading("IE0002XZSHO1", { isin: "IE0002XZSHO1" }),
        ),
        now: NOW,
      });
      expect(result.indexCollisions[0]!.identical).toBe(true);
    });

    it("leaves genuinely different exposures alone", () => {
      const result = buildLookThrough({
        positions: [
          position({ positionId: "eu", isin: "FR0011550193" }),
          position({ positionId: "em", isin: "FR0013412020" }),
        ],
        readings: readings(
          reading("FR0011550193", { isin: "FR0011550193" }),
          reading("FR0013412020", { isin: "FR0013412020" }),
        ),
        now: NOW,
      });
      expect(result.indexCollisions).toEqual([]);
      expect(result.constituentOverlaps).toEqual([]);
    });

    it("finds no pair in a portfolio of one", () => {
      const result = buildLookThrough({
        positions: [position()],
        readings: readings(reading("FR001400U5Q4")),
        now: NOW,
      });
      expect(result.indexCollisions).toEqual([]);
      expect(result.constituentOverlaps).toEqual([]);
    });

    it("says nothing about overlap when constituents were never read", () => {
      const result = buildLookThrough({
        positions: [
          position({ positionId: "world", isin: "FR001400U5Q4" }),
          position({ positionId: "sp", isin: "FR0013412285" }),
        ],
        readings: readings(
          reading("FR001400U5Q4"),
          reading("FR0013412285", { isin: "FR0013412285" }),
        ),
        now: NOW,
      });
      // The index collision still stands, which is the point of having it.
      expect(result.indexCollisions).toHaveLength(1);
      expect(result.constituentOverlaps).toEqual([]);
      expect(
        result.caveats.some((c) => c.kind === "overlap-is-a-floor"),
      ).toBe(false);
    });
  });

  describe("wrapper eligibility", () => {
    it("flags a fund held somewhere it may not sit", () => {
      const result = buildLookThrough({
        // SWDA is physically replicated, so it cannot go in a PEA.
        positions: [position({ isin: "IE00B4L5Y983", walletId: "pea" })],
        readings: readings(reading("IE00B4L5Y983")),
        now: NOW,
      });

      expect(result.eligibility).toHaveLength(1);
      expect(result.eligibility[0]!.isin).toBe("IE00B4L5Y983");
      expect(result.eligibility[0]!.allowedIn).toContain("cto");
      expect(result.eligibility[0]!.allowedIn).not.toContain("pea");
    });

    it("says nothing about the same fund held in a CTO", () => {
      const result = buildLookThrough({
        positions: [position({ isin: "IE00B4L5Y983", walletId: "cto" })],
        readings: readings(reading("IE00B4L5Y983")),
        now: NOW,
      });
      expect(result.eligibility).toEqual([]);
    });

    it("stays quiet about an instrument it does not catalogue", () => {
      const result = buildLookThrough({
        positions: [position({ isin: "XX0000000000", walletId: "pea" })],
        readings: readings(reading("XX0000000000")),
        now: NOW,
      });
      // No entry means no claim, not a claim of ineligibility.
      expect(result.eligibility).toEqual([]);
    });
  });

  describe("charges", () => {
    /**
     * A figure the owner typed off a KID outranks one a search inferred.
     *
     * The opposite order was the first draft, on the reasoning that a reading
     * is newer. But silently replacing deliberate input with a scraped
     * approximation is the same class of mistake as reading a typed 0 as
     * "worth nothing" — a reading fills gaps, it does not correct the owner.
     */
    it("prefers the charge typed on the position over a reading's", () => {
      const result = buildLookThrough({
        positions: [position({ ongoingCharge: 0.009 })],
        readings: readings(
          reading("FR001400U5Q4", { ongoingCharge: 0.002 }),
        ),
        now: NOW,
      });
      expect(result.charges.weightedAverage).toBeCloseTo(0.009, 6);
    });

    it("uses a reading's charge where nothing was typed", () => {
      const result = buildLookThrough({
        positions: [position({ ongoingCharge: null })],
        readings: readings(
          reading("FR001400U5Q4", { ongoingCharge: 0.0031 }),
        ),
        now: NOW,
      });
      expect(result.charges.weightedAverage).toBeCloseTo(0.0031, 6);
    });

    it("falls back to the catalogue's hint when nothing else exists", () => {
      const typed = buildLookThrough({
        positions: [position({ ongoingCharge: 0.005 })],
        readings: new Map(),
        now: NOW,
      });
      expect(typed.charges.weightedAverage).toBeCloseTo(0.005, 6);

      const hinted = buildLookThrough({
        positions: [position({ ongoingCharge: null })],
        readings: new Map(),
        now: NOW,
      });
      // DCAM's hinted charge, used because nothing better exists yet.
      expect(hinted.charges.weightedAverage).toBeCloseTo(0.002, 6);
    });

    it("adds the envelope fee for the wrapper the position sits in", () => {
      const result = buildLookThrough({
        positions: [position({ walletId: "av" })],
        readings: readings(reading("FR001400U5Q4")),
        envelopeFees: { av: 0.006 },
        now: NOW,
      });
      expect(result.charges.weightedAverage).toBeCloseTo(0.002, 6);
      expect(result.charges.weightedAllIn).toBeCloseTo(0.008, 6);
    });
  });

  describe("stale readings", () => {
    it("still uses an old reading but says how old it is", () => {
      const later = new Date("2027-09-14T12:00:00.000Z");
      const result = buildLookThrough({
        positions: [position()],
        readings: readings(reading("FR001400U5Q4")),
        now: later,
      });

      // Used: the weights are there.
      expect(result.countries.length).toBeGreaterThan(0);
      expect(result.staleReadingCount).toBe(1);

      const caveat = result.caveats.find((c) => c.kind === "stale-readings");
      expect(caveat).toBeDefined();
      if (caveat?.kind !== "stale-readings") return;
      expect(caveat.oldestDays).toBe(365);
    });
  });

  it("says geography is not currency whenever it shows a geography", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });
    expect(
      result.caveats.some((c) => c.kind === "geography-is-not-currency"),
    ).toBe(true);
  });
});

describe("constituentKey", () => {
  it("reduces the same company written differently to one key", () => {
    expect(constituentKey("Apple Inc.")).toBe(constituentKey("APPLE INC"));
    expect(constituentKey("Apple Inc.")).toBe(constituentKey("Apple"));
    expect(constituentKey("Microsoft Corporation")).toBe(
      constituentKey("Microsoft Corp"),
    );
    expect(constituentKey("Nestlé S.A.")).toBe(constituentKey("Nestle SA"));
  });

  /**
   * The app reads European factsheets, so accents are routine and the two
   * spellings of the same holding must land on one key. Folding, not
   * stripping: stripping turns "Nestlé" into "nestl" and matches nothing.
   */
  it("folds accents rather than dropping the letter", () => {
    expect(constituentKey("Société Générale")).toBe(
      constituentKey("Societe Generale"),
    );
    expect(constituentKey("L'Oréal")).toBe(constituentKey("LOreal"));
    expect(constituentKey("Anheuser-Busch InBev")).toBe(
      constituentKey("Anheuser-Busch Inbev"),
    );
  });

  it("reads a dotted abbreviation as one token", () => {
    expect(constituentKey("Iberdrola S.A.")).toBe("iberdrola");
    expect(constituentKey("A.O. Smith")).toBe(constituentKey("AO Smith"));
  });

  it("ignores share-class markers", () => {
    expect(constituentKey("Alphabet Class A")).toBe(
      constituentKey("Alphabet Class C"),
    );
  });

  it("keeps genuinely different companies apart", () => {
    expect(constituentKey("Apple")).not.toBe(constituentKey("Applied Materials"));
    expect(constituentKey("Bank of America")).not.toBe(
      constituentKey("Bank of Montreal"),
    );
  });

  it("never strips a name down to nothing", () => {
    // "Holdings" is a suffix, but it is all there is here.
    expect(constituentKey("Holdings")).not.toBe("");
  });
});

describe("lookThroughIsThin", () => {
  it("is thin when nothing could be classified", () => {
    const result = buildLookThrough({
      positions: [position({ isin: null })],
      readings: new Map(),
      now: NOW,
    });
    expect(lookThroughIsThin(result)).toBe(true);
  });

  it("is not thin once one position resolves", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });
    expect(lookThroughIsThin(result)).toBe(false);
  });
});

describe("crypto holdings", () => {
  const bitcoin = position({
    positionId: "pos-btc",
    name: "Bitcoin",
    walletId: "crypto",
    isin: null,
    marketValue: 2400,
  });

  it("does not count a crypto holding as one waiting for an ISIN", () => {
    const result = buildLookThrough({
      positions: [position(), bitcoin],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });

    // A share with no ISIN recorded is a gap the reader can close from the
    // instrument search. A coin has no ISIN to find, so counting it here
    // sends them looking for something that does not exist.
    expect(result.unidentifiedCount).toBe(0);
  });

  it("still counts a non-crypto holding with no ISIN", () => {
    const result = buildLookThrough({
      positions: [position({ positionId: "pos-2", isin: null })],
      readings: readings(),
      now: NOW,
    });

    expect(result.unidentifiedCount).toBe(1);
  });

  it("names the crypto holdings and what they are worth", () => {
    const result = buildLookThrough({
      positions: [position(), bitcoin],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });

    expect(result.cryptoPositions).toEqual([
      { positionId: "pos-btc", name: "Bitcoin", value: 2400 },
    ]);
  });

  it("says out loud that crypto has nothing to look through to", () => {
    const result = buildLookThrough({
      positions: [position(), bitcoin],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });

    expect(result.caveats).toContainEqual({
      kind: "crypto",
      positionCount: 1,
      value: 2400,
    });
  });

  it("says nothing about crypto when none is held", () => {
    const result = buildLookThrough({
      positions: [position()],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });

    expect(result.caveats.map((caveat) => caveat.kind)).not.toContain("crypto");
    expect(result.cryptoPositions).toEqual([]);
  });

  it("leaves the read coverage alone, because a coin is still unread value", () => {
    const result = buildLookThrough({
      positions: [position(), bitcoin],
      readings: readings(reading("FR001400U5Q4")),
      now: NOW,
    });

    expect(result.classifiedValue).toBe(10000);
    expect(result.unclassifiedValue).toBe(2400);
  });
});
