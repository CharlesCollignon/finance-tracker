"use server";

import {
  computeSharesAmount,
  fetchInstrumentQuote,
  searchInstruments,
  type InstrumentQuote,
  type InstrumentSearchResult,
} from "@finance/core/market/yahoo";
import { fetchInstrumentQuoteInEur } from "@finance/core/market/fx";
import { revalidateTag } from "next/cache";

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
    return { error: "Could not search instruments. Try again." };
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
    return { error: "Could not fetch the latest price. Try again." };
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
    return { error: "Share count must be a positive number" };
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
    return { error: "Could not estimate amount from current price." };
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
 * The second argument is not optional. Next 16 deprecated the one-argument
 * form and it is a type error in this version; `"max"` is the documented
 * stale-while-revalidate profile, which is what a refresh button wants — the
 * page re-renders immediately and the new prices land as they arrive rather
 * than the reader waiting on Yahoo.
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

  revalidateTag("market-quotes", "max");

  return { data: { refreshedAt: new Date().toISOString() } };
}
