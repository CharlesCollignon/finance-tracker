import { describe, expect, it } from "vitest";

import { rowEndIndex } from "./bearing-grid";
import { slotSpan, type TileSpan } from "./bearing-tiles";

/** The real span sequence — HEAD then REPEAT — for the first `n` slots. */
function spans(n: number): { span: TileSpan }[] {
  return Array.from({ length: n }, (_, i) => ({ span: slotSpan(i) }));
}

describe("rowEndIndex", () => {
  describe("at four columns", () => {
    it("ends the head row (hero, unit, unit = 4) when the open tile is in it", () => {
      const tiles = spans(8);
      // The hero itself, index 0.
      expect(rowEndIndex(tiles, 0, 4)).toBe(2);
    });

    it("ends a repeat row (wide, unit, unit = 4) when the open tile is in it", () => {
      const tiles = spans(8);
      // A unit inside the first repeat, index 4.
      expect(rowEndIndex(tiles, 4, 4)).toBe(5);
    });

    it("falls back to the last tile when no full row follows the open one", () => {
      // hero, unit, unit, wide, unit — a lone trailing unit with nothing to
      // pair with, so the running total (7) never lands on a multiple of 4
      // again before the tiles run out.
      const tiles = spans(5);
      expect(rowEndIndex(tiles, 4, 4)).toBe(4);
    });
  });

  describe("at two columns (the phone breakpoint)", () => {
    it("ends the head row (hero alone fills the row) when the open tile is the hero", () => {
      const tiles = spans(8);
      expect(rowEndIndex(tiles, 0, 2)).toBe(0);
    });

    it("ends a repeat row (unit, unit = 2) when the open tile is in it", () => {
      const tiles = spans(8);
      // Same unit as the four-column repeat-row case, index 4; at two
      // columns it pairs with the very next unit instead of the wide
      // before it.
      expect(rowEndIndex(tiles, 4, 2)).toBe(5);
    });

    it("falls back to the last tile when no full row follows the open one", () => {
      const tiles = spans(5);
      expect(rowEndIndex(tiles, 4, 2)).toBe(4);
    });
  });
});
