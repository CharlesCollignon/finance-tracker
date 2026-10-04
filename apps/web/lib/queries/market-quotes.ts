import { unstable_cache } from "next/cache";
import {
  fetchMonthlyClosesBySymbolInEur,
  fetchPriceSeriesBySymbol,
  fetchQuotesInEur,
} from "@finance/core/market/fx";
import type { InstrumentPriceSeries } from "@finance/core/instrument-price-series";

function symbolsCacheKey(symbols: string[]): string {
  return [...new Set(symbols.filter(Boolean))].sort().join(",");
}

/** Live quotes cached ~5 minutes across requests. */
export async function getCachedLiveQuotes(
  symbols: string[],
): Promise<Record<string, number>> {
  const key = symbolsCacheKey(symbols);
  if (!key) {
    return {};
  }

  return unstable_cache(
    async () => fetchQuotesInEur(key.split(",")),
    ["market-live-quotes", key],
    { revalidate: 300, tags: ["market-quotes"] },
  )();
}

/** Monthly history cached ~1 hour (charts only). */
export async function getCachedHistoricalQuotes(
  symbols: string[],
): Promise<Record<string, Record<string, number>>> {
  const key = symbolsCacheKey(symbols);
  if (!key) {
    return {};
  }

  return unstable_cache(
    async () => fetchMonthlyClosesBySymbolInEur(key.split(",")),
    ["market-historical-quotes", key],
    { revalidate: 3600, tags: ["market-quotes"] },
  )();
}

/**
 * Instrument price lines cached ~1 hour.
 *
 * `today` is part of the key so the ranges roll over at midnight rather than
 * holding yesterday's window until the entry expires. Tagged like its
 * neighbours, so `refreshQuotesAction` already clears it.
 */
export async function getCachedPriceSeries(
  symbols: string[],
  today: string,
): Promise<Record<string, InstrumentPriceSeries>> {
  const key = symbolsCacheKey(symbols);
  if (!key) {
    return {};
  }

  return unstable_cache(
    async () => fetchPriceSeriesBySymbol(key.split(","), today),
    ["market-price-series", key, today],
    { revalidate: 3600, tags: ["market-quotes"] },
  )();
}
