import { fetchInstrumentQuote } from "./yahoo";

/** Conversion into EUR. Rates are cached per instance, not per module. */
export interface EurRates {
  /** Multiplier: amount in `currency` × rate = amount in EUR. */
  multiplier(currency: string): Promise<number>;
  toEur(amount: number, currency: string): Promise<number>;
}

export interface EurRatesOptions {
  /** How long a fetched rate stays fresh. */
  ttlMs?: number;
  /** Epoch millis, injected so expiry is assertable. */
  now?: () => number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const INVERTED_PAIRS: Record<string, string> = {
  USD: "EURUSD=X",
  GBP: "EURGBP=X",
  CHF: "EURCHF=X",
};

export function createEurRates(options: EurRatesOptions = {}): EurRates {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { rate: number; fetchedAt: number }>();

  async function multiplier(currency: string): Promise<number> {
    const normalized = currency.toUpperCase();
    if (normalized === "EUR") {
      return 1;
    }

    const cached = cache.get(normalized);
    if (cached && now() - cached.fetchedAt < ttlMs) {
      return cached.rate;
    }

    const inverted = INVERTED_PAIRS[normalized];
    let rate: number;

    if (inverted) {
      const { price } = await fetchInstrumentQuote(inverted);
      rate = 1 / price;
    } else {
      const { price } = await fetchInstrumentQuote(`${normalized}EUR=X`);
      rate = price;
    }

    cache.set(normalized, { rate, fetchedAt: now() });
    return rate;
  }

  return {
    multiplier,
    async toEur(amount, currency) {
      const rate = await multiplier(currency);
      return Math.round(amount * rate * 100) / 100;
    },
  };
}
