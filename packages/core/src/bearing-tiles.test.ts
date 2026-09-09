import { describe, expect, it } from "vitest";

import type { BearingFact, BearingFacts, FactFamily } from "./bearing-facts";
import {
  BEARING_TILES,
  BEARING_TILE_IDS,
  defaultArrangement,
  isTileId,
  MAX_TILES,
  mergeArrangement,
  slotSpan,
  type TileId,
} from "./bearing-tiles";

const FAMILIES: Record<string, FactFamily> = {
  "net-position": "now",
  "on-hand": "now",
  invested: "now",
  "inbox-pending": "now",
  free: "month",
  "unrecorded-over": "month",
  "savings-rate": "month",
  "projected-balance": "ahead",
  "runway-months": "ahead",
  streak: "run",
  "wallet-return": "wallet",
  "wallet-drift": "wallet",
  "wallet-drag": "wallet",
};

function pack(ids: string[]): BearingFacts {
  return {
    asOf: "2026-09-09",
    facts: ids.map(
      (id): BearingFact => ({
        id,
        family: FAMILIES[id] ?? "now",
        label: id,
        unit: "money",
        value: 1,
        sense: "neutral",
      }),
    ),
    missing: [],
    thin: false,
  };
}

describe("the tile catalogue", () => {
  it("gives every tile a destination decision", () => {
    for (const id of BEARING_TILE_IDS) {
      expect(BEARING_TILES).toHaveProperty(id);
    }
    expect(Object.keys(BEARING_TILES)).toHaveLength(BEARING_TILE_IDS.length);
  });

  it("rejects an id that is not a tile", () => {
    expect(isTileId("net-position")).toBe(true);
    expect(isTileId("top-expense:c4")).toBe(false);
  });
});

describe("slotSpan", () => {
  it("opens with a hero, two units and a wide", () => {
    expect([0, 1, 2, 3].map(slotSpan)).toEqual([
      "hero",
      "unit",
      "unit",
      "wide",
    ]);
  });

  it("repeats a full four-column row forever", () => {
    // Two units and a wide is exactly one row of four. Whatever the tile
    // count, the grid packs without a hole.
    expect([4, 5, 6, 7, 8, 9].map(slotSpan)).toEqual([
      "unit",
      "unit",
      "wide",
      "unit",
      "unit",
      "wide",
    ]);
  });
});

describe("defaultArrangement", () => {
  it("leads with what is wrong, not with what is healthy", () => {
    const order = defaultArrangement(
      pack(["net-position", "savings-rate", "unrecorded-over", "inbox-pending"]),
    );

    expect(order.slice(0, 2)).toEqual(["unrecorded-over", "inbox-pending"]);
  });

  it("only names figures the pack actually carries", () => {
    const order = defaultArrangement(pack(["net-position", "free"]));

    expect(order).toEqual(["net-position", "free"]);
  });

  it("ignores datums that are not tiles", () => {
    expect(defaultArrangement(pack(["net-position", "top-expense:c4"]))).toEqual(
      ["net-position"],
    );
  });

  it("falls back to family order once the priorities are placed", () => {
    const order = defaultArrangement(
      pack(["wallet-drag", "on-hand", "streak", "runway-months"]),
    );

    expect(order).toEqual([
      "on-hand",
      "runway-months",
      "streak",
      "wallet-drag",
    ]);
  });

  it("is total, so a pin at a late slot has a list long enough to reach it", () => {
    const ids = [...BEARING_TILE_IDS] as string[];

    expect(defaultArrangement(pack(ids))).toHaveLength(ids.length);
  });
});

describe("mergeArrangement", () => {
  const facts = pack([
    "net-position",
    "free",
    "invested",
    "savings-rate",
    "wallet-return",
  ]);

  it("uses the proposal when nothing is pinned", () => {
    const order = mergeArrangement(
      ["wallet-return", "free", "net-position"],
      {},
      facts,
    );

    expect(order.slice(0, 3)).toEqual(["wallet-return", "free", "net-position"]);
  });

  it("holds a pinned tile in its slot against the proposal", () => {
    // The bargain of a draggable surface: a model that reshuffles a choice
    // somebody just made with their finger is the feature undoing its point.
    const order = mergeArrangement(
      ["wallet-return", "free", "net-position"],
      { invested: 0 },
      facts,
    );

    expect(order[0]).toBe("invested");
    expect(order.slice(1, 3)).toEqual(["wallet-return", "free"]);
  });

  it("never lists a tile twice when the proposal names a pinned one", () => {
    const order = mergeArrangement(
      ["invested", "free"],
      { invested: 2 },
      facts,
    );

    expect(order.filter((id) => id === "invested")).toHaveLength(1);
    expect(order[2]).toBe("invested");
  });

  it("falls back to the app's own order when the model names nothing", () => {
    expect(mergeArrangement([], {}, facts)).toEqual(defaultArrangement(facts));
  });

  it("completes a short proposal rather than leaving slots empty", () => {
    const order = mergeArrangement(["wallet-return"], {}, facts);

    expect(order[0]).toBe("wallet-return");
    expect(order).toHaveLength(facts.facts.length);
  });

  it("drops a pin for a figure the pack no longer carries", () => {
    // Disconnecting a bank should not leave a hole where the balance was.
    const order = mergeArrangement([], { "on-hand": 0 }, facts);

    expect(order).not.toContain("on-hand");
    expect(order).toHaveLength(facts.facts.length);
  });

  it("ignores a pin naming something that is not a tile", () => {
    const order = mergeArrangement([], { "top-expense:c4": 0 }, facts);

    expect(order).toEqual(defaultArrangement(facts));
  });

  it("ignores a slot index outside the grid", () => {
    for (const slot of [-1, 1.5, MAX_TILES, 999]) {
      const order = mergeArrangement([], { invested: slot }, facts);
      expect(order).toEqual(defaultArrangement(facts));
    }
  });

  it("keeps the list dense when a pin points past the end", () => {
    const short = pack(["net-position", "free"]);
    const order = mergeArrangement([], { free: 9 }, short);

    expect(order).toEqual(["net-position", "free"]);
  });

  it("settles two pins fighting over one slot without dropping either", () => {
    // Cannot arise from the surface, which writes pins from a dense rendered
    // list, but a stored blob is not a shape this can assume. First one in
    // takes the slot and the other is placed rather than discarded — the
    // point is only that the outcome is deterministic and loses nothing.
    const order = mergeArrangement([], { invested: 1, free: 1 }, facts);

    expect(order[1]).toBe("invested");
    expect(order).toContain("free");
    expect(new Set(order).size).toBe(order.length);
  });

  it("never shows more than the grid holds", () => {
    const everything = pack([...BEARING_TILE_IDS] as string[]);

    expect(mergeArrangement([], {}, everything)).toHaveLength(MAX_TILES);
  });

  it("places every tile it returns exactly once", () => {
    const everything = pack([...BEARING_TILE_IDS] as string[]);
    const order = mergeArrangement(
      ["wallet-drag", "streak"],
      { "net-position": 3, invested: 0 },
      everything,
    );

    expect(new Set<TileId>(order).size).toBe(order.length);
    expect(order[0]).toBe("invested");
    expect(order[3]).toBe("net-position");
  });
});
