"use server";

import {
  computeSharesAmount,
  fetchInstrumentQuote,
  searchInstruments,
  type InstrumentQuote,
  type InstrumentSearchResult,
} from "@finance/core/market/yahoo";
import { fetchInstrumentQuoteInEur } from "@finance/core/market/fx";
import { updateTag } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";

type MarketActionResult<T> = { error: string } | { data: T };

async function requireUser() {
  return getAuthUser();
}

export async function searchInstrumentsAction(
  query: string,
): Promise<MarketActionResult<InstrumentSearchResult[]>> {
  const user = await requireUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  try {
    const results = await searchInstruments(query);
    return { data: results };
  } catch {
    return { error: "actions.couldNotSearch" };
  }
}

export async function fetchInstrumentQuoteAction(
  symbol: string,
): Promise<MarketActionResult<InstrumentQuote>> {
  const user = await requireUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  try {
    const quote = await fetchInstrumentQuote(symbol);
    return { data: quote };
  } catch {
    return { error: "actions.couldNotFetchPrice" };
  }
}

export async function estimateSharesAmountAction(
  symbol: string,
  shareCount: number,
): Promise<
  MarketActionResult<{
    amount: number;
    priceEur: number;
    priceOriginal: number;
    currency: string;
  }>
> {
  const user = await requireUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  if (!Number.isFinite(shareCount) || shareCount <= 0) {
    return { error: "actions.shareCountPositive" };
  }

  try {
    const quote = await fetchInstrumentQuoteInEur(symbol);
    return {
      data: {
        priceEur: quote.priceEur,
        priceOriginal: quote.priceOriginal,
        currency: quote.currency,
        amount: computeSharesAmount(shareCount, quote.priceEur),
      },
    };
  } catch {
    return { error: "actions.couldNotEstimate" };
  }
}

/**
 * Throw away the cached quotes and take fresh ones.
 *
 * `getCachedLiveQuotes` has tagged its cache `market-quotes` since it was
 * written and nothing has ever invalidated it — the five-minute window was
 * the only thing that did. This is the first use of that tag, which is also
 * why there is no local precedent to copy here.
 *
 * `updateTag`, not `revalidateTag(tag, "max")`. The "max" profile is
 * stale-while-revalidate: the next read is served the old entry while a fresh
 * one is fetched behind it, and Next does not even mark the page as changed —
 * so the button re-rendered yesterday's prices and said they were fresh.
 * `updateTag` expires the entry at once and re-renders the page in view with
 * what replaces it, which is the read-your-own-write a refresh button is.
 *
 * Auth-gated despite touching no rows: a cache invalidation is a lever on
 * work the server pays for, and an unauthenticated caller has no business
 * pulling it.
 */
export async function refreshQuotesAction(): Promise<
  MarketActionResult<{ refreshedAt: string }>
> {
  const user = await requireUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  updateTag("market-quotes");

  return { data: { refreshedAt: new Date().toISOString() } };
}
