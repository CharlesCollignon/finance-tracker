import { createYahooQuoteSource } from "@finance/core/market/quote-source";

/** The mobile app's live adapter for the instrument quote seam. */
export const quoteSource = createYahooQuoteSource();
