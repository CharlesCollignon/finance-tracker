import { describe, expect, it } from "vitest";

import { countryFlag, countryName } from "./country-names";

describe("countryName", () => {
  it("names a country in the reader's own language", () => {
    expect(countryName("US", "en")).toBe("United States");
    expect(countryName("US", "fr")).toBe("États-Unis");
  });

  it("accepts a lower-case code", () => {
    expect(countryName("fr", "en")).toBe("France");
  });

  it("hands back the code when it names no country", () => {
    // QQ is unassigned, so the weight behind it is real but unnameable. The
    // code itself says that; an empty label would lose the row.
    expect(countryName("QQ", "en")).toBe("QQ");
  });

  it("hands back the input when it is not a country code at all", () => {
    expect(countryName("other", "en")).toBe("other");
  });
});

describe("countryFlag", () => {
  it("builds the flag from the country's own code", () => {
    expect(countryFlag("US")).toBe("🇺🇸");
    expect(countryFlag("fr")).toBe("🇫🇷");
  });

  it("has no flag for something that is not a country code", () => {
    expect(countryFlag("other")).toBe(null);
  });

  /**
   * A factsheet's "Other" bucket, which arrives looking exactly like a
   * country code and is not one. Left as a row, because the weight behind it
   * is real — but given no flag, since 🇴🇹 renders as two letters in a box
   * and reads as a rendering fault rather than as "not a country".
   */
  it("has no flag for a two-letter code no country answers to", () => {
    expect(countryFlag("OT")).toBe(null);
    expect(countryFlag("QQ")).toBe(null);
  });

  it("still has one for a country the map is merely unfamiliar with", () => {
    expect(countryFlag("XK")).toBe("🇽🇰");
  });
});
