import { describe, expect, it } from "vitest";

import { rowEndIndex } from "./bearing-grid";
import { slotSpan, type TileSpan } from "./bearing-tiles";

/**
 * The oracle is the browser, not the implementation.
 *
 * The first version of this file re-derived `rowEndIndex`'s own column-sum
 * arithmetic and then asserted the implementation agreed with it, so the test
 * and the code were two spellings of one assumption — which is why a real
 * layout bug (`hero` spans two rows; the sum never knew) passed a green
 * suite. Everything below is written against the layout CSS actually
 * produces instead, two ways:
 *
 * 1. A hand-written table of the real bento at four and at two columns, with
 *    the grid drawn out in a comment so a reader can check it by eye rather
 *    than by running anything.
 * 2. `placeDense` — an independent walk of a cell occupancy matrix, placing
 *    each tile at the first position where its column-by-row block fits,
 *    exactly as `grid-auto-flow: row dense` does — and `seamFor`, which
 *    reads the boundary off that placement. Plus the promise the module is
 *    actually for, asserted separately on the implementation's own answer:
 *    at the widths the app renders, every row above an opened panel is
 *    completely full.
 */

/** The real span sequence — HEAD then REPEAT — for the first `n` slots. */
function spans(n: number): { span: TileSpan }[] {
  return Array.from({ length: n }, (_, i) => ({ span: slotSpan(i) }));
}

interface Placement {
  /** The first and last row each tile occupies, zero-based. */
  tiles: { first: number; last: number }[];
  /** Cell occupancy, row by row. */
  cells: boolean[][];
}

/** How many columns and rows each span asks for, restated rather than imported. */
const COLUMNS_OF: Record<TileSpan, number> = { hero: 2, wide: 2, unit: 1 };
const ROWS_OF: Record<TileSpan, number> = { hero: 2, wide: 1, unit: 1 };

/**
 * CSS dense auto-placement, walked cell by cell.
 *
 * Deliberately naive: scan rows top to bottom, columns left to right, take
 * the first block of `columns x rows` free cells. That is the browser's own
 * rule for `grid-auto-flow: row dense`, and writing it out is what makes this
 * an oracle rather than a paraphrase of the code under test.
 */
function placeDense(
  tiles: readonly { span: TileSpan }[],
  columns: number,
): Placement {
  const cells: boolean[][] = [];

  const row = (index: number): boolean[] => {
    while (cells.length <= index) {
      cells.push(new Array<boolean>(columns).fill(false));
    }
    return cells[index]!;
  };

  const placed = tiles.map((tile) => {
    const width = Math.min(COLUMNS_OF[tile.span], columns);
    const height = ROWS_OF[tile.span];

    for (let top = 0; ; top += 1) {
      for (let left = 0; left + width <= columns; left += 1) {
        let fits = true;
        for (let r = top; r < top + height && fits; r += 1) {
          for (let c = left; c < left + width; c += 1) {
            if (row(r)[c]) {
              fits = false;
              break;
            }
          }
        }
        if (!fits) {
          continue;
        }
        for (let r = top; r < top + height; r += 1) {
          for (let c = left; c < left + width; c += 1) {
            row(r)[c] = true;
          }
        }
        return { first: top, last: top + height - 1 };
      }
    }
  });

  return { tiles: placed, cells };
}

/**
 * Where a full-width panel opened from `openIndex` has to go, read off the
 * placement above.
 *
 * The panel needs a row nobody is using, directly under the row its own tile
 * ends on. So: walk candidate rows from that one downwards and take the first
 * where the tiles split cleanly into "everything at or above the row" and
 * "everything starting below it" — a tile that straddles the line would be
 * cut in half by the panel, and a later tile that backfills above it would be
 * drawn before a panel it comes after. Falls back to the last tile when the
 * tiles run out first, since nothing can then fall into the space the panel
 * takes.
 */
function seamFor(
  tiles: readonly { span: TileSpan }[],
  openIndex: number,
  columns: number,
): number {
  const { tiles: placed, cells } = placeDense(tiles, columns);

  for (let seam = placed[openIndex]!.last; seam < cells.length; seam += 1) {
    const above = placed.filter((tile) => tile.last <= seam).length;
    const clean =
      above > 0 &&
      placed.slice(0, above).every((tile) => tile.last <= seam) &&
      placed.slice(above).every((tile) => tile.first > seam);

    if (clean) {
      return above - 1;
    }
  }

  return tiles.length - 1;
}

