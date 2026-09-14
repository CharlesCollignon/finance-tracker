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

const SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const ALLOWED_QUOTE_TYPES = new Set(["ETF", "EQUITY", "MUTUALFUND"]);

const REQUEST_TIMEOUT_MS = 8000;

export const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SYMBOL_REGEX = /^[A-Za-z0-9][A-Za-z0-9._^=-]{0,31}$/;

export function isValidInstrumentSymbol(symbol: string): boolean {
  return SYMBOL_REGEX.test(symbol.trim());
}

export function normalizeInstrumentQuery(query: string): string {
  return query.trim().toUpperCase().replace(/\s+/g, "");
}

export function isIsinQuery(query: string): boolean {
  return ISIN_REGEX.test(normalizeInstrumentQuery(query));
}

/**
 * Whether a query is worth sending.
 *
 * The rule that matters is the half-typed ISIN: `IE00B4L5` on its way to
 * `IE00B4L5Y983` matches nothing and wastes a request against an endpoint that
 * rate-limits by IP. But the test for it used to be "two letters then
 * alphanumerics, under twelve characters", which is also the shape of every
 * short name anyone would search — NVIDIA, Intel, Alphabet all came back empty
 * with no explanation. A partial ISIN has a digit in it; a company name does
 * not, and that is enough to tell them apart.
 *
 * Length is measured on the raw query rather than the space-stripped one, so a
 * fund's full name is not refused for being wordy.
 */
export function canSearchInstruments(query: string): boolean {
  const normalized = normalizeInstrumentQuery(query);

  if (isIsinQuery(normalized)) {
    return true;
  }

  const looksLikePartialIsin =
    /^[A-Z]{2}[A-Z0-9]*[0-9][A-Z0-9]*$/.test(normalized) &&
    normalized.length < 12;
  if (looksLikePartialIsin) {
    return false;
  }

  const trimmed = query.trim();
  return trimmed.length >= 2 && trimmed.length <= 120;
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

type CachedFetchInit = RequestInit & {
  next?: { revalidate: number };
};

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const init: CachedFetchInit = {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Pluclair/1.0",
      },
      next: { revalidate: 300 },
    };
    const response = await fetch(url, init);

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
    // An ISIN goes up normalised — uppercase, no spaces, which is the only
    // form it matches in. A name goes up as typed: stripping the spaces out
    // of "iShares Core MSCI World" leaves one long token that Yahoo has no
    // reason to match, and the words are what the match is made of.
    q: isinSearch ? normalized : query.trim(),
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
  if (!isValidInstrumentSymbol(symbol)) {
    throw new Error("Invalid instrument symbol");
  }
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

export function computeSharesAmount(shareCount: number, price: number): number {
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
  if (!isValidInstrumentSymbol(symbol)) {
    throw new Error("Invalid instrument symbol");
  }
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
    if (
      ts === undefined ||
      close === null ||
      close === undefined ||
      close <= 0
    ) {
      continue;
    }
    byMonth.set(monthKeyFromUnix(ts), close);
  }

  const points = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, close]) => ({ month, close }));

  return { currency, points };
}

export interface DatedClosePoint {
  /** YYYY-MM-DD, UTC. */
  date: string;
  close: number;
}

export interface DatedCloseOptions {
  /** Yahoo `range`: 1mo, 1y, 5y, max… */
  range?: string;
  /** Yahoo `interval`: 1d, 1wk, 1mo… */
  interval?: string;
}

function dateKeyFromUnix(seconds: number): string {
  const date = new Date(seconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Closes with their day kept, oldest first.
 *
 * The sibling of `fetchMonthlyCloses`, which buckets by month because the
 * position charts are monthly. A price line asked for over one month needs the
 * days, so this one keeps them and lets the caller decide what to thin out.
 */
export async function fetchDatedCloses(
  symbol: string,
  options: DatedCloseOptions = {},
): Promise<{ currency: string; points: DatedClosePoint[] }> {
  if (!isValidInstrumentSymbol(symbol)) {
    throw new Error("Invalid instrument symbol");
  }
  const encoded = encodeURIComponent(symbol.trim());
  const params = new URLSearchParams({
    interval: options.interval ?? "1d",
    range: options.range ?? "max",
  });

  const data = await fetchJson<YahooChartResponse>(
    `${CHART_URL}/${encoded}?${params.toString()}`,
  );

  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const currency = result?.meta?.currency ?? "EUR";

  const byDate = new Map<string, number>();
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = closes[index];
    const ts = timestamps[index];
    if (
      ts === undefined ||
      close === null ||
      close === undefined ||
      close <= 0
    ) {
      continue;
    }
    byDate.set(dateKeyFromUnix(ts), close);
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close }));

  return { currency, points };
}

export interface InstrumentPriceHistory {
  currency: string;
  /** Daily closes over the last year. Empty if the listing gives none. */
  daily: DatedClosePoint[];
  /** Monthly closes over the instrument's whole life. */
  monthly: DatedClosePoint[];
}

/**
 * An instrument's price at two grains, because one will not do.
 *
 * Asking for `range=max&interval=1d` looks like it should answer everything at
 * once. Yahoo accepts it and quietly answers monthly — a world tracker listed
 * in 2009 comes back as 208 points, which is one a month, and a "last 30 days"
 * slice of that is two points and a straight line between them. The daily grain
 * only survives over a short range.
 *
 * So: a year of days for the near ranges, and a lifetime of months for the far
 * ones, fetched together. Two requests per symbol, which is what the page spent
 * on position history before it stopped drawing it — and Yahoo rate-limits by
 * IP hard enough that `quote-source.ts` carries a circuit breaker, so the
 * budget is worth keeping flat.
 */
export async function fetchInstrumentPriceHistory(
  symbol: string,
): Promise<InstrumentPriceHistory> {
  const [daily, monthly] = await Promise.all([
    fetchDatedCloses(symbol, { range: "1y", interval: "1d" }).catch(() => ({
      currency: "",
      points: [] as DatedClosePoint[],
    })),
    fetchDatedCloses(symbol, { range: "max", interval: "1mo" }),
  ]);

  return {
    currency: monthly.currency || daily.currency || "EUR",
    daily: daily.points,
    monthly: monthly.points,
  };
}
