import { describe, expect, it } from "vitest";

import { createFakeQuoteSource } from "./market/quote-source";
import { resolveRecurringAmount } from "./recurring-shares";

const fixed = {
  pricing_type: "fixed" as string | null,
  amount: 42,
  share_count: null,
  instrument_symbol: null,
  instrument_name: null,
  description: "  Rent  ",
  last_quote_price: null,
};

const shares = {
  pricing_type: "shares" as string | null,
  amount: 0,
  share_count: 3,
  instrument_symbol: "CW8",
  instrument_name: "Amundi MSCI World",
  description: null,
  last_quote_price: null,
};

describe("resolveRecurringAmount", () => {
  it("takes a fixed amount straight from the template", async () => {
    const quotes = createFakeQuoteSource({ CW8: 100 });

    const resolved = await resolveRecurringAmount(fixed, quotes);

    expect(resolved.amount).toBe(42);
    expect(resolved.note).toBe("Rent");
    expect(resolved.quoteUpdate).toBeNull();
  });

  it("never asks for a price when pricing is fixed", async () => {
    const quotes = createFakeQuoteSource({ CW8: 100 });

    await resolveRecurringAmount(fixed, quotes);

    expect(quotes.calls).toEqual([]);
  });

  it("prices shares from the live quote and rounds to cents", async () => {
    const quotes = createFakeQuoteSource(
      { CW8: 33.333 },
      { quotedAt: "2026-02-01T09:30:00.000Z" },
    );

    const resolved = await resolveRecurringAmount(shares, quotes);

    expect(resolved.amount).toBe(100);
    expect(resolved.note).toContain("3 × Amundi MSCI World @ ");
    expect(resolved.quoteUpdate).toEqual({
      amount: 100,
      last_quote_price: 33.333,
      last_quote_at: "2026-02-01T09:30:00.000Z",
    });
  });

  it("keeps the description in front of the share note", async () => {
    const quotes = createFakeQuoteSource({ CW8: 10 });

    const resolved = await resolveRecurringAmount(
      { ...shares, description: " Weekly DCA " },
      quotes,
    );

    expect(resolved.note).toContain("Weekly DCA · 3 × Amundi MSCI World @ ");
  });

  it("shows the original currency when the quote was not in euro", async () => {
    const quotes = createFakeQuoteSource({
      VOO: { priceEur: 100, priceOriginal: 110, currency: "USD" },
    });

    const resolved = await resolveRecurringAmount(
      { ...shares, instrument_symbol: "VOO", instrument_name: "Vanguard 500" },
      quotes,
    );

    expect(resolved.note).toContain("/ share)");
    expect(resolved.amount).toBe(300);
  });

  it("falls back to the stored quote when the source has no price", async () => {
    const quotes = createFakeQuoteSource({});

    const resolved = await resolveRecurringAmount(
      { ...shares, last_quote_price: 20 },
      quotes,
    );

    expect(resolved.amount).toBe(60);
    expect(resolved.quoteUpdate).toBeNull();
  });

  it("throws when there is no live price and nothing stored", async () => {
    const quotes = createFakeQuoteSource({});

    await expect(resolveRecurringAmount(shares, quotes)).rejects.toThrow(
      "Could not resolve a price",
    );
  });

  it("treats a shares template with no symbol as fixed", async () => {
    const quotes = createFakeQuoteSource({ CW8: 100 });

    const resolved = await resolveRecurringAmount(
      { ...shares, instrument_symbol: null, amount: 15 },
      quotes,
    );

    expect(resolved.amount).toBe(15);
    expect(quotes.calls).toEqual([]);
  });
});
