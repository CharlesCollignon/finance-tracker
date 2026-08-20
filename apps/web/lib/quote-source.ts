import { createYahooQuoteSource } from "@finance/core/market/quote-source";

/** The web app's live adapter for the instrument quote seam. */
export const quoteSource = createYahooQuoteSource();
