import { unstable_cache } from "next/cache";
import {
  fetchHistoricalQuotes,
  fetchLiveQuotes,
} from "@/lib/queries/investments";

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
