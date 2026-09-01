import { describe, expect, it, vi } from "vitest";

import {
  createFakeQuoteSource,
  createYahooQuoteSource,
} from "./quote-source";
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

describe("createYahooQuoteSource resilience", () => {
  /** A controllable clock and a fetch that can be made to fail on demand. */
  function harness(options: Parameters<typeof createYahooQuoteSource>[0] = {}) {
    let clock = 1_000_000;
    let failing = false;
    let calls = 0;

    const source = createYahooQuoteSource({
      now: () => clock,
      ttlMs: 1000,
      staleMs: 10_000,
      cooldownMs: 5000,
      failureThreshold: 2,
      fetchQuote: async (symbol: string) => {
        calls += 1;
        if (failing) {
          throw new Error("Too Many Requests");
        }
        return { symbol, price: 100, currency: "EUR" };
      },
      ...options,
    });

    return {
      source,
      advance: (ms: number) => {
        clock += ms;
      },
      fail: (value: boolean) => {
        failing = value;
      },
      callCount: () => calls,
    };
  }

  it("serves the cached price when the market cannot be reached", async () => {
    const h = harness();
    await h.source.quoteInEur("IWDA.AS");

    h.fail(true);
    h.advance(2000); // past the fresh TTL

    const quote = await h.source.quoteInEur("IWDA.AS");
    expect(quote?.priceEur).toBe(100);
    expect(quote?.stale).toBe(true);
  });

  it("marks a live price as not stale", async () => {
    const h = harness();
    const quote = await h.source.quoteInEur("IWDA.AS");
    expect(quote?.stale).toBeUndefined();
  });

  it("gives up once the cached price is too old to trust", async () => {
    const h = harness();
    await h.source.quoteInEur("IWDA.AS");

    h.fail(true);
    h.advance(20_000); // beyond staleMs

    expect(await h.source.quoteInEur("IWDA.AS")).toBeNull();
  });

  it("returns null when it has never had a price", async () => {
    const h = harness();
    h.fail(true);
    expect(await h.source.quoteInEur("NEW.AS")).toBeNull();
  });

  it("stops calling out after repeated failures", async () => {
    const h = harness();
    h.fail(true);

    await h.source.quoteInEur("A.AS");
    await h.source.quoteInEur("B.AS");
    const afterThreshold = h.callCount();

    // The cooldown has started; further requests must not reach the network.
    await h.source.quoteInEur("C.AS");
    await h.source.quoteInEur("D.AS");

    expect(h.callCount()).toBe(afterThreshold);
  });

  it("still answers from cache while backing off", async () => {
    const h = harness();
    await h.source.quoteInEur("IWDA.AS");

    h.fail(true);
    h.advance(2000);
    await h.source.quoteInEur("A.AS");
    await h.source.quoteInEur("B.AS"); // cooldown starts here

    const quote = await h.source.quoteInEur("IWDA.AS");
    expect(quote?.priceEur).toBe(100);
    expect(quote?.stale).toBe(true);
  });

  it("tries again once the cooldown expires", async () => {
    const h = harness();
    h.fail(true);
    await h.source.quoteInEur("A.AS");
    await h.source.quoteInEur("B.AS");
    const duringCooldown = h.callCount();

    h.advance(6000); // past cooldownMs
    h.fail(false);

    const quote = await h.source.quoteInEur("A.AS");
    expect(h.callCount()).toBeGreaterThan(duringCooldown);
    expect(quote?.priceEur).toBe(100);
    expect(quote?.stale).toBeUndefined();
  });

  it("forgets past failures after a success", async () => {
    const h = harness();
    h.fail(true);
    await h.source.quoteInEur("A.AS"); // one failure

    h.fail(false);
    await h.source.quoteInEur("A.AS"); // success resets the count

    h.fail(true);
    h.advance(2000);
    await h.source.quoteInEur("A.AS"); // one failure again, not two

    const before = h.callCount();
    h.advance(2000);
    await h.source.quoteInEur("A.AS");
    // Still below the threshold, so it is still reaching out.
    expect(h.callCount()).toBeGreaterThan(before);
  });

  it("keeps serving a fresh cache hit without any network call", async () => {
    const h = harness();
    await h.source.quoteInEur("IWDA.AS");
    const after = h.callCount();

    await h.source.quoteInEur("IWDA.AS");
    expect(h.callCount()).toBe(after);
  });
});
