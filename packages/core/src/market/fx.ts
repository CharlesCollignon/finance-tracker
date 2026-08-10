import {
  fetchInstrumentQuote,
  fetchMonthlyCloses,
  type MonthlyClosePoint,
} from "./yahoo";

const rateCache = new Map<string, { rate: number; fetchedAt: number }>();
const historyCache = new Map<
  string,
  { points: MonthlyClosePoint[]; fetchedAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_CACHE_TTL_MS = 60 * 60 * 1000;

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

const quoteCache = new Map<string, { quote: QuoteInEur; fetchedAt: number }>();

export async function fetchInstrumentQuoteInEur(
  symbol: string,
): Promise<QuoteInEur> {
  const key = symbol.trim().toUpperCase();
  const cached = quoteCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.quote;
  }

  const quote = await fetchInstrumentQuote(symbol);
  const priceEur = await convertToEur(quote.price, quote.currency);

  const result: QuoteInEur = {
    symbol: quote.symbol,
    priceEur,
    priceOriginal: quote.price,
    currency: quote.currency,
  };

  quoteCache.set(key, { quote: result, fetchedAt: Date.now() });
  return result;
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Monthly closes converted to EUR, keyed by YYYY-MM. */
export async function fetchMonthlyClosesInEur(
  symbol: string,
): Promise<Record<string, number>> {
  const key = symbol.trim().toUpperCase();
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) {
    return Object.fromEntries(
      cached.points.map((point) => [point.month, point.close]),
    );
  }

  const { currency, points } = await fetchMonthlyCloses(symbol);
  const converted: MonthlyClosePoint[] = [];

  for (const point of points) {
    const closeEur = await convertToEur(point.close, currency);
    converted.push({ month: point.month, close: closeEur });
  }

  historyCache.set(key, { points: converted, fetchedAt: Date.now() });
  return Object.fromEntries(
    converted.map((point) => [point.month, point.close]),
  );
}
