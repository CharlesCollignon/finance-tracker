import { describe, expect, it } from "vitest";

import {
  ilikeWords,
  matchesNeedle,
  searchNeedle,
  searchesEveryMonth,
} from "./ledger-search";

describe("searchNeedle", () => {
  it("is null for nothing typed", () => {
    expect(searchNeedle("   ")).toBeNull();
  });

  it("reads an amount typed the French way", () => {
    expect(searchNeedle(" 12,30 ")).toEqual({ text: "12,30", amount: 12.3 });
  });

  it("keeps words as words", () => {
    expect(searchNeedle("Carrefour")).toEqual({
      text: "carrefour",
      amount: null,
    });
  });
});

describe("matchesNeedle", () => {
  it("finds a word in any field, ignoring case", () => {
    const needle = searchNeedle("carre")!;
    expect(matchesNeedle(needle, ["Courses", "CB CARREFOUR"], 12)).toBe(true);
    expect(matchesNeedle(needle, ["Courses", "LIDL"], 12)).toBe(false);
  });

  it("finds the rows of an amount", () => {
    const needle = searchNeedle("12,30")!;
    expect(matchesNeedle(needle, ["Courses", "LIDL"], 12.3)).toBe(true);
    expect(matchesNeedle(needle, ["Courses", "LIDL"], 12.31)).toBe(false);
  });
});

describe("searchesEveryMonth", () => {
  it("waits for two letters, or an amount", () => {
    expect(searchesEveryMonth(searchNeedle("c"))).toBe(false);
    expect(searchesEveryMonth(searchNeedle("ca"))).toBe(true);
    expect(searchesEveryMonth(searchNeedle("9"))).toBe(true);
    expect(searchesEveryMonth(null)).toBe(false);
  });
});

describe("ilikeWords", () => {
  it("drops what the filter syntax reserves and escapes the wildcards", () => {
    expect(ilikeWords('vir (m. "x"), 50%')).toBe("vir m. x 50\\%");
  });
});