describe("rowEndIndex", () => {
  /*
   * Twelve tiles (`MAX_TILES`) at four columns is the desktop bento, and it
   * lays out like this — `hero` is the only tile two rows tall, which is the
   * whole difficulty:
   *
   *   row 0 | hero hero  u1   u2
   *   row 1 | hero hero  w3   w3
   *   row 2 |  u4   u5   w6   w6
   *   row 3 |  u7   u8   w9   w9
   *   row 4 | u10  u11    ·    ·
   *
   * So there are three seams — after index 3 (end of row 1), after 6 (row 2)
   * and after 9 (row 3) — and row 4 is a part row with nothing below it.
   */
  describe("at four columns", () => {
    const tiles = spans(12);

    it.each([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 6],
      [5, 6],
      [6, 6],
      [7, 9],
      [8, 9],
      [9, 9],
      [10, 11],
      [11, 11],
    ])("puts the panel for tile %i after tile %i", (open, expected) => {
      expect(rowEndIndex(tiles, open, 4)).toBe(expected);
    });

    it("does not strand a wide tile a whole row above its own panel", () => {
      // The regression this file exists for. `w6` sits in row 2; the column-sum
      // model answered 8, which puts the panel under row 3 with u7, u8 and w9
      // rendered between the tile and the panel explaining it.
      expect(rowEndIndex(tiles, 6, 4)).toBe(6);
      expect(rowEndIndex(tiles, 3, 4)).toBe(3);
      expect(rowEndIndex(tiles, 9, 4)).toBe(9);
    });

    it("falls back to the last tile when no full row follows the open one", () => {
      // hero, unit, unit, wide, unit — the trailing unit sits alone in row 2
      // with nothing below it to fall into the panel's space.
      expect(rowEndIndex(spans(5), 4, 4)).toBe(4);
    });
  });

  /*
   * At two columns `hero` fills two whole rows on its own, so every seam is a
   * row of its own and the sequence is one tile or two per row:
   *
   *   row 0 | hero hero      row 5 |  w6   w6
   *   row 1 | hero hero      row 6 |  u7   u8
   *   row 2 |  u1   u2       row 7 |  w9   w9
   *   row 3 |  w3   w3       row 8 | u10  u11
   *   row 4 |  u4   u5
   */
  describe("at two columns (the phone breakpoint)", () => {
    const tiles = spans(12);

    it.each([
      [0, 0],
      [1, 2],
      [2, 2],
      [3, 3],
      [4, 5],
      [5, 5],
      [6, 6],
      [7, 8],
      [8, 8],
      [9, 9],
      [10, 11],
      [11, 11],
    ])("puts the panel for tile %i after tile %i", (open, expected) => {
      expect(rowEndIndex(tiles, open, 2)).toBe(expected);
    });

    it("falls back to the last tile when no full row follows the open one", () => {
      expect(rowEndIndex(spans(5), 4, 2)).toBe(4);
    });
  });

  describe("against a cell-by-cell model of the CSS grid", () => {
    // Three and one are not breakpoints the app has; they are here because an
    // oracle that only ever sees the two shapes the template was designed for
    // cannot tell a correct model from a lucky one.
    const widths = [1, 2, 3, 4];

    it("agrees with dense auto-placement at every count and width", () => {
      for (const columns of widths) {
        for (let count = 1; count <= 14; count += 1) {
          const tiles = spans(count);
          for (let open = 0; open < count; open += 1) {
            expect(
              rowEndIndex(tiles, open, columns),
              `${count} tiles, ${columns} columns, opened at ${open}`,
            ).toBe(seamFor(tiles, open, columns));
          }
        }
      }
    });

    it("never places a panel above the row of the tile that opened it", () => {
      for (const columns of widths) {
        for (let count = 1; count <= 14; count += 1) {
          const tiles = spans(count);
          const { tiles: placed } = placeDense(tiles, columns);
          for (let open = 0; open < count; open += 1) {
            const seam = rowEndIndex(tiles, open, columns);
            // The panel lands on the first row after everything up to the
            // seam, so that is the row it has to clear.
            const lastRowAbove = Math.max(
              ...placed.slice(0, seam + 1).map((tile) => tile.last),
            );
            expect(
              lastRowAbove,
              `${count} tiles, ${columns} columns, opened at ${open}`,
            ).toBeGreaterThanOrEqual(placed[open]!.last);
            expect(seam).toBeGreaterThanOrEqual(open);
          }
        }
      }
    });

    it("leaves no half-filled row above the panel at either real width", () => {
      // The promise the module is named for, checked against the
      // implementation's own answer rather than against the oracle. Only at
      // the two widths `BearingGrid` renders: `HEAD`/`REPEAT` pack exactly at
      // two and at four columns and at no other count, so at three the bento
      // has holes with or without a panel in it.
      for (const columns of [2, 4]) {
        for (let count = 1; count <= 14; count += 1) {
          const tiles = spans(count);
          for (let open = 0; open < count; open += 1) {
            const seam = rowEndIndex(tiles, open, columns);
            if (seam === count - 1) {
              // Appended after the last tile: a part row is expected, because
              // there is nothing left to fill it or to fall into the panel.
              continue;
            }
            const { cells } = placeDense(tiles.slice(0, seam + 1), columns);
            expect(
              cells.every((row) => row.every(Boolean)),
              `${count} tiles, ${columns} columns, opened at ${open}`,
            ).toBe(true);
          }
        }
      }
    });
  });
});
