import { describe, expect, it } from "vitest";

import { CARD_FAMILY_BLOCKS, CARD_ORDER } from "./bearing-cards";
import type { PanelBlock } from "./bearing-panels";

/**
 * The union, written out by hand so the test and the type have to agree.
 *
 * A `Record` rather than a `Set`, which is the difference between catching
 * one direction and catching both. A member dropped from `PanelBlock` stops
 * type-checking here; a member *added* to it leaves this record missing a key,
 * which also stops type-checking. A `Set<PanelBlock>` only caught the first,
 * and that gap is how `"ingredients"` survived from Task 3 to Task 5 — in the
 * union, in two block lists, drawn by neither client.
 */
const EVERY_BLOCK: Record<PanelBlock, true> = {
  "money-on-hand": true,
  "cash-accounts": true,
  "recent-on-account": true,
  "review-inbox": true,
  "arrived-charges": true,
  "spend-strip": true,
  "still-to-come": true,
  "month-read": true,
  "month-comparison": true,
  "budget-progress": true,
  "close-shelf": true,
  "month-score": true,
  trend: true,
  projection: true,
  wallets: true,
  "weight-bars": true,
  "fund-cost": true,
};

const BLOCKS: ReadonlySet<string> = new Set(Object.keys(EVERY_BLOCK));

describe("the block vocabulary", () => {
  it("names only blocks a card can ask for", () => {
    // `panelFor` used to be the thing that had to answer for every tile in
    // every family; one card per family means the whole question is
    // `CARD_FAMILY_BLOCKS`, and this is the half of it that lives in this
    // file's union rather than in that table.
    for (const id of CARD_ORDER) {
      for (const block of CARD_FAMILY_BLOCKS[id]) {
        expect(BLOCKS.has(block), `${id} -> ${block}`).toBe(true);
      }
    }
  });

  it("declares no block that no card draws", () => {
    // The other direction, and the one nothing checked. `"ingredients"` sat
    // in the union and in two block lists for two tasks, and every client
    // that reached it had to decide what to render for a block whose content
    // its projection card already drew. A union member no card reaches is a
    // question every renderer has to answer and nobody asked.
    const drawn = new Set<string>();
    for (const id of CARD_ORDER) {
      for (const block of CARD_FAMILY_BLOCKS[id]) {
        drawn.add(block);
      }
    }

    expect([...BLOCKS].filter((block) => !drawn.has(block))).toEqual([]);
  });
});
