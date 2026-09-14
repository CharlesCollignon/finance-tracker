import { describe, expect, it } from "vitest";

import {
  canSearchInstruments,
  isIsinQuery,
  isValidInstrumentSymbol,
  normalizeInstrumentQuery,
} from "./yahoo";

/**
 * Which queries reach Yahoo.
 *
 * The gate exists to swallow a half-typed ISIN, which matches nothing and
 * spends a request against an endpoint that rate-limits by IP. It had been
 * swallowing ordinary names too — every holding whose name is one short word
 * searched as if the instrument did not exist, which is how a portfolio ends
 * up with no identifiers on it.
 */

describe("canSearchInstruments", () => {
  it("accepts a complete ISIN", () => {
    expect(canSearchInstruments("IE00B4L5Y983")).toBe(true);
    expect(canSearchInstruments("ie00b4l5y983")).toBe(true);
    expect(canSearchInstruments("FR0010315770")).toBe(true);
  });

  it("refuses a half-typed ISIN", () => {
    expect(canSearchInstruments("IE00")).toBe(false);
    expect(canSearchInstruments("IE00B4L5")).toBe(false);
    expect(canSearchInstruments("FR001031")).toBe(false);
  });

  it("accepts short company names that are all letters", () => {
    for (const name of ["NVIDIA", "Intel", "Alphabet", "Meta", "Amundi"]) {
      expect(canSearchInstruments(name), name).toBe(true);
    }
  });

  it("accepts a long fund name with spaces", () => {
    expect(
      canSearchInstruments("iShares MSCI Europe Information Technology Sector"),
    ).toBe(true);
    expect(
      canSearchInstruments(
        "Multi Units Luxembourg - Amundi STOXX Europe 600 Banks UCITS ETF Acc",
      ),
    ).toBe(true);
  });

  it("still refuses what is too short or absurdly long", () => {
    expect(canSearchInstruments("")).toBe(false);
    expect(canSearchInstruments("a")).toBe(false);
    expect(canSearchInstruments("x".repeat(121))).toBe(false);
  });
});

describe("isIsinQuery", () => {
  it("is true only for the full twelve-character shape", () => {
    expect(isIsinQuery("IE00B4L5Y983")).toBe(true);
    expect(isIsinQuery(" ie00b4l5y983 ")).toBe(true);
    expect(isIsinQuery("IE00B4L5Y98")).toBe(false);
    // The last character has to be the check digit.
    expect(isIsinQuery("IE00B4L5Y98X")).toBe(false);
  });
});

describe("normalizeInstrumentQuery", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeInstrumentQuery(" ie00 b4l5 y983 ")).toBe("IE00B4L5Y983");
  });
});

describe("isValidInstrumentSymbol", () => {
  it("accepts the shapes the market uses", () => {
    for (const symbol of ["CW8.PA", "IWDA.AS", "BTC-EUR", "EURUSD=X", "NVDA"]) {
      expect(isValidInstrumentSymbol(symbol), symbol).toBe(true);
    }
  });

  it("refuses anything that could not be one", () => {
    expect(isValidInstrumentSymbol("")).toBe(false);
    expect(isValidInstrumentSymbol("../etc/passwd")).toBe(false);
    expect(isValidInstrumentSymbol("a b")).toBe(false);
  });
});
