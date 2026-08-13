/** Public logo CDN keyed by Yahoo-style symbols (AAPL, MC.PA, BTC-EUR). */
export function instrumentLogoUrl(symbol: string): string {
  return `https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol.trim())}`;
}
