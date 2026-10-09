import { describe, expect, it } from "vitest";

import { parseCurrency } from "./currency-cookie";

describe("parseCurrency", () => {
  it("reads dollars, and euro for anything else", () => {
    expect(parseCurrency("USD")).toBe("USD");
    expect(parseCurrency("EUR")).toBe("EUR");
    expect(parseCurrency(undefined)).toBe("EUR");
    expect(parseCurrency("usd")).toBe("EUR");
  });
});
