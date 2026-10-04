import { describe, expect, it } from "vitest";

import {
  renderCategoryRead,
  verifyCategoryRead,
  type CategoryRead,
} from "./category-read";
import { buildCategoryFacts, type CategoryFactsInput } from "./category-facts";
import { buildCategoryReadPrompt } from "./category-read-prompt";

const facts = buildCategoryFacts({
  locale: "en",
  categoryId: "cat-groceries",
  categoryName: "Groceries",
  type: "expense",
  normal: 412,
  latest: 486,
  monthsActive: 12,
  monthLabel: "September 2026",
  drift: 74,
  oddMonth: null,
  shareOfMonth: 0.19,
});

function answer(overrides: Record<string, unknown> = {}) {
  return {
    observations: [
      {
        text: "Groceries have climbed steadily, to {{fact:latest}}.",
        basis: ["latest"],
        tone: "watch",
      },
    ],
    suggestions: [],
    ...overrides,
  };
}

describe("verifyCategoryRead", () => {
  it("accepts a claim whose every figure is a placeholder", () => {
    const verdict = verifyCategoryRead(answer(), facts, "en");

    expect(verdict.ok).toBe(true);
  });

  it("refuses a read that writes a figure of its own", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "Groceries have climbed to 486 euros.",
            basis: ["latest"],
            tone: "watch",
          },
        ],
      }),
      facts,
      "en",
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("invented-figure");
  });

  it("drops a claim resting on a datum it was never sent, and keeps the rest", () => {
    const resting = {
      text: "Steady since {{fact:2026}}.",
      basis: ["2026"],
      tone: "neutral" as const,
    };
    const verdict = verifyCategoryRead(
      answer({ observations: [resting, ...answer().observations] }),
      facts,
      "en",
    );

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.read.observations).toEqual(answer().observations);
      expect(verdict.trimmed).toContainEqual(
        expect.objectContaining({ why: "unknown-datum" }),
      );
    }

    const alone = verifyCategoryRead(
      answer({ observations: [resting] }),
      facts,
      "en",
    );
    expect(alone.ok === false && alone.reason).toBe("nothing-left");
  });

  /**
   * The two that cost a reader something, rather than the two that classify.
   *
   * The module stakes its central design on where the fatal line falls, and a
   * verdict is only half of what that decides — the other half is what lands
   * on the panel. Both cases below have a surviving observation in them, so a
   * line drawn one notch either way changes what a person sees.
   */
  it("throws away good observations when one of them writes a figure", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "An ordinary month costs you {{fact:normal}}.",
            basis: ["normal"],
            tone: "neutral",
          },
          {
            text: "Groceries have climbed to 486 euros.",
            basis: ["latest"],
            tone: "watch",
          },
        ],
      }),
      facts,
      "en",
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("invented-figure");
  });

  it("keeps the observations and drops only a suggestion that writes one", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "An ordinary month costs you {{fact:normal}}.",
            basis: ["normal"],
            tone: "neutral",
          },
          {
            text: "It has been climbing, to {{fact:latest}}.",
            basis: ["latest"],
            tone: "watch",
          },
        ],
        suggestions: [
          {
            text: "Set a cap of 400 euros.",
            basis: ["normal"],
            effort: "this-month",
          },
        ],
      }),
      facts,
      "en",
    );

    expect(verdict.ok).toBe(true);
    expect(verdict.ok === true && verdict.read.observations).toHaveLength(2);
    expect(verdict.ok === true && verdict.read.suggestions).toHaveLength(0);
    expect(verdict.ok === true && verdict.trimmed).toEqual([
      {
        kind: "suggestion",
        text: "Set a cap of 400 euros.",
        why: "figure",
      },
    ]);
  });

  it("trims an over-long claim rather than refusing the read", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "Groceries have climbed steadily, to {{fact:latest}}.",
            basis: ["latest"],
            tone: "watch",
          },
          {
            // No digits and no quantity words; only too long for the panel.
            text: `${"Groceries have been creeping up and up. ".repeat(8)}`,
            basis: ["normal"],
            tone: "neutral",
          },
        ],
      }),
      facts,
      "en",
    );

    expect(verdict.ok).toBe(true);
    expect(verdict.ok === true && verdict.read.observations).toHaveLength(1);
    expect(verdict.ok === true && verdict.trimmed[0]?.why).toBe("too-long");
  });

  it("trims a claim that points at a figure it did not declare", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "Groceries have climbed to {{fact:latest}}, against {{fact:normal}} usually.",
            basis: ["latest"],
            tone: "watch",
          },
        ],
      }),
      facts,
      "en",
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("nothing-left");
  });
});

/* ------------------------------------------------------------ the pack */

function input(overrides: Partial<CategoryFactsInput> = {}) {
  return {
    locale: "en",
    categoryId: "cat-groceries",
    categoryName: "Groceries",
    type: "expense",
    normal: 412,
    latest: 486,
    monthsActive: 12,
    monthLabel: "September 2026",
    drift: 74,
    oddMonth: null,
    shareOfMonth: 0.19,
    ...overrides,
  } satisfies CategoryFactsInput;
}

function ids(pack: { facts: readonly { id: string }[] }) {
  return pack.facts.map((fact) => fact.id);
}

