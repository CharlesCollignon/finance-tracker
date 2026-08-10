export interface InstrumentSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  quoteType: string;
  isin?: string;
}

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  isin?: string;
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
        symbol?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

export interface MonthlyClosePoint {
  /** YYYY-MM */
  month: string;
  close: number;
}

const SEARCH_URL =
  "https://query1.finance.yahoo.com/v1/finance/search";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const ALLOWED_QUOTE_TYPES = new Set([
  "ETF",
  "EQUITY",
  "MUTUALFUND",
]);

const REQUEST_TIMEOUT_MS = 8000;

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function normalizeInstrumentQuery(query: string): string {
  return query.trim().toUpperCase().replace(/\s+/g, "");
}

export function isIsinQuery(query: string): boolean {
  return ISIN_REGEX.test(normalizeInstrumentQuery(query));
}

/** Whether a search should run for the current input. */
export function canSearchInstruments(query: string): boolean {
  const normalized = normalizeInstrumentQuery(query);

  if (isIsinQuery(normalized)) {
    return true;
  }

  if (/^[A-Z]{2}[A-Z0-9]+$/.test(normalized) && normalized.length < 12) {
    return false;
  }

  return normalized.length >= 2;
}

function rankSearchResults(
  results: InstrumentSearchResult[],
  isinSearch: boolean,
): InstrumentSearchResult[] {
  if (!isinSearch) {
    return results;
  }

  const score = (item: InstrumentSearchResult) => {
    let value = 0;
    if (item.quoteType === "ETF") {
      value += 10;
    }
    if (item.exchange === "PAR") {
      value += 8;
    }
    if (item.symbol.endsWith(".PA")) {
      value += 5;
    }
    if (item.quoteType === "MUTUALFUND") {
      value -= 6;
    }
    return value;
  };

  return [...results].sort((a, b) => score(b) - score(a));
}

function mapQuote(
  quote: YahooSearchQuote,
  searchedIsin?: string,
): InstrumentSearchResult | null {
  if (
    !quote.symbol ||
    !quote.quoteType ||
    !ALLOWED_QUOTE_TYPES.has(quote.quoteType)
  ) {
    return null;
  }

  return {
    symbol: quote.symbol,
    name: quote.longname ?? quote.shortname ?? quote.symbol,
    exchange: quote.exchange ?? "",
    quoteType: quote.quoteType,
    isin: quote.isin ?? searchedIsin,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "FinanceTracker/1.0",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Market data request failed (${response.status})`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchInstruments(
  query: string,
): Promise<InstrumentSearchResult[]> {
  const normalized = normalizeInstrumentQuery(query);

  if (!canSearchInstruments(query)) {
    return [];
  }

  const isinSearch = isIsinQuery(normalized);

  const params = new URLSearchParams({
    q: normalized,
    quotesCount: "12",
    newsCount: "0",
    enableFuzzyQuery: isinSearch ? "false" : "true",
    quotesQueryId: "tss_match_phrase_query",
  });

  const data = await fetchJson<YahooSearchResponse>(
    `${SEARCH_URL}?${params.toString()}`,
  );

  const results = (data.quotes ?? [])
    .map((quote) => mapQuote(quote, isinSearch ? normalized : undefined))
    .filter((quote): quote is InstrumentSearchResult => quote !== null);

  return rankSearchResults(results, isinSearch);
}

export interface InstrumentQuote {
  symbol: string;
  price: number;
  currency: string;
}

export async function fetchInstrumentQuote(
  symbol: string,
): Promise<InstrumentQuote> {
  const encoded = encodeURIComponent(symbol.trim());
  const params = new URLSearchParams({
    interval: "1d",
    range: "1d",
  });

  const data = await fetchJson<YahooChartResponse>(
    `${CHART_URL}/${encoded}?${params.toString()}`,
  );

  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;

  if (!meta?.symbol || price === undefined || price <= 0) {
    throw new Error(`No price available for ${symbol}`);
  }

  return {
    symbol: meta.symbol,
    price,
    currency: meta.currency ?? "EUR",
  };
}

export function computeSharesAmount(
  shareCount: number,
  price: number,
): number {
  return Math.round(shareCount * price * 100) / 100;
}

function monthKeyFromUnix(seconds: number): string {
  const date = new Date(seconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Monthly closes for an instrument (last ~2 years). */
export async function fetchMonthlyCloses(
  symbol: string,
): Promise<{ currency: string; points: MonthlyClosePoint[] }> {
  const encoded = encodeURIComponent(symbol.trim());
  const params = new URLSearchParams({
    interval: "1mo",
    range: "2y",
  });

  const data = await fetchJson<YahooChartResponse>(
    `${CHART_URL}/${encoded}?${params.toString()}`,
  );

  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const currency = result?.meta?.currency ?? "EUR";

  const byMonth = new Map<string, number>();
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = closes[index];
    const ts = timestamps[index];
    if (ts === undefined || close === null || close === undefined || close <= 0) {
      continue;
    }
    byMonth.set(monthKeyFromUnix(ts), close);
  }

  const points = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, close]) => ({ month, close }));

  return { currency, points };
}
