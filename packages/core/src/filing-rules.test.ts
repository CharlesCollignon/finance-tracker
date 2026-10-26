import { describe, expect, it } from "vitest";
import {
  findFilingRule,
  normalizeRuleWords,
  ruleMatches,
  suggestRuleWords,
} from "./filing-rules";

const navigo = {
  id: "r1",
  words: "Navigo",
  categoryId: "c-transport",
  categoryName: "Transports",
  direction: "out" as const,
  appliedCount: 0,
  createdFrom: null,
};

describe("normalizeRuleWords", () => {
  it("drops case, accents and punctuation, and squeezes spaces", () => {
    expect(normalizeRuleWords("  Café  Joyeux, Paris! ")).toBe(
      "cafe joyeux paris",
    );
  });
});

describe("ruleMatches", () => {
  it("finds the words whole in the line, whatever the bank's spelling", () => {
    expect(
      ruleMatches(navigo, {
        note: "PRLV SEPA NAVIGO ANNUEL 2026",
        counterparty: null,
        direction: "out",
      }),
    ).toBe(true);
    expect(
      ruleMatches(navigo, {
        note: "CARTE X7322",
        counterparty: "Navigo Île-de-France",
        direction: "out",
      }),
    ).toBe(true);
  });

  it("does not find the words inside another word", () => {
    expect(
      ruleMatches(
        { words: "lidl", direction: "out" },
        { note: "SLIDLE SAS", counterparty: null, direction: "out" },
      ),
    ).toBe(false);
  });

  it("only files money going the rule's way", () => {
    expect(
      ruleMatches(navigo, {
        note: "REMBOURSEMENT NAVIGO",
        counterparty: null,
        direction: "in",
      }),
    ).toBe(false);
  });

  it("matches a phrase of several words in order", () => {
    const prime = { words: "amazon prime", direction: "out" as const };
    expect(
      ruleMatches(prime, {
        note: "AMAZON PRIME FR",
        counterparty: null,
        direction: "out",
      }),
    ).toBe(true);
    expect(
      ruleMatches(prime, {
        note: "AMAZON EU SARL PRIME",
        counterparty: null,
        direction: "out",
      }),
    ).toBe(false);
  });
});

describe("findFilingRule", () => {
  it("lets the most specific rule win", () => {
    const amazon = { ...navigo, id: "r2", words: "amazon" };
    const prime = { ...navigo, id: "r3", words: "amazon prime" };
    const line = {
      note: "AMAZON PRIME FR",
      counterparty: null,
      direction: "out" as const,
    };
    expect(findFilingRule([amazon, prime], line)?.id).toBe("r3");
    expect(
      findFilingRule([amazon, prime], { ...line, note: "AMAZON EU SARL" })?.id,
    ).toBe("r2");
  });

  it("answers null when no rule files the line", () => {
    expect(
      findFilingRule([navigo], {
        note: "CARREFOUR MARKET",
        counterparty: null,
        direction: "out",
      }),
    ).toBeNull();
  });
});

describe("suggestRuleWords", () => {
  it("offers the shop as the matcher keys it", () => {
    expect(suggestRuleWords("PAIEMENT PAR CARTE X7322 BITSTACK SAS MEYREUI")).toBe(
      "bitstack",
    );
    expect(suggestRuleWords("CARREFOUR MARKET PARIS")).toBe("carrefour");
  });

  it("falls back to the name itself when nothing usable is left", () => {
    expect(suggestRuleWords("X1")).toBe("x1");
  });
});
