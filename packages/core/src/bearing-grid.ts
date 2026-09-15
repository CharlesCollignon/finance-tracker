/**
 * Where a full-width panel can enter the bento without punching a hole in it.
 *
 * `bearing-tiles.ts` chose `HEAD` and `REPEAT` precisely so "every row is
 * exactly full at four columns, so no reordering can leave a hole." A panel
 * is a new element inserted into that same dense grid, `grid-column: 1 / -1`,
 * so it inherits the same obligation: it may only land on a row boundary,
 * never mid-row, or the tiles after it would auto-flow into the gap it left
 * behind rather than the hole it was meant to avoid.
 *
 * The row boundary is derived from the spans rather than tracked separately,
 * because the spans are the one thing already guaranteed to sum to a whole
 * number of columns at the end of every row — that guarantee is the entire
 * point of `HEAD`/`REPEAT`, and re-deriving from it means this function can
 * never disagree with the grid it is placing a panel into.
 *
 * Pure and tested here rather than eyeballed in a browser, because a wrong
 * answer is a hole in the bento, and a hole is exactly the failure a human
 * clicking around a dev server is least likely to notice on a screen that
 * already has twelve cards of varying size on it.
 */

import type { TileSpan } from "./bearing-tiles";

/**
 * How many grid columns a span claims.
 *
 * Column counts, not fractions of whatever width the grid happens to have —
 * `hero` and `wide` both claim two columns whether the grid has two or four,
 * which is exactly why the same map serves both the four-column desktop grid
 * and the two-column phone one.
 */
export const SPAN_COLUMNS: Record<TileSpan, number> = {
  hero: 2,
  wide: 2,
  unit: 1,
};

/**
 * The index after which a full-width panel may be inserted without a hole.
 *
 * Walks the tiles in order, accumulating the columns each one claims. Every
 * time that running total lands on a multiple of `columns`, the tiles seen
 * so far exactly fill whole rows — a safe seam. The first such seam at or
 * after `openIndex` is where the panel goes, since a panel opened by a tile
 * belongs directly under the row that tile is in, not above it.
 *
 * `columns` is a parameter, not a constant, because the grid is not always
 * the same width: four columns on desktop, two on a phone
 * (`grid-cols-2 md:grid-cols-4` in `BearingGrid`), and the two counts do not
 * agree on where a row ends. A caller that only ever passed `4` would be
 * correct on desktop and wrong on every phone.
 *
 * Falls back to the last tile when no full row remains after `openIndex` —
 * an odd tile count can end mid-row, and a panel appended after the very
 * last tile still cannot leave a hole, since nothing comes after it to fall
 * into one.
 */
export function rowEndIndex(
  tiles: readonly { span: TileSpan }[],
  openIndex: number,
  columns: number,
): number {
  let claimed = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    claimed += SPAN_COLUMNS[tiles[i]!.span];
    if (claimed % columns === 0 && i >= openIndex) {
      return i;
    }
  }
  return tiles.length - 1;
}
