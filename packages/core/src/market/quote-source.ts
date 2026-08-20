import { createEurRates, type EurRates } from "./eur-rates";
import { fetchInstrumentQuote } from "./yahoo";

export interface Quote {
  symbol: string;
  priceEur: number;
  priceOriginal: number;
  currency: string;
  /** ISO timestamp of when this price was read. */
  quotedAt: string;
}

/**
 * Seam for instrument prices. `null` means "no price available right now",
 * which is an ordinary outcome here, not a failure: callers fall back to the
 * last stored quote. Adapters never throw.
 */
export interface QuoteSource {
  quoteInEur(symbol: string): Promise<Quote | null>;
}

export interface YahooQuoteSourceOptions {
  /** How long a fetched quote stays fresh. */
  ttlMs?: number;
  /** Epoch millis, injected so expiry and `quotedAt` are assertable. */
  now?: () => number;
  /** Share a rate cache with other callers; one is created if omitted. */
  rates?: EurRates;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Live prices from Yahoo, converted to EUR. Caches are instance state. */
export function createYahooQuoteSource(
  options: YahooQuoteSourceOptions = {},
): QuoteSource {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const rates = options.rates ?? createEurRates({ ttlMs, now });
  const cache = new Map<string, { quote: Quote; fetchedAt: number }>();

  return {
    async quoteInEur(symbol) {
      const key = symbol.trim().toUpperCase();
      const cached = cache.get(key);
      if (cached && now() - cached.fetchedAt < ttlMs) {
        return cached.quote;
      }

      try {
        const raw = await fetchInstrumentQuote(symbol);
        const quote: Quote = {
          symbol: raw.symbol,
          priceEur: await rates.toEur(raw.price, raw.currency),
          priceOriginal: raw.price,
          currency: raw.currency,
          quotedAt: new Date(now()).toISOString(),
        };
        cache.set(key, { quote, fetchedAt: now() });
        return quote;
      } catch {
        return null;
      }
    },
  };
}

export interface FakeQuote {
  priceEur: number;
  priceOriginal?: number;
  currency?: string;
  quotedAt?: string;
}

export interface FakeQuoteSource extends QuoteSource {
  /** Symbols asked for, in order. Lets a test assert nothing was fetched. */
  readonly calls: string[];
}

/**
 * Fixed prices for tests. A symbol absent from `prices` returns null, the same
 * way the Yahoo adapter reports an unpriceable instrument.
 */
export function createFakeQuoteSource(
  prices: Record<string, number | FakeQuote>,
  options: { quotedAt?: string } = {},
): FakeQuoteSource {
  const quotedAt = options.quotedAt ?? "2026-01-15T12:00:00.000Z";
  const calls: string[] = [];

  const normalized = new Map<string, FakeQuote>(
    Object.entries(prices).map(([symbol, value]) => [
      symbol.trim().toUpperCase(),
      typeof value === "number" ? { priceEur: value } : value,
    ]),
  );

  return {
    calls,
    async quoteInEur(symbol) {
      const key = symbol.trim().toUpperCase();
      calls.push(key);

      const entry = normalized.get(key);
      if (!entry) {
        return null;
      }

      return {
        symbol: key,
        priceEur: entry.priceEur,
        priceOriginal: entry.priceOriginal ?? entry.priceEur,
        currency: entry.currency ?? "EUR",
        quotedAt: entry.quotedAt ?? quotedAt,
      };
    },
  };
}
