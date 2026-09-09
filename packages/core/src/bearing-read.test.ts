import { describe, expect, it } from "vitest";

import type { BearingFact, BearingFacts } from "./bearing-facts";
import {
  arrangementFooting,
  MAX_CAPTION_LENGTH,
  renderArrangement,
  verifyArrangement,
  type Arrangement,
} from "./bearing-read";
import { buildArrangementPrompt } from "./bearing-prompt";
import { MAX_TILES, type TileId } from "./bearing-tiles";

function fact(id: string, partial: Partial<BearingFact> = {}): BearingFact {
  return {
    id,
    family: "now",
    label: id,
    unit: "money",
    value: 1234,
    sense: "neutral",
    ...partial,
  };
}

const facts: BearingFacts = {
  asOf: "2026-09-09",
  facts: [
    fact("net-position", { label: "Everything, added up" }),
    fact("on-hand", { label: "In the accounts" }),
    fact("unrecorded-over", { sense: "up-is-bad", value: 62.4 }),
    fact("wallet-return", { unit: "percent", value: 7.4, family: "wallet" }),
    fact("streak", { unit: "count", value: 3, family: "run" }),
  ],
  missing: [
    { id: "wallet-drift", label: "Furthest a wallet is", why: "no-target" },
  ],
  thin: false,
};

function answer(tiles: unknown[]) {
  return { tiles };
}

