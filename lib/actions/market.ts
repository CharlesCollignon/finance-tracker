"use server";

import {
  computeSharesAmount,
  fetchInstrumentQuote,
  searchInstruments,
  type InstrumentQuote,
  type InstrumentSearchResult,
} from "@/lib/market/yahoo";
import { createClient } from "@/lib/supabase/server";

type MarketActionResult<T> =
  | { error: string }
  | { data: T };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function searchInstrumentsAction(
  query: string,
): Promise<MarketActionResult<InstrumentSearchResult[]>> {
  const user = await requireUser();
  if (!user) {
    return { error: "Not authenticated" };
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
    return { error: "Not authenticated" };
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
): Promise<MarketActionResult<{ amount: number; price: number }>> {
  const user = await requireUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!Number.isInteger(shareCount) || shareCount <= 0) {
    return { error: "Share count must be a positive whole number" };
  }

  try {
    const quote = await fetchInstrumentQuote(symbol);
    return {
      data: {
        price: quote.price,
        amount: computeSharesAmount(shareCount, quote.price),
      },
    };
  } catch {
    return { error: "Could not estimate amount from current price." };
  }
}

export async function resolveSharesPricing(
  symbol: string,
  shareCount: number,
): Promise<
  | { error: string }
  | {
      amount: number;
      price: number;
      quotedAt: string;
    }
> {
  try {
    const quote = await fetchInstrumentQuote(symbol);
    return {
      amount: computeSharesAmount(shareCount, quote.price),
      price: quote.price,
      quotedAt: new Date().toISOString(),
    };
  } catch {
    return { error: "Could not fetch a live price for this instrument." };
  }
}
