import { fetchInstrumentQuote } from "./yahoo";

const rateCache = new Map<string, { rate: number; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Multiplier: amount in `currency` × rate = amount in EUR. */
async function eurMultiplier(currency: string): Promise<number> {
  const normalized = currency.toUpperCase();
  if (normalized === "EUR") {
    return 1;
  }

  const cached = rateCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  let rate: number;

  if (normalized === "USD") {
    const { price } = await fetchInstrumentQuote("EURUSD=X");
    rate = 1 / price;
  } else if (normalized === "GBP") {
    const { price } = await fetchInstrumentQuote("EURGBP=X");
    rate = 1 / price;
  } else if (normalized === "CHF") {
    const { price } = await fetchInstrumentQuote("EURCHF=X");
    rate = 1 / price;
  } else {
    const { price } = await fetchInstrumentQuote(`${normalized}EUR=X`);
    rate = price;
  }

  rateCache.set(normalized, { rate, fetchedAt: Date.now() });
  return rate;
}

export async function convertToEur(
  amount: number,
  currency: string,
): Promise<number> {
  const rate = await eurMultiplier(currency);
  return Math.round(amount * rate * 100) / 100;
}

export interface QuoteInEur {
  symbol: string;
  priceEur: number;
  priceOriginal: number;
  currency: string;
}

export async function fetchInstrumentQuoteInEur(
  symbol: string,
): Promise<QuoteInEur> {
  const quote = await fetchInstrumentQuote(symbol);
  const priceEur = await convertToEur(quote.price, quote.currency);

  return {
    symbol: quote.symbol,
    priceEur,
    priceOriginal: quote.price,
    currency: quote.currency,
  };
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
