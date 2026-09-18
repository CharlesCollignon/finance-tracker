import { describe, expect, it } from "vitest";

import { BEARING_TILE_IDS } from "./bearing-tiles";
import type { FactFamily } from "./bearing-facts";
import { panelFor, type PanelBlock } from "./bearing-panels";

const FAMILIES: readonly FactFamily[] = [
  "now",
  "month",
  "run",
  "ahead",
  "wallet",
];

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

describe("panelFor", () => {
  it("gives a month tile the scope chrome, because it is the only family that needs it", () => {
    expect(panelFor("free", "month").chrome).toBe("month-scope");
    expect(panelFor("on-hand", "now").chrome).toBe("none");
    expect(panelFor("wallet-return", "wallet").chrome).toBe("none");
  });

  it("explains one figure, not a whole family", () => {
    const free = panelFor("free", "month").blocks;
    const rate = panelFor("savings-rate", "month").blocks;

    expect(free).toEqual([
      "arrived-charges",
      "spend-strip",
      "still-to-come",
      "month-read",
    ]);
    expect(rate).toEqual(["month-comparison", "spend-strip"]);
    expect(free).not.toEqual(rate);
  });

  it("puts the fulfilment question on both tiles that could greet the reader, and first on each", () => {
    // Retired Month rendered its "Needs you" slot above everything else, on
    // the reasoning that a question in front of the reader outranks the
    // figures beneath it — and it did so unconditionally, on a screen opened
    // daily. `free` alone is not that: it is itself absent whenever
    // `pulse.free` is null, so a reader with nothing "left" to see would
    // have no tile telling them a charge is waiting. `arriving` — literally
    // the tile about charges due — carries the same block for that reason.
    const withArrivedCharges = BEARING_TILE_IDS.filter((id) =>
      panelFor(id, "month").blocks.includes("arrived-charges"),
    );

    expect(withArrivedCharges).toEqual(["free", "arriving"]);
    expect(panelFor("free", "month").blocks[0]).toBe("arrived-charges");
    expect(panelFor("arriving", "month").blocks[0]).toBe("arrived-charges");
  });

  it("names the month read on one tile, not on the month family", () => {
    // The read costs a dozen reads to gather, so the tile that shows it is
    // the tile that pays for it. If this ever becomes a family default,
    // `gatherPanelDetail` starts charging every month panel for it.
    const withRead = BEARING_TILE_IDS.filter((id) =>
      panelFor(id, "month").blocks.includes("month-read"),
    );

    expect(withRead).toEqual(["free"]);
  });

  it("falls back to the family's own blocks for a tile with no mapping", () => {
    expect(panelFor("wallet-return", "wallet").blocks).toEqual([
      "wallets",
      "weight-bars",
    ]);
  });

  it("opens the review inbox in place, because that decision is actionable here", () => {
    expect(panelFor("inbox-pending", "now").blocks).toEqual(["review-inbox"]);
  });

  it("keeps the tile's own href for the footer link", () => {
    expect(panelFor("inbox-pending", "now").href).toBe(
      "/transactions?review=inbox",
    );
    expect(panelFor("net-position", "now").href).toBeNull();
  });
});

describe("totality", () => {
  it("answers for every tile in every family, with blocks it actually declares", () => {
    for (const id of BEARING_TILE_IDS) {
      for (const family of FAMILIES) {
        const spec = panelFor(id, family);

        expect(spec.blocks.length).toBeGreaterThan(0);
        for (const block of spec.blocks) {
          expect(BLOCKS.has(block)).toBe(true);
        }
      }
    }
  });

  it("declares no block that no panel draws", () => {
    // The other direction, and the one nothing checked. `"ingredients"` sat
    // in the union and in two block lists for two tasks, and every client
    // that reached it had to decide what to render for a block whose content
    // its projection card already drew. A union member no panel reaches is a
    // question every renderer has to answer and nobody asked.
    const drawn = new Set<string>();
    for (const id of BEARING_TILE_IDS) {
      for (const family of FAMILIES) {
        for (const block of panelFor(id, family).blocks) {
          drawn.add(block);
        }
      }
    }

    expect([...BLOCKS].filter((block) => !drawn.has(block))).toEqual([]);
  });

  it("takes its chrome from the family, never from the tile", () => {
    for (const id of BEARING_TILE_IDS) {
      expect(panelFor(id, "month").chrome).toBe("month-scope");
      expect(panelFor(id, "run").chrome).toBe("streak");
      expect(panelFor(id, "ahead").chrome).toBe("horizon");
      expect(panelFor(id, "now").chrome).toBe("none");
      expect(panelFor(id, "wallet").chrome).toBe("none");
    }
  });
});
