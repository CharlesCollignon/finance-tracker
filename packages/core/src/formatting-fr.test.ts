import { describe, expect, it } from "vitest";

import { formatCurrency, formatSignedPercentOf } from "./constants";
import { formatWeight } from "./allocation";
import { formatCharge } from "./fund-costs";
import { formatSignedPercent } from "./instrument-price-series";
import { formatAnnualRate } from "./xirr";

// `\s` matches the no-break and narrow no-break spaces French formatting
// puts between a number and its unit, whichever one Intl chooses.

describe("French formatting", () => {
  it("writes a signed percent without the doubled sign Hermes produced", () => {
    expect(formatAnnualRate(0.347, "fr")).toMatch(/^\+34,7\s%\spar an$/);
    expect(formatAnnualRate(-0.021, "fr")).toMatch(/^-2,1\s%\spar an$/);
    expect(formatSignedPercent(12.4, "fr")).toMatch(/^\+12,4\s%$/);
    expect(formatSignedPercentOf(0.00001, "fr")).toMatch(/^0,0\s%$/);
  });

  it("writes fees and weights with a comma and a spaced percent", () => {
    expect(formatCharge(0.0045, "fr")).toMatch(/^0,45\s%$/);
    expect(formatCharge(0.00325, "fr")).toMatch(/^0,325\s%$/);
    expect(formatWeight(0.35, "fr")).toMatch(/^35\s%$/);
  });

  it("shows cents in full, and whole euros without them", () => {
    expect(formatCurrency(871.1, "EUR", "fr")).toMatch(/^871,10\s€$/);
    expect(formatCurrency(3440, "EUR", "fr")).toMatch(/^3\s440\s€$/);
    expect(formatCurrency(-12.5, "EUR", "fr")).toMatch(/^-12,50\s€$/);
  });

  it("keeps English as it was", () => {
    expect(formatAnnualRate(0.074, "en")).toBe("+7.4% a year");
    expect(formatCharge(0.002, "en")).toBe("0.2%");
    expect(formatCurrency(871.1, "EUR", "en")).toBe("€871.10");
  });
});
