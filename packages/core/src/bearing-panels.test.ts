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

const BLOCKS: ReadonlySet<string> = new Set<PanelBlock>([
  "money-on-hand",
  "cash-accounts",
  "recent-on-account",
  "review-inbox",
  "spend-strip",
  "still-to-come",
  "month-read",
  "month-comparison",
  "budget-progress",
  "close-shelf",
  "month-score",
  "trend",
  "projection",
  "ingredients",
  "wallets",
  "weight-bars",
  "fund-cost",
]);

describe("panelFor", () => {
  it("gives a month tile the scope chrome, because it is the only family that needs it", () => {
    expect(panelFor("free", "month").chrome).toBe("month-scope");
    expect(panelFor("on-hand", "now").chrome).toBe("none");
    expect(panelFor("wallet-return", "wallet").chrome).toBe("none");
  });

  it("explains one figure, not a whole family", () => {
    const free = panelFor("free", "month").blocks;
    const rate = panelFor("savings-rate", "month").blocks;

    expect(free).toEqual(["spend-strip", "still-to-come", "month-read"]);
    expect(rate).toEqual(["month-comparison", "spend-strip"]);
    expect(free).not.toEqual(rate);
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