describe("buildCategoryFacts", () => {
  it("names an absent figure with a reason rather than handing over a zero", () => {
    const pack = buildCategoryFacts(
      input({ latest: null, oddMonth: null, shareOfMonth: null }),
    );

    expect(ids(pack)).not.toContain("latest");
    expect(pack.facts.every((fact) => fact.value !== 0)).toBe(true);
    expect(
      Object.fromEntries(pack.missing.map((row) => [row.id, row.why])),
    ).toEqual({
      latest: "not-recorded",
      "odd-month": "nothing-found",
      "share-of-month": "not-recorded",
    });
  });

  it("says a drift was looked for and not found, rather than saying nothing", () => {
    const pack = buildCategoryFacts(input({ drift: null }));

    expect(ids(pack)).not.toContain("drift");
    expect(pack.missing.find((row) => row.id === "drift")?.why).toBe(
      "nothing-found",
    );
  });

  it("reads a rise as bad for an expense and good for income and savings", () => {
    const sense = (type: CategoryFactsInput["type"]) =>
      buildCategoryFacts(input({ type, shareOfMonth: null })).facts.find(
        (fact) => fact.id === "latest",
      )?.sense;

    expect(sense("expense")).toBe("up-is-bad");
    expect(sense("income")).toBe("up-is-good");
    expect(sense("savings")).toBe("up-is-good");
    expect(sense("investment")).toBe("up-is-good");
  });

  it("asks nothing of the writer when there is barely a run to read", () => {
    expect(buildCategoryFacts(input({ monthsActive: 2 })).thin).toBe(true);
    expect(buildCategoryFacts(input({ monthsActive: 3 })).thin).toBe(false);
  });

  // The share is a share of the month's *spending*, so the type decides
  // whether it exists — not whether a number happened to arrive. Handing one
  // in is the case that matters: gated on the value alone, an income category
  // would get a figure labelled for money going out and marked "up-is-bad".
  it("offers a share of the month only where there is spending to share", () => {
    for (const type of ["income", "savings", "investment"] as const) {
      const pack = buildCategoryFacts(input({ type, shareOfMonth: 0.19 }));

      expect(ids(pack)).not.toContain("share-of-month");
      expect(pack.missing.map((row) => row.id)).not.toContain("share-of-month");
    }

    expect(ids(buildCategoryFacts(input({ shareOfMonth: 0.19 })))).toContain(
      "share-of-month",
    );
  });
});

/* ------------------------------------------------------- the rendering */

const money = (amount: number) => `${amount} EUR`;

describe("renderCategoryRead", () => {
  const read: CategoryRead = {
    observations: [
      {
        text: "An ordinary month costs you {{fact:normal}}.",
        basis: ["normal"],
        tone: "neutral",
      },
    ],
    suggestions: [
      { text: "Check the standing order.", basis: ["normal"], effort: "habit" },
      { text: "Look at last week.", basis: ["normal"], effort: "now" },
    ],
  };

  it("fills a figure from the pack as it stands now, not as it was written", () => {
    const rendered = renderCategoryRead(
      read,
      buildCategoryFacts(input({ normal: 430 })),
      money,
      "en",
    );

    expect(rendered?.observations[0]?.segments).toEqual([
      { kind: "text", text: "An ordinary month costs you " },
      {
        kind: "figure",
        factId: "normal",
        label: "A normal month",
        display: "430 EUR",
      },
      { kind: "text", text: "." },
    ]);
  });

  it("puts the soonest suggestion first", () => {
    const rendered = renderCategoryRead(read, facts, money, "en");

    expect(rendered?.suggestions.map((row) => row.effort)).toEqual([
      "now",
      "habit",
    ]);
  });

  it("shows nothing at all once every observation has lost its figure", () => {
    const stale: CategoryRead = {
      observations: [
        { text: "Above {{fact:drift}}.", basis: ["drift"], tone: "watch" },
      ],
      suggestions: [],
    };

    expect(
      renderCategoryRead(
        stale,
        buildCategoryFacts(input({ drift: null })),
        money,
        "en",
      ),
    ).toBe(null);
  });
});

/* ---------------------------------------------------------- the prompt */

describe("buildCategoryReadPrompt", () => {
  const { system, user } = buildCategoryReadPrompt(facts, {
    locale: "en",
    money,
  });

  it("states the figure rule first and again last", () => {
    const rule = "Never write a number yourself";
    const lines = system.split("\n");

    expect(system.split(rule)).toHaveLength(3);
    expect(lines.findIndex((line) => line.includes(rule))).toBeLessThan(5);
    // The naming rule sits beside it in both positions, so the figure rule is
    // the second-to-last line rather than the last.
    expect(lines.at(-2)).toContain(rule);
  });

  it("carries the app's words for a normal month and refuses an anomaly", () => {
    expect(system).toContain('"A normal month"');
    expect(system).toContain('Nothing here is an "anomaly"');
  });

  it("describes figures in the one format every prompt uses", () => {
    expect(user).toContain(
      "  normal | A normal month | 412 EUR | neither good nor bad",
    );
    expect(user).toContain(
      "  latest | In September 2026 | 486 EUR | rising is bad",
    );
  });

  it("says what was looked for and not found", () => {
    expect(user).toContain(
      "  odd-month | How far that month sat from a normal one | this was looked for and there is none",
    );
  });
});
