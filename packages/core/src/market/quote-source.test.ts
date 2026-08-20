import { describe, expect, it, vi } from "vitest";

import { createFakeQuoteSource, createYahooQuoteSource } from "./quote-source";
import type { EurRates } from "./eur-rates";

vi.mock("./yahoo", () => ({
  fetchInstrumentQuote: vi.fn(),
}));

const { fetchInstrumentQuote } = await import("./yahoo");
const fetchMock = vi.mocked(fetchInstrumentQuote);

/** Doubles USD, passes EUR through, so conversion is visible in assertions. */
const rates: EurRates = {
  async multiplier(currency) {
    return currency.toUpperCase() === "EUR" ? 1 : 2;
  },
  async toEur(amount, currency) {
    return amount * (currency.toUpperCase() === "EUR" ? 1 : 2);
  },
};

describe("createFakeQuoteSource", () => {
  it("returns null for a symbol it has no price for", async () => {
    const quotes = createFakeQuoteSource({ CW8: 100 });

    expect(await quotes.quoteInEur("UNKNOWN")).toBeNull();
  });

  it("expands a bare number into a EUR quote", async () => {
    const quotes = createFakeQuoteSource(
      { cw8: 42.5 },
      { quotedAt: "2026-03-01T00:00:00.000Z" },
    );

    expect(await quotes.quoteInEur("CW8")).toEqual({
      symbol: "CW8",
      priceEur: 42.5,
      priceOriginal: 42.5,
      currency: "EUR",
      quotedAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("records every symbol it was asked for", async () => {
    const quotes = createFakeQuoteSource({ CW8: 1 });

    await quotes.quoteInEur("cw8");
    await quotes.quoteInEur("VWCE");

    expect(quotes.calls).toEqual(["CW8", "VWCE"]);
  });
});

describe("createYahooQuoteSource", () => {
  it("converts the fetched price into EUR and stamps the read time", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ symbol: "VOO", price: 50, currency: "USD" });
    const quotes = createYahooQuoteSource({
      rates,
      now: () => Date.parse("2026-02-01T09:30:00.000Z"),
    });

    expect(await quotes.quoteInEur("voo")).toEqual({
      symbol: "VOO",
      priceEur: 100,
      priceOriginal: 50,
      currency: "USD",
      quotedAt: "2026-02-01T09:30:00.000Z",
    });
  });

  it("serves a cached quote until the ttl expires", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ symbol: "CW8", price: 10, currency: "EUR" });
    let clock = 0;
    const quotes = createYahooQuoteSource({
      rates,
      ttlMs: 1000,
      now: () => clock,
    });

    await quotes.quoteInEur("CW8");
    clock = 999;
    await quotes.quoteInEur("CW8");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock = 1000;
    await quotes.quoteInEur("CW8");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports an unpriceable instrument as null instead of throwing", async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("No price available for NOPE"));
    const quotes = createYahooQuoteSource({ rates });

    await expect(quotes.quoteInEur("NOPE")).resolves.toBeNull();
  });
});