describe("verifyArrangement", () => {
  describe("what is fatal", () => {
    it("refuses an answer that is not the shape asked for", () => {
      expect(verifyArrangement({ order: ["on-hand"] }, facts)).toMatchObject({
        ok: false,
        reason: "unreadable",
      });
    });

    it("refuses a tile id that is not in the catalogue", () => {
      // The catalogue is closed and was handed over in full. Naming something
      // outside it means the model ignored a list it was just given, and the
      // rest of the answer is worth no more trust than that.
      const verdict = verifyArrangement(
        answer([{ id: "cash-flow-vibes" }]),
        facts,
      );

      expect(verdict).toMatchObject({ ok: false, reason: "unknown-datum" });
    });

    it("refuses a real tile this person's pack does not carry", () => {
      const verdict = verifyArrangement(answer([{ id: "runway-months" }]), facts);

      expect(verdict).toMatchObject({ ok: false, reason: "unknown-datum" });
    });

    it("refuses a tile named among the figures it was told it cannot have", () => {
      expect(
        verifyArrangement(answer([{ id: "wallet-drift" }]), facts),
      ).toMatchObject({ ok: false, reason: "unknown-datum" });
    });

    it("refuses a caption citing a datum that was never sent", () => {
      const verdict = verifyArrangement(
        answer([
          {
            id: "on-hand",
            caption: "under {{fact:rent}}",
            basis: ["rent"],
          },
        ]),
        facts,
      );

      expect(verdict).toMatchObject({ ok: false, reason: "unknown-datum" });
    });
  });

  describe("what is only dropped", () => {
    it("keeps the tile and loses a caption that writes its own figure", () => {
      const verdict = verifyArrangement(
        answer([{ id: "on-hand", caption: "about 400 euros left" }]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.arrangement.tiles).toEqual([
        { id: "on-hand", caption: null, basis: [] },
      ]);
      expect(verdict.dropped[0]).toMatchObject({ why: "figure" });
    });

    it("catches a spelled-out figure as readily as a digit", () => {
      const verdict = verifyArrangement(
        answer([{ id: "on-hand", caption: "down by a third" }]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.dropped[0]).toMatchObject({ why: "figure" });
    });

    it("drops a caption whose placeholder is not declared", () => {
      const verdict = verifyArrangement(
        answer([
          { id: "on-hand", caption: "beside {{fact:streak}}", basis: [] },
        ]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.dropped[0]).toMatchObject({
        why: "unbacked-placeholder",
      });
    });

    it("drops a caption that would not fit the tile", () => {
      const verdict = verifyArrangement(
        answer([{ id: "on-hand", caption: "x".repeat(MAX_CAPTION_LENGTH + 1) }]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.dropped[0]).toMatchObject({ why: "too-long" });
    });

    it("measures a caption as a reader sees it, not as it is written", () => {
      // A placeholder is 27 characters of markup that render as about eight.
      // Charging a caption for the markup would punish it for citing figures.
      const verdict = verifyArrangement(
        answer([
          {
            id: "on-hand",
            caption: "over {{fact:unrecorded-over}}",
            basis: ["unrecorded-over"],
          },
        ]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.dropped).toEqual([]);
      expect(verdict.arrangement.tiles[0]!.caption).toBe(
        "over {{fact:unrecorded-over}}",
      );
    });
  });

  describe("leniency", () => {
    it("accepts a basis written in the placeholder form it was just taught", () => {
      const verdict = verifyArrangement(
        answer([
          {
            id: "on-hand",
            caption: "over {{fact:streak}}",
            basis: ["{{fact:streak}}"],
          },
        ]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.arrangement.tiles[0]!.basis).toEqual(["streak"]);
    });

    it("ignores a repeated tile rather than refusing the answer", () => {
      const verdict = verifyArrangement(
        answer([{ id: "on-hand" }, { id: "on-hand" }, { id: "streak" }]),
        facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.arrangement.tiles.map((t) => t.id)).toEqual([
        "on-hand",
        "streak",
      ]);
    });

    it("never keeps more tiles than the grid holds", () => {
      const many = {
        ...facts,
        facts: Array.from({ length: 20 }, (_, index) =>
          fact(`net-position`, { label: `${index}` }),
        ),
      };
      const verdict = verifyArrangement(
        answer(Array.from({ length: 40 }, () => ({ id: "net-position" }))),
        many,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.arrangement.tiles.length).toBeLessThanOrEqual(MAX_TILES);
    });
  });

  it("keeps the order the model chose", () => {
    const verdict = verifyArrangement(
      answer([{ id: "streak" }, { id: "net-position" }, { id: "on-hand" }]),
      facts,
    );

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.arrangement.tiles.map((t) => t.id)).toEqual([
      "streak",
      "net-position",
      "on-hand",
    ]);
  });
});

describe("renderArrangement", () => {
  const arrangement: Arrangement = {
    tiles: [
      {
        id: "on-hand",
        caption: "over {{fact:unrecorded-over}}",
        basis: ["unrecorded-over"],
      },
      { id: "streak", caption: null, basis: [] },
    ],
  };

  const order: TileId[] = ["on-hand", "streak"];
  const money = (amount: number) => `${amount} EUR`;

  it("substitutes the app's own value for every placeholder", () => {
    const [first] = renderArrangement(order, arrangement, facts, money);

    expect(first!.caption).toEqual([
      { kind: "text", text: "over " },
      {
        kind: "figure",
        factId: "unrecorded-over",
        label: "unrecorded-over",
        display: "62.4 EUR",
      },
    ]);
  });

  it("takes the span from the slot, never from the model", () => {
    const rendered = renderArrangement(order, arrangement, facts, money);

    expect(rendered.map((tile) => tile.span)).toEqual(["hero", "unit"]);
  });

  it("renders against the figures as they stand now", () => {
    // A stored figure sitting beside a fresh one is a visible
    // self-contradiction on a single screen.
    const moved: BearingFacts = {
      ...facts,
      facts: facts.facts.map((row) =>
        row.id === "unrecorded-over" ? { ...row, value: 99 } : row,
      ),
    };
    const [first] = renderArrangement(order, arrangement, moved, money);

    expect(first!.caption![1]).toMatchObject({ display: "99 EUR" });
  });

  it("drops a caption whose figure has since gone", () => {
    const without: BearingFacts = {
      ...facts,
      facts: facts.facts.filter((row) => row.id !== "unrecorded-over"),
    };
    const [first] = renderArrangement(order, arrangement, without, money);

    expect(first!.caption).toBeNull();
    expect(first!.display).toBe("1234 EUR");
  });

  it("skips a tile whose figure has gone entirely", () => {
    const without: BearingFacts = {
      ...facts,
      facts: facts.facts.filter((row) => row.id !== "streak"),
    };

    expect(renderArrangement(order, arrangement, without, money)).toHaveLength(
      1,
    );
  });

  it("carries the datum's note onto the tile", () => {
    const noted: BearingFacts = {
      ...facts,
      facts: facts.facts.map((row) =>
        row.id === "on-hand" ? { ...row, note: "no debts are recorded" } : row,
      ),
    };
    const [first] = renderArrangement(order, arrangement, noted, money);

    expect(first!.note).toBe("no debts are recorded");
  });

  it("renders the app's own order with no arrangement at all", () => {
    const rendered = renderArrangement(order, null, facts, money);

    expect(rendered).toHaveLength(2);
    expect(rendered.every((tile) => tile.caption === null)).toBe(true);
  });
});

describe("arrangementFooting", () => {
  it("counts the chosen tiles and what their captions cite", () => {
    const footing = arrangementFooting({
      tiles: [
        { id: "on-hand", caption: "x {{fact:streak}}", basis: ["streak"] },
        { id: "net-position", caption: null, basis: [] },
      ],
    });

    expect(new Set(footing)).toEqual(
      new Set(["on-hand", "streak", "net-position"]),
    );
  });
});

describe("buildArrangementPrompt", () => {
  it("lists every figure with its id, value and direction", () => {
    const { user } = buildArrangementPrompt(facts, {
      money: (amount) => `${amount} EUR`,
    });

    expect(user).toContain("net-position | Everything, added up | 1234 EUR");
    expect(user).toContain("rising is bad");
  });

  it("tells the model what it does not know, and may not choose", () => {
    const { user } = buildArrangementPrompt(facts, { money: String });

    expect(user).toContain("wallet-drift");
    expect(user).toContain("no target allocation has been set");
  });

  it("states the figure rule at the top and again at the bottom", () => {
    // Instruction adherence decays across a long system message, and this is
    // the one rule whose failure is expensive. The repetition is the point.
    const { system } = buildArrangementPrompt(facts, { money: String });
    const lines = system.split("\n");
    const rule = "Never write a number";
    const at = lines.flatMap((line, index) =>
      line.includes(rule) ? [index] : [],
    );

    expect(at).toHaveLength(2);
    expect(at[0]).toBeLessThan(5);
    expect(at[1]).toBeGreaterThan(lines.length - 4);
  });

  it("tells the model that most tiles want no caption", () => {
    // Without this a model captions every figure with the figure, which
    // renders as the same number twice, six millimetres apart.
    const { system } = buildArrangementPrompt(facts, { money: String });

    expect(system).toContain("Most tiles should have no caption at all");
  });

  it("switches the whole prompt, not just an appended instruction", () => {
    const { system, user, locale } = buildArrangementPrompt(facts, {
      money: String,
      locale: "fr",
    });

    expect(locale).toBe("fr");
    expect(system).toContain("N'écrivez jamais de nombre");
    expect(system).not.toContain("Never write a number");
    expect(user).toContain("La position telle qu'elle est au 2026-09-09");
  });
});
