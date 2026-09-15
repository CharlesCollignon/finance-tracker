import { describe, expect, it } from "vitest";

import { BEARING_TILE_IDS, type TileId } from "./bearing-tiles";
import type { FactFamily } from "./bearing-facts";
import { panelFor } from "./bearing-panels";

const FAMILY_OF: Record<string, FactFamily> = {
  free: "month",
  "savings-rate": "month",
  "inbox-pending": "now",
  "on-hand": "now",
  streak: "run",
  "projected-kept": "ahead",
  "wallet-return": "wallet",
};

describe("panelFor", () => {
  it("gives a month tile the scope chrome, because it is the only family that needs it", () => {
    expect(panelFor("free", "month").chrome).toBe("month-scope");
    expect(panelFor("on-hand", "now").chrome).toBe("none");
    expect(panelFor("wallet-return", "wallet").chrome).toBe("none");
  });

  it("explains one figure, not a whole family", () => {
    const free = panelFor("free", "month").blocks;
    const rate = panelFor("savings-rate", "month").blocks;

    expect(free).toEqual(["spend-strip", "still-to-come"]);
    expect(rate).toEqual(["month-comparison", "spend-strip"]);
    expect(free).not.toEqual(rate);
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

  it("answers for every tile the Bearing can show", () => {
    for (const id of BEARING_TILE_IDS) {
      const spec = panelFor(id as TileId, FAMILY_OF[id] ?? "now");
      expect(spec.blocks.length).toBeGreaterThan(0);
    }
  });
});
