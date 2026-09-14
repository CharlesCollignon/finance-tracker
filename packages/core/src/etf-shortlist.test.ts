import { describe, expect, it } from "vitest";

import {
  ETF_SHORTLIST,
  INDEX_FAMILY_CONTAINS,
  SHORTLIST_ISINS,
  indexesOverlap,
  looksLikeIsin,
  shortlistEntry,
  shortlistForWrapper,
  type IndexFamily,
} from "./etf-shortlist";
import { INVESTMENT_WALLET_IDS } from "./investments";

const ENTRIES = Object.values(ETF_SHORTLIST);

/**
 * The catalogue is a closed vocabulary that a verifier trusts, so its own
 * shape has to be beyond doubt. These are the assertions that would have
 * caught a fabricated identifier or a fund filed in a wrapper it cannot
 * legally sit in — the two mistakes here that would reach a screen looking
 * like a fact.
 */
describe("ETF_SHORTLIST", () => {
  it("is not empty", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it("is keyed by the ISIN it carries", () => {
    for (const [key, entry] of Object.entries(ETF_SHORTLIST)) {
      expect(key).toBe(entry.isin);
    }
  });

  it("holds nothing that is not shaped like an ISIN", () => {
    for (const entry of ENTRIES) {
      expect(looksLikeIsin(entry.isin)).toBe(true);
    }
  });

  it("lists every instrument exactly once", () => {
    expect(new Set(SHORTLIST_ISINS).size).toBe(SHORTLIST_ISINS.length);
  });

  it("agrees with its own index", () => {
    expect(SHORTLIST_ISINS.length).toBe(ENTRIES.length);
  });

  it("names every fund and gives it a symbol", () => {
    for (const entry of ENTRIES) {
      expect(entry.name.trim()).not.toBe("");
      expect(entry.symbol.trim()).not.toBe("");
    }
  });

  it("domiciles every fund in a two-letter country", () => {
    for (const entry of ENTRIES) {
      expect(entry.domicile).toMatch(/^[A-Z]{2}$/);
      // The ISIN's prefix is a registration authority, not a domicile, so
      // the two may legitimately differ — but not for anything held here.
      expect(entry.isin.slice(0, 2)).toBe(entry.domicile);
    }
  });

  it("offers every fund to at least one wrapper it could sit in", () => {
    for (const entry of ENTRIES) {
      expect(entry.wrappers.length).toBeGreaterThan(0);
      for (const wallet of entry.wrappers) {
        expect(INVESTMENT_WALLET_IDS).toContain(wallet);
      }
    }
  });

  it("never offers an equity fund to the crypto wallet", () => {
    for (const entry of ENTRIES) {
      expect(entry.wrappers).not.toContain("crypto");
    }
  });

  /**
   * The rule that is easy to get backwards.
   *
   * A PEA may only hold funds that are at least three-quarters European
   * equity. A fund tracking a world or American index therefore qualifies
   * only by holding European shares and swapping their return — so every
   * PEA-eligible entry outside Europe must be synthetic, and a physically
   * replicated world tracker must be excluded however cheap it is.
   *
   * Both cases are in the catalogue on purpose: WPEA is Irish and eligible,
   * SWDA is Irish and is not. Domicile alone decides nothing.
   */
  describe("PEA eligibility", () => {
    const peaEligible = ENTRIES.filter((entry) =>
      entry.wrappers.includes("pea"),
    );

    it("has some", () => {
      expect(peaEligible.length).toBeGreaterThan(0);
    });

    it("only admits UCITS funds domiciled in the EU or EEA", () => {
      const EU_EEA = new Set([
        "FR", "LU", "IE", "DE", "NL", "BE", "ES", "IT", "PT", "AT",
        "FI", "SE", "DK", "PL", "CZ", "NO", "IS", "LI",
      ]);
      for (const entry of peaEligible) {
        expect(entry.ucits).toBe(true);
        expect(EU_EEA.has(entry.domicile)).toBe(true);
      }
    });

    it("requires synthetic replication for a non-European index", () => {
      for (const entry of peaEligible) {
        if (entry.indexFamily === "europe") {
          continue;
        }
        expect(entry.replication).toBe("synthetic");
      }
    });

    it("keeps a physically replicated world tracker out of the PEA", () => {
      const physicalWorld = ENTRIES.filter(
        (entry) =>
          entry.replication === "physical" &&
          entry.indexFamily !== "europe" &&
          entry.assetClass === "equity",
      );
      expect(physicalWorld.length).toBeGreaterThan(0);
      for (const entry of physicalWorld) {
        expect(entry.wrappers).not.toContain("pea");
      }
    });
  });

  describe("charge hints", () => {
    it("stays inside the range a real tracker charges", () => {
      for (const entry of ENTRIES) {
        if (entry.terHint === null) {
          continue;
        }
        expect(entry.terHint.charge).toBeGreaterThan(0);
        // Above 1% a year is not a tracker; it is a mistyped percentage.
        expect(entry.terHint.charge).toBeLessThanOrEqual(0.01);
      }
    });

    it("dates every hint it gives, so staleness is visible", () => {
      for (const entry of ENTRIES) {
        if (entry.terHint === null) {
          continue;
        }
        expect(entry.terHint.hintedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("allows an unknown charge rather than inviting a guess", () => {
      // Not a property of the data so much as of the schema: an entry whose
      // charge was never confirmed must be expressible.
      expect(
        ENTRIES.some((entry) => entry.terHint === null),
      ).toBe(true);
    });
  });
});

describe("shortlistEntry", () => {
  it("finds an instrument by its ISIN", () => {
    const entry = shortlistEntry("IE00B4L5Y983");
    expect(entry?.symbol).toBe("SWDA");
  });

  it("is indifferent to case and surrounding space", () => {
    expect(shortlistEntry("  ie00b4l5y983 ")?.symbol).toBe("SWDA");
  });

  it("answers null for an instrument it has never heard of", () => {
    // The whole point: an ISIN a model invented resolves to nothing, and the
    // caller treats nothing as fatal rather than rendering it.
    expect(shortlistEntry("XX0000000000")).toBeNull();
  });
});

describe("shortlistForWrapper", () => {
  it("offers only what may be held there", () => {
    for (const entry of shortlistForWrapper("pea")) {
      expect(entry.wrappers).toContain("pea");
    }
  });

  it("offers the cheapest hinted charge first", () => {
    const charges = shortlistForWrapper("cto").map(
      (entry) => entry.terHint?.charge ?? Number.POSITIVE_INFINITY,
    );
    expect(charges).toEqual([...charges].sort((a, b) => a - b));
  });

  it("puts an unknown charge last rather than treating it as free", () => {
    const forCto = shortlistForWrapper("cto");
    const unknownAt = forCto.findIndex((entry) => entry.terHint === null);
    if (unknownAt >= 0) {
      expect(unknownAt).toBe(forCto.length - 1);
    }
  });

  it("offers nothing for the crypto wallet", () => {
    expect(shortlistForWrapper("crypto")).toEqual([]);
  });
});

describe("indexesOverlap", () => {
  const world = shortlistEntry("FR001400U5Q4")!; // MSCI World
  const sp500 = shortlistEntry("FR0013412285")!; // S&P 500
  const nasdaq = shortlistEntry("LU1681038243")!; // Nasdaq-100
  const europe = shortlistEntry("FR0011550193")!; // STOXX Europe 600
  const emerging = shortlistEntry("FR0013412020")!; // MSCI EM
  const cw8 = shortlistEntry("LU1681043599")!; // also MSCI World

  it("sees two funds tracking the same index", () => {
    expect(indexesOverlap(world, cw8)).toBe(true);
  });

  /**
   * The case that motivates the whole approach. A world tracker and an
   * S&P 500 tracker are roughly seventy per cent the same bet, but their
   * published top tens intersect to about twenty per cent of weight — so a
   * constituent floor would report "at least 20%" and be read as "fine".
   * The containment relation says the true thing without any weights.
   */
  it("sees a narrower index sitting inside a broader one", () => {
    expect(indexesOverlap(world, sp500)).toBe(true);
    expect(indexesOverlap(sp500, world)).toBe(true);
  });

  it("sees it through two levels of nesting", () => {
    expect(indexesOverlap(world, nasdaq)).toBe(true);
    expect(indexesOverlap(sp500, nasdaq)).toBe(true);
  });

  it("leaves genuinely different exposures alone", () => {
    expect(indexesOverlap(europe, emerging)).toBe(false);
    expect(indexesOverlap(sp500, emerging)).toBe(false);
  });

  it("does not accuse a fund of overlapping itself", () => {
    expect(indexesOverlap(world, world)).toBe(false);
  });

  it("is symmetric", () => {
    for (const left of ENTRIES) {
      for (const right of ENTRIES) {
        expect(indexesOverlap(left, right)).toBe(indexesOverlap(right, left));
      }
    }
  });
});

describe("INDEX_FAMILY_CONTAINS", () => {
  it("names a known family on both sides of every relation", () => {
    const families = Object.keys(INDEX_FAMILY_CONTAINS) as IndexFamily[];
    for (const [family, contained] of Object.entries(INDEX_FAMILY_CONTAINS)) {
      expect(families).toContain(family as IndexFamily);
      for (const inner of contained) {
        expect(families).toContain(inner);
      }
    }
  });

  it("resolves the family of every catalogued fund", () => {
    for (const entry of ENTRIES) {
      expect(INDEX_FAMILY_CONTAINS).toHaveProperty(entry.indexFamily);
    }
  });

  it("never contains itself", () => {
    for (const [family, contained] of Object.entries(INDEX_FAMILY_CONTAINS)) {
      expect(contained).not.toContain(family as IndexFamily);
    }
  });
});
