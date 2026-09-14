import { unstable_cache } from "next/cache";
import {
  fetchHistoricalQuotes,
  fetchLiveQuotes,
  fetchPriceSeries,
} from "@/lib/queries/investments";
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
    async () => fetchLiveQuotes(key.split(",")),
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
    async () => fetchHistoricalQuotes(key.split(",")),
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
    async () => fetchPriceSeries(key.split(","), today),
    ["market-price-series", key, today],
    { revalidate: 3600, tags: ["market-quotes"] },
  )();
}
