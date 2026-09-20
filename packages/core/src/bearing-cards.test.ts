import { describe, expect, it } from "vitest";

import { BEARING_TILE_IDS, BEARING_TILES, type TileId } from "./bearing-tiles";
import {
  CARD_ORDER,
  CARD_FAMILY_BLOCKS,
  buildBearingCards,
  type BearingCard,
} from "./bearing-cards";
import type { BearingFact, BearingFacts } from "./bearing-facts";

const euro = (n: number) => `${n.toFixed(2)} €`;

function fact(
  id: TileId,
  family: BearingFact["family"],
  value = 100,
): BearingFact {
  return {
    id,
    family,
    label: id,
    unit: "money",
    value,
    sense: "up-is-good",
  };
}

function pack(facts: BearingFact[]): BearingFacts {
  return { asOf: "2026-09-20", facts, missing: [], thin: false };
}

describe("CARD_ORDER", () => {
  it("is the five families, headline families first", () => {
    expect(CARD_ORDER).toEqual(["month", "now", "run", "ahead", "wallet"]);
  });
});

describe("buildBearingCards", () => {
  it("puts every figure in its own family's card and nowhere else", () => {
    const facts = pack([
      fact("free", "month"),
      fact("committed", "month"),
      fact("on-hand", "now"),
      fact("streak", "run"),
      fact("runway-months", "ahead"),
      fact("wallet-cost", "wallet"),
    ]);

    const cards = buildBearingCards(facts, euro);
    const placed = cards.flatMap((card) => card.figures.map((f) => f.id));

    expect(placed).toHaveLength(6);
    expect(new Set(placed).size).toBe(6);
    expect(
      cards.find((c) => c.id === "month")!.figures.map((f) => f.id),
    ).toEqual(["free", "committed"]);
  });

  it("leads a card with its first figure, and formats it through the caller", () => {
    const cards = buildBearingCards(pack([fact("free", "month", 880.2)]), euro);
    const month = cards.find((c) => c.id === "month")!;

    expect(month.lead?.id).toBe("free");
    expect(month.lead?.display).toBe("880.20 €");
  });

  /**
   * The rule `bearing-tiles.ts` states in prose: a figure with nowhere
   * honest to lead leads nowhere, and a card may only offer destinations
   * its own figures already carry.
   */
  it("offers only destinations its figures actually carry", () => {
    const cards = buildBearingCards(
      pack([
        fact("free", "month"), // href null
        fact("committed", "month"), // /recurring
        fact("unrecorded-so-far", "month"), // /budgets
      ]),
      euro,
    );
    const month = cards.find((c) => c.id === "month")!;

    expect(month.destinations).toEqual(["/recurring", "/budgets"]);
    expect(month.figures.find((f) => f.id === "free")!.href).toBeNull();
  });

  it("drops a card with no figures rather than drawing an empty one", () => {
    const cards = buildBearingCards(pack([fact("on-hand", "now")]), euro);
    expect(cards.map((c) => c.id)).toEqual(["now"]);
  });
});

describe("the card model covers the whole vocabulary", () => {
  it("gives every family a block list", () => {
    for (const id of CARD_ORDER) {
      expect(CARD_FAMILY_BLOCKS[id].length).toBeGreaterThan(0);
    }
  });

  /**
   * The expensive blocks cost a fetch when a card opens. Each must appear on
   * exactly one card, or opening two cards pays twice for one answer.
   */
  it("puts each expensive block on exactly one card", () => {
    for (const block of ["month-read", "arrived-charges"] as const) {
      const carrying = CARD_ORDER.filter((id) =>
        CARD_FAMILY_BLOCKS[id].includes(block),
      );
      expect(carrying).toHaveLength(1);
    }
  });

  it("knows a href for every tile id the vocabulary has", () => {
    for (const id of BEARING_TILE_IDS) {
      expect(BEARING_TILES[id]).toBeDefined();
    }
  });
});
