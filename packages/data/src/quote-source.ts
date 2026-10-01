import { createYahooQuoteSource } from "@finance/core/market/quote-source";

/**
 * The live adapter for the instrument quote seam, one per app process.
 *
 * Shared rather than created by each caller, so a fill and the Placements
 * read in the same request use the same five-minute cache instead of each
 * asking the market on its own.
 */
export const quoteSource = createYahooQuoteSource();
