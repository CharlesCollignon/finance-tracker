import { createEurRates, type EurRates } from "./eur-rates";
import { fetchInstrumentQuote, type InstrumentQuote } from "./yahoo";

export interface Quote {
  symbol: string;
  priceEur: number;
  priceOriginal: number;
  currency: string;
  /** ISO timestamp of when this price was read. */
  quotedAt: string;
  /** True when the market could not be reached and this is a kept price. */
  stale?: boolean;
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
  /**
   * How long a cached price may still be served once the market cannot be
   * reached. An hour-old price is worth far more than no price.
   */
  staleMs?: number;
  /** How long to stop calling out after repeated failures. */
  cooldownMs?: number;
  /** Consecutive failures before the cooldown starts. */
  failureThreshold?: number;
  /** The network call, injected so failure handling is testable. */
  fetchQuote?: (symbol: string) => Promise<InstrumentQuote>;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** A day-old price still beats a blank where a figure should be. */
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Yahoo rate-limits by IP and answers 429 to everything once tripped, so
 * retrying on every request is what keeps it tripped. Backing off is both
 * kinder and the faster way back to working quotes.
 */
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_FAILURE_THRESHOLD = 3;

/** Live prices from Yahoo, converted to EUR. Caches are instance state. */
export function createYahooQuoteSource(
  options: YahooQuoteSourceOptions = {},
): QuoteSource {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const rates = options.rates ?? createEurRates({ ttlMs, now });
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const fetchQuote = options.fetchQuote ?? fetchInstrumentQuote;

  const cache = new Map<string, { quote: Quote; fetchedAt: number }>();
  let consecutiveFailures = 0;
  let cooldownUntil = 0;

  /** The cached price, marked stale, while it is still worth showing. */
  function staleFor(key: string): Quote | null {
    const cached = cache.get(key);
    if (!cached || now() - cached.fetchedAt > staleMs) {
      return null;
    }
    return { ...cached.quote, stale: true };
  }

  return {
    async quoteInEur(symbol) {
      const key = symbol.trim().toUpperCase();
      const cached = cache.get(key);
      if (cached && now() - cached.fetchedAt < ttlMs) {
        return cached.quote;
      }

      // While backing off, answer from the cache rather than calling out —
      // hammering a rate-limited endpoint is what keeps it rate-limited.
      if (now() < cooldownUntil) {
        return staleFor(key);
      }

      try {
        const raw = await fetchQuote(symbol);
        const quote: Quote = {
          symbol: raw.symbol,
          priceEur: await rates.toEur(raw.price, raw.currency),
          priceOriginal: raw.price,
          currency: raw.currency,
          quotedAt: new Date(now()).toISOString(),
        };
        cache.set(key, { quote, fetchedAt: now() });
        consecutiveFailures = 0;
        cooldownUntil = 0;
        return quote;
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= failureThreshold) {
          cooldownUntil = now() + cooldownMs;
        }
        return staleFor(key);
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
