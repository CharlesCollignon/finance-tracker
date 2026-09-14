import { describe, expect, it } from "vitest";

import {
  READING_FRESH_DAYS,
  READING_VERSION,
  SECTOR_IDS,
  createFakeInstrumentReadingSource,
  instrumentReadingAnswerSchema,
  readingAgeDays,
  readingCompleteness,
  readingIsStale,
  readingQueue,
  verifyInstrumentReading,
  type InstrumentReading,
  type InstrumentReadingRequest,
} from "./instrument-reading";

const NOW = new Date("2026-09-14T12:00:00.000Z");

function asked(
  partial: Partial<InstrumentReadingRequest> = {},
): InstrumentReadingRequest {
  return {
    isin: "IE00B4L5Y983",
    name: "iShares Core MSCI World",
    symbol: "SWDA",
    ...partial,
  };
}

function answer(overrides: Record<string, unknown> = {}) {
  return {
    isin: "IE00B4L5Y983",
    ongoingCharge: 0.002,
    currency: "USD",
    countryWeights: { US: 0.71, JP: 0.06, GB: 0.04 },
    sectorWeights: { "information-technology": 0.25, financials: 0.16 },
    topConstituents: [
      { name: "Apple", weight: 0.05 },
      { name: "Microsoft", weight: 0.04 },
    ],
    sources: ["https://www.ishares.com/uk/individual/en/products/251882"],
    ...overrides,
  };
}

function reading(partial: Partial<InstrumentReading> = {}): InstrumentReading {
  return {
    isin: "IE00B4L5Y983",
    ongoingCharge: 0.002,
    currency: "USD",
    countryWeights: { US: 0.71 },
    sectorWeights: { "information-technology": 0.25 },
    topConstituents: [{ name: "Apple", weight: 0.05 }],
    constituentsCoverage: 0.05,
    sources: [],
    sourcedAt: NOW.toISOString(),
    model: "fake",
    version: READING_VERSION,
    ...partial,
  };
}

describe("instrumentReadingAnswerSchema", () => {
  it("accepts a well-formed answer", () => {
    expect(instrumentReadingAnswerSchema.safeParse(answer()).success).toBe(
      true,
    );
  });

  it("refuses country weights that add up to more than the fund", () => {
    const parsed = instrumentReadingAnswerSchema.safeParse(
      answer({ countryWeights: { US: 0.8, JP: 0.5 } }),
    );
    expect(parsed.success).toBe(false);
  });

  it("refuses a sector it does not have a name for", () => {
    const parsed = instrumentReadingAnswerSchema.safeParse(
      answer({ sectorWeights: { Technology: 0.3 } }),
    );
    expect(parsed.success).toBe(false);
  });

  it("refuses a charge above anything a real fund takes", () => {
    expect(
      instrumentReadingAnswerSchema.safeParse(answer({ ongoingCharge: 0.5 }))
        .success,
    ).toBe(false);
  });

  it("refuses a field it was not expecting", () => {
    expect(
      instrumentReadingAnswerSchema.safeParse(answer({ verdict: "buy" }))
        .success,
    ).toBe(false);
  });

  it("allows a sector the fund does not report", () => {
    // A strict output format declares all eleven sectors, so "not reported"
    // arrives as a null rather than as an absent key.
    const parsed = instrumentReadingAnswerSchema.safeParse(
      answer({ sectorWeights: { financials: 0.16, energy: null } }),
    );
    expect(parsed.success).toBe(true);
  });

  it("allows a charge that could not be found", () => {
    expect(
      instrumentReadingAnswerSchema.safeParse(answer({ ongoingCharge: null }))
        .success,
    ).toBe(true);
  });

  it("names every sector it accepts", () => {
    expect(SECTOR_IDS).toContain("information-technology");
    expect(new Set(SECTOR_IDS).size).toBe(SECTOR_IDS.length);
  });
});

