import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "../i18n/locale";
import {
  applyMonthlyRates,
  buildPriceSeries,
  emptyPriceSeries,
  type InstrumentPriceSeries,
} from "../instrument-price-series";
import { createEurRates, fxSymbolForCurrency } from "./eur-rates";
import { createYahooQuoteSource } from "./quote-source";
import {
  fetchDatedCloses,
  fetchInstrumentPriceHistory,
  fetchMonthlyCloses,
  type MonthlyClosePoint,
} from "./yahoo";

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

const fxHistoryCache = new Map<
  string,
  { rates: Record<string, number>; fetchedAt: number }
>();
/** A month's closing exchange rate is settled history; only the last one moves. */
const FX_HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const priceSeriesCache = new Map<
  string,
  { series: InstrumentPriceSeries; fetchedAt: number }
>();
const PRICE_SERIES_CACHE_TTL_MS = 60 * 60 * 1000;

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

export function formatMoney(
  amount: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * What one euro bought, month by month, for a currency.
 *
 * An exchange rate is an ordinary Yahoo symbol, so this is the same monthly
 * close fetch the instruments use, read through the pairing convention in
 * `./eur-rates`. An empty map is a valid answer — the caller falls back to
 * today's rate, which is wrong but not absent.
 */
export async function fetchMonthlyFxToEur(
  currency: string,
): Promise<Record<string, number>> {
  const normalized = currency.toUpperCase();
  if (normalized === "EUR") {
    return {};
  }

  const cached = fxHistoryCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < FX_HISTORY_CACHE_TTL_MS) {
    return cached.rates;
  }

  const { symbol, inverted } = fxSymbolForCurrency(normalized);
  // `max`, not the two years `fetchMonthlyCloses` asks for: the 5Y and ALL
  // ranges reach back further than that, and a point with no rate of its own
  // falls back to today's — which is the very thing this exists to avoid.
  const { points } = await fetchDatedCloses(symbol, {
    range: "max",
    interval: "1mo",
  });

  const rates: Record<string, number> = {};
  for (const point of points) {
    if (point.close > 0) {
      rates[point.date.slice(0, 7)] = inverted ? 1 / point.close : point.close;
    }
  }

  fxHistoryCache.set(normalized, { rates, fetchedAt: Date.now() });
  return rates;
}

/**
 * The rates to convert a foreign series with, and what to do without them.
 *
 * `multiplier` is today's rate. It is the fallback rather than the answer:
 * applied to the whole series it would scale every close by the same number,
 * which leaves the shape intact and the percentage measured in the
 * instrument's own currency — a euro label over a dollar fact.
 */
async function eurRatesFor(
  currency: string,
): Promise<{ rates: Record<string, number>; fallback: number }> {
  const [rates, fallback] = await Promise.all([
    fetchMonthlyFxToEur(currency).catch(() => ({}) as Record<string, number>),
    defaultRates.multiplier(currency),
  ]);

  return { rates, fallback };
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
  let converted: MonthlyClosePoint[];

  if (currency.toUpperCase() === "EUR") {
    converted = points;
  } else {
    const { rates, fallback } = await eurRatesFor(currency);
    // `applyMonthlyRates` works on dated points; a monthly close is the first
    // of its month as far as the rate lookup is concerned.
    const dated = applyMonthlyRates(
      points.map((point) => ({ date: `${point.month}-01`, close: point.close })),
      rates,
      fallback,
    );
    converted = dated.map((point, index) => ({
      month: points[index]!.month,
      close: point.close,
    }));
  }

  historyCache.set(key, { points: converted, fetchedAt: Date.now() });
  return Object.fromEntries(
    converted.map((point) => [point.month, point.close]),
  );
}

/**
 * An instrument's own price over the four ranges, in euro.
 *
 * One Yahoo request per symbol, sliced four ways here rather than fetched four
 * times. A symbol that cannot be read comes back empty rather than throwing:
 * one delisted ticker should cost its own row a line, not the page.
 */
export async function fetchPriceSeriesInEur(
  symbol: string,
  today: string,
): Promise<InstrumentPriceSeries> {
  const key = `${symbol.trim().toUpperCase()}|${today}`;
  const cached = priceSeriesCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PRICE_SERIES_CACHE_TTL_MS) {
    return cached.series;
  }

  const { currency, daily, monthly } = await fetchInstrumentPriceHistory(symbol);

  if (daily.length === 0 && monthly.length === 0) {
    return emptyPriceSeries();
  }

  const history =
    currency.toUpperCase() === "EUR"
      ? { daily, monthly }
      : await eurRatesFor(currency).then(({ rates, fallback }) => ({
          daily: applyMonthlyRates(daily, rates, fallback),
          monthly: applyMonthlyRates(monthly, rates, fallback),
        }));

  const series = buildPriceSeries(history, today);
  priceSeriesCache.set(key, { series, fetchedAt: Date.now() });
  return series;
}
