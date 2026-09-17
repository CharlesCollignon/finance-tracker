/**
 * Where a full-width panel can enter the bento without punching a hole in it.
 *
 * `bearing-tiles.ts` chose `HEAD` and `REPEAT` precisely so the grid fills
 * whole rows exactly at four columns and at two. A panel is a new element
 * inserted into that same dense grid, `grid-column: 1 / -1`, so it inherits
 * the same obligation: it may only land on a row boundary, never mid-row, or
 * the tiles after it would auto-flow into the gap it left behind rather than
 * the hole it was meant to avoid.
 *
 * The boundary is found by placing the tiles the way the browser places them
 * — `grid-auto-flow: row dense`, each tile taking the first position where
 * its column *and row* span fit — rather than by adding up column spans. The
 * arithmetic version was tried and shipped and was wrong: `hero` is
 * `col-span-2 row-span-2`, so a model that advances one row per row's worth
 * of columns drifts a row short of the real layout from the second row
 * onward, and every `wide` tile opened its panel a full row too low with
 * unrelated tiles rendered in between. Dense backfill hides that as a
 * misplacement rather than a gap, which is why it survived both a green
 * suite and a human looking for holes.
 *
 * Pure and tested here rather than eyeballed in a browser, because a wrong
 * answer is a panel under somebody else's row on a screen that already has
 * twelve cards of varying size on it — and the failure looks like a layout
 * choice rather than a bug.
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
 * How many grid rows a span claims.
 *
 * Only `hero` is taller than one row, and that single exception is the whole
 * reason this map has to exist: it is what `BearingGrid`'s `row-span-2`
 * actually does to the layout, and leaving it out of the model is the defect
 * the module comment above describes.
 */
export const SPAN_ROWS: Record<TileSpan, number> = {
  hero: 2,
  wide: 1,
  unit: 1,
};

/**
 * The last row each tile occupies, zero-based, as CSS would place them.
 *
 * A cell occupancy walk rather than a sum, because dense auto-placement is
 * about cells: each tile takes the first row-then-column position whose
 * `columns x rows` block is entirely free, and a later small tile may
 * backfill a hole an earlier large one stepped over. Nothing cheaper models
 * that faithfully, and "cheaper but only correct for the spans we happen to
 * ship today" is how the previous version of this file went wrong.
 *
 * A span wider than the grid is clamped to the grid, which is what CSS does
 * with `grid-column: span 2` in a one-column grid.
 */
function placeRows(
  tiles: readonly { span: TileSpan }[],
  columns: number,
): number[] {
  const grid: boolean[][] = [];

  const cellsIn = (row: number): boolean[] => {
    while (grid.length <= row) {
      grid.push(new Array<boolean>(columns).fill(false));
    }
    return grid[row]!;
  };

  const free = (
    row: number,
    column: number,
    columnSpan: number,
    rowSpan: number,
  ): boolean => {
    for (let r = row; r < row + rowSpan; r += 1) {
      const cells = cellsIn(r);
      for (let c = column; c < column + columnSpan; c += 1) {
        if (cells[c]) {
          return false;
        }
      }
    }
    return true;
  };

  return tiles.map((tile) => {
    const columnSpan = Math.min(SPAN_COLUMNS[tile.span], columns);
    const rowSpan = SPAN_ROWS[tile.span];

    // An empty row always fits, so this terminates on the first row past
    // everything already placed even when nothing earlier had room.
    for (let row = 0; ; row += 1) {
      for (let column = 0; column + columnSpan <= columns; column += 1) {
        if (!free(row, column, columnSpan, rowSpan)) {
          continue;
        }
        for (let r = row; r < row + rowSpan; r += 1) {
          const cells = cellsIn(r);
          for (let c = column; c < column + columnSpan; c += 1) {
            cells[c] = true;
          }
        }
        return row + rowSpan - 1;
      }
    }
  });
}

/**
 * The index after which a full-width panel may be inserted without a hole.
 *
 * A panel opened by a tile belongs directly under the row that tile is in, so
 * this looks for the first *seam* at or after the last row the pressed tile
 * occupies — "at or after" because a tile beside a two-row `hero` shares a
 * row with a tile that has not finished yet, and a panel cannot cut through
 * one. A seam is an index where every tile up to and including it ends on or
 * above the seam's row and every tile after it begins below: the panel then
 * has a whole row of its own, with nothing backfilling above it and nothing
 * left dangling behind it.
 *
 * `columns` is a parameter, not a constant, because the grid is not always
 * the same width: four columns on desktop, two on a phone
 * (`grid-cols-2 md:grid-cols-4` in `BearingGrid`), and the two counts do not
 * agree on where a row ends. A caller that only ever passed `4` would be
 * correct on desktop and wrong on every phone.
 *
 * Falls back to the last tile when no seam remains after the pressed one —
 * an odd tile count can end mid-row, and a panel appended after the very
 * last tile still cannot leave a hole, since nothing comes after it to fall
 * into one.
 */
export function rowEndIndex(
  tiles: readonly { span: TileSpan }[],
  openIndex: number,
  columns: number,
): number {
  const last = tiles.length - 1;
  if (openIndex < 0 || openIndex > last) {
    return last;
  }

  const rows = placeRows(tiles, columns);

  for (let seam = rows[openIndex]!; ; seam += 1) {
    const firstBelow = rows.findIndex((row) => row > seam);
    if (firstBelow < 0) {
      return last;
    }
    // Everything after the candidate has to be below the seam too: dense
    // packing is free to drop a later `unit` into a hole an earlier row still
    // has, and a tile that backfills above the panel would be drawn before a
    // panel it comes after.
    if (firstBelow > 0 && rows.slice(firstBelow).every((row) => row > seam)) {
      return firstBelow - 1;
    }
  }
}