describe("verifyInstrumentReading", () => {
  it("turns a good answer into a reading", () => {
    const verdict = verifyInstrumentReading(asked(), answer(), NOW, "opus");
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;

    expect(verdict.reading.isin).toBe("IE00B4L5Y983");
    expect(verdict.reading.ongoingCharge).toBe(0.002);
    expect(verdict.reading.model).toBe("opus");
    expect(verdict.reading.sourcedAt).toBe(NOW.toISOString());
    expect(verdict.reading.version).toBe(READING_VERSION);
  });

  /**
   * The failure that matters most. A search for one fund lands on its
   * sibling share class often enough to be routine, and a reading filed
   * under the wrong ISIN would be attributed to a fund it is not about.
   */
  it("refuses an answer about a different instrument", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({ isin: "IE00BK5BQT80" }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.reason).toBe("wrong-instrument");
  });

  it("is indifferent to case in the identifier", () => {
    const verdict = verifyInstrumentReading(
      asked({ isin: "ie00b4l5y983" }),
      answer(),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
  });

  it("refuses an answer that does not parse", () => {
    const verdict = verifyInstrumentReading(asked(), { nope: true }, NOW, null);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.reason).toBe("unparseable");
  });

  /**
   * An empty answer parses. Storing it would be worse than refusing it,
   * because a stored reading is one the queue stops asking about.
   */
  it("refuses an answer that says nothing", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({
        ongoingCharge: null,
        countryWeights: {},
        sectorWeights: {},
        topConstituents: [],
      }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.reason).toBe("nothing-useful");
  });

  it("keeps a reading that has a charge but no composition", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({ countryWeights: {}, sectorWeights: {}, topConstituents: [] }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.reading.constituentsCoverage).toBe(0);
  });

  it("drops a country code that is not one, rather than coercing it", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({ countryWeights: { US: 0.7, "United Kingdom": 0.04 } }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(Object.keys(verdict.reading.countryWeights)) .toEqual(["US"]);
  });

  it("normalises and merges country codes given in mixed case", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({ countryWeights: { us: 0.4, US: 0.3 } }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.reading.countryWeights.US).toBeCloseTo(0.7, 6);
  });

  it("drops a null sector rather than refusing the reading", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({ sectorWeights: { financials: 0.16, energy: null } }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.reading.sectorWeights).toEqual({ financials: 0.16 });
  });

  it("drops a zero weight instead of recording an absence as a presence", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({ countryWeights: { US: 0.7, FR: 0 } }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.reading.countryWeights).not.toHaveProperty("FR");
  });

  it("reports how much of the fund the constituents cover", () => {
    const verdict = verifyInstrumentReading(asked(), answer(), NOW, null);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    // 5% + 4%, and nothing pretends that is the whole fund.
    expect(verdict.reading.constituentsCoverage).toBeCloseTo(0.09, 6);
  });

  it("never reports coverage above the whole fund", () => {
    const verdict = verifyInstrumentReading(
      asked(),
      answer({
        topConstituents: Array.from({ length: 20 }, (_, index) => ({
          name: `Holding ${index}`,
          weight: 0.09,
        })),
      }),
      NOW,
      null,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.reading.constituentsCoverage).toBe(1);
  });
});

describe("readingAgeDays", () => {
  it("counts whole days since the reading was taken", () => {
    const old = reading({ sourcedAt: "2026-09-04T12:00:00.000Z" });
    expect(readingAgeDays(old, NOW)).toBe(10);
  });

  it("is zero for a reading taken now", () => {
    expect(readingAgeDays(reading(), NOW)).toBe(0);
  });

  it("never goes negative for a clock that disagrees", () => {
    const ahead = reading({ sourcedAt: "2027-01-01T00:00:00.000Z" });
    expect(readingAgeDays(ahead, NOW)).toBe(0);
  });

  it("treats an unreadable date as infinitely old", () => {
    expect(readingAgeDays(reading({ sourcedAt: "not a date" }), NOW)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("readingIsStale", () => {
  it("is fresh the day it is taken", () => {
    expect(readingIsStale(reading(), NOW)).toBe(false);
  });

  it("is fresh right up to the boundary", () => {
    const atBoundary = new Date(
      NOW.getTime() + READING_FRESH_DAYS * 86_400_000,
    );
    expect(readingIsStale(reading(), atBoundary)).toBe(false);
  });

  it("is stale one day past it", () => {
    const past = new Date(
      NOW.getTime() + (READING_FRESH_DAYS + 1) * 86_400_000,
    );
    expect(readingIsStale(reading(), past)).toBe(true);
  });

  it("is stale when it was taken under an older shape", () => {
    expect(readingIsStale(reading({ version: READING_VERSION - 1 }), NOW)).toBe(
      true,
    );
  });
});

describe("readingCompleteness", () => {
  it("is whole for a reading that answered everything", () => {
    expect(readingCompleteness(reading())).toBe(1);
  });

  it("is partial for a reading that only found a charge", () => {
    const thin = reading({
      countryWeights: {},
      sectorWeights: {},
      topConstituents: [],
    });
    expect(readingCompleteness(thin)).toBe(0.25);
  });
});

describe("readingQueue", () => {
  it("asks about an instrument never read before anything else", () => {
    const readings = new Map([["IE00B4L5Y983", reading()]]);
    const queue = readingQueue(
      ["IE00B4L5Y983", "FR0013412285"],
      readings,
      NOW,
    );
    expect(queue[0]).toBe("FR0013412285");
  });

  it("leaves a fresh, complete reading out of the queue entirely", () => {
    const readings = new Map([["IE00B4L5Y983", reading()]]);
    expect(readingQueue(["IE00B4L5Y983"], readings, NOW)).toEqual([]);
  });

  it("prefers the thinner of two stale readings", () => {
    const stale = new Date(
      NOW.getTime() + (READING_FRESH_DAYS + 1) * 86_400_000,
    );
    const readings = new Map([
      ["IE00B4L5Y983", reading()],
      [
        "FR0013412285",
        reading({
          isin: "FR0013412285",
          countryWeights: {},
          sectorWeights: {},
          topConstituents: [],
        }),
      ],
    ]);
    const queue = readingQueue(
      ["IE00B4L5Y983", "FR0013412285"],
      readings,
      stale,
    );
    expect(queue[0]).toBe("FR0013412285");
  });
});

describe("createFakeInstrumentReadingSource", () => {
  it("answers from its script and records the request", async () => {
    const source = createFakeInstrumentReadingSource({
      IE00B4L5Y983: answer(),
    });

    const result = await source.read(asked());
    expect(result).not.toBeNull();
    expect(source.calls).toHaveLength(1);
    expect(source.calls[0]!.isin).toBe("IE00B4L5Y983");
  });

  it("answers null for anything not in the script", async () => {
    const source = createFakeInstrumentReadingSource({});
    expect(await source.read(asked())).toBeNull();
  });
});
