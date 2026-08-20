import { createEurRates } from "./eur-rates";
import { createYahooQuoteSource } from "./quote-source";
import { fetchMonthlyCloses, type MonthlyClosePoint } from "./yahoo";

/**
 * Convenience layer for callers that have no seam yet: the investment read
 * paths in both apps. Anything with a test around it should take a
 * `QuoteSource` instead of importing from here.
 */
const defaultRates = createEurRates();
const defaultQuotes = createYahooQuoteSource({ rates: defaultRates });

const historyCache = new Map<
  string,
  { points: MonthlyClosePoint[]; fetchedAt: number }
>();
const HISTORY_CACHE_TTL_MS = 60 * 60 * 1000;

export async function convertToEur(
  amount: number,
  currency: string,
): Promise<number> {
  return defaultRates.toEur(amount, currency);
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
  const quote = await defaultQuotes.quoteInEur(symbol);

  if (!quote) {
    throw new Error(`No price available for ${symbol}`);
  }

  return {
    symbol: quote.symbol,
    priceEur: quote.priceEur,
    priceOriginal: quote.priceOriginal,
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
    const closeEur = await defaultRates.toEur(point.close, currency);
    converted.push({ month: point.month, close: closeEur });
  }

  historyCache.set(key, { points: converted, fetchedAt: Date.now() });
  return Object.fromEntries(
    converted.map((point) => [point.month, point.close]),
  );
}
