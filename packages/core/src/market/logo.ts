/**
 * Public logo CDN keyed by Yahoo-style symbols (AAPL, MC.PA, BTC-EUR).
 *
 * It answers with an SVG by default, which a browser draws and React
 * Native's `Image` cannot decode: on the phone every mark failed to load
 * and fell back to the category's icon. Asked for a PNG, it renders one at
 * the size given — the phone asks for 128 px, crisp on its 32-point disc at
 * 3x.
 */
export function instrumentLogoUrl(
  symbol: string,
  raster?: { size: number },
): string {
  const url = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol.trim())}`;
  return raster ? `${url}?format=png&size=${raster.size}` : url;
}
