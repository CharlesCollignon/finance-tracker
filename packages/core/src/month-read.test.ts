import { describe, expect, it } from "vitest";

import { buildMonthFacts, type BuildMonthFactsInput } from "./month-facts";
import {
  createFakeMonthReadSource,
  MAX_CLAIM_LENGTH,
  MAX_OBSERVATIONS,
  MAX_SUGGESTIONS,
  MONTH_READ_JSON_SCHEMA,
  readFooting,
  renderMonthRead,
  verifyMonthRead,
  visibleLength,
  writesAFigure,
  type MonthRead,
} from "./month-read";
import type { MonthlySummary } from "./types/database";

const money = (amount: number) => `${amount.toFixed(2)} €`;
/** Proves a figure on screen came from the formatter, not from the model. */
const marked = (amount: number) => `«${amount}»`;

function summary(partial: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    income: 3200,
    expenses: 1650,
    savings: 200,
    investments: 0,
    investmentDeployments: 0,
    remaining: 1550,
    budgetView: "current",
    expenseBreakdown: [
      {
        categoryId: "groceries",
        name: "Groceries",
        type: "expense",
        icon: null,
        total: 412,
      },
    ],
    savingsBreakdown: [],
    investmentBreakdown: [],
    investmentDeploymentBreakdown: [],
    ...partial,
  };
}

function pack(partial: Partial<BuildMonthFactsInput> = {}) {
  return buildMonthFacts({
    year: 2026,
    month: 3,
    state: "closed",
    summary: summary(),
    comparison: null,
    close: null,
    pulse: null,
    closeSummary: null,
    unrecordedCap: null,
    budgets: [],
    goals: [],
    investedValue: null,
    inboxPending: 0,
    chargesUnconfirmed: 0,
    ...partial,
  });
}

function answer(overrides: Record<string, unknown> = {}) {
  return {
    headline: "A steady month",
    observations: [
      {
        text: "Groceries ran {{fact:top-expense:groceries}}.",
        basis: ["top-expense:groceries"],
        tone: "watch",
      },
    ],
    suggestions: [],
    ...overrides,
  };
}

describe("writesAFigure", () => {
  it("catches a digit", () => {
    expect(writesAFigure("You spent 412 on groceries")).toBe(true);
  });

  it("catches a scale word spelled out", () => {
    expect(writesAFigure("roughly two thousand euros")).toBe(true);
    expect(writesAFigure("up by a third")).toBe(true);
    expect(writesAFigure("half your income")).toBe(true);
  });

  it("allows a small integer used as ordinary prose", () => {
    // The offence is stating a figure, not using the word "one". An earlier
    // denylist trimmed exactly these sentences, which are true and useful.
    expect(writesAFigure("One of your caps is over")).toBe(false);
    expect(writesAFigure("two of your charges are unconfirmed")).toBe(false);
  });

  it("catches a small integer next to a unit", () => {
    expect(writesAFigure("up nine percent on last month")).toBe(true);
    expect(writesAFigure("about fifty euros more")).toBe(true);
  });

  it("ignores figures inside placeholders, which are the app's own", () => {
    expect(writesAFigure("Groceries ran {{fact:top-expense:groceries}}")).toBe(
      false,
    );
  });
});

describe("verifyMonthRead", () => {
  it("accepts a well-formed answer", () => {
    const verdict = verifyMonthRead(answer(), pack());

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.read.headline).toBe("A steady month");
      expect(verdict.trimmed).toEqual([]);
    }
  });

  describe("fatal", () => {
    it("rejects a shape that is not the schema", () => {
      const verdict = verifyMonthRead({ headline: "x" }, pack());

      expect(verdict).toMatchObject({ ok: false, reason: "unreadable" });
    });

    it("rejects an extra top-level key rather than ignoring it", () => {
      const verdict = verifyMonthRead(answer({ confidence: 0.9 }), pack());

      expect(verdict).toMatchObject({ ok: false, reason: "unreadable" });
    });

    it("rejects a figure in the headline", () => {
      const verdict = verifyMonthRead(
        answer({ headline: "You spent 412 on groceries" }),
        pack(),
      );

      expect(verdict).toMatchObject({ ok: false, reason: "invented-figure" });
    });

    it("rejects a headline over the length limit", () => {
      // Proves the rule does not depend on the provider honouring maxLength.
      const verdict = verifyMonthRead(
        answer({ headline: "a".repeat(140) }),
        pack(),
      );

      expect(verdict).toMatchObject({ ok: false, reason: "unreadable" });
    });

    it("rejects a basis naming a datum that was never sent", () => {
      // Fatal, not trimmed: a model citing a figure we did not provide is
      // working from something other than our data, and nothing else it
      // wrote is any more trustworthy.
      const verdict = verifyMonthRead(
        answer({
          observations: [
            {
              text: "Unrecorded spending was high.",
              basis: ["unrecorded"],
              tone: "watch",
            },
          ],
        }),
        pack({ close: null }),
      );

      expect(verdict).toMatchObject({ ok: false, reason: "unknown-datum" });
      if (!verdict.ok) {
        expect(verdict.detail).toContain("unrecorded");
      }
    });

    it("rejects a placeholder for a datum that was never sent", () => {
      const verdict = verifyMonthRead(
        answer({
          observations: [
            {
              text: "It came to {{fact:invented}}.",
              basis: ["invented"],
              tone: "neutral",
            },
          ],
        }),
        pack(),
      );

      expect(verdict).toMatchObject({ ok: false, reason: "unknown-datum" });
    });

    it("rejects an answer where every observation had to go", () => {
      const verdict = verifyMonthRead(
        answer({
          observations: [
            { text: "You spent 412 euros.", basis: ["income"], tone: "watch" },
          ],
        }),
        pack(),
      );

      expect(verdict).toMatchObject({ ok: false, reason: "nothing-left" });
    });
  });

  it("takes a basis written as a placeholder as the id it names", () => {
    // A real answer did exactly this. The datum is known, the claim is sound,
    // and the punctuation is the model echoing the figure rule it was just
    // given — not a reason to throw the read away.
    const verdict = verifyMonthRead(
      answer({
        observations: [
          {
            text: "Groceries ran {{fact:top-expense:groceries}}.",
            basis: ["{{fact:top-expense:groceries}}"],
            tone: "watch",
          },
        ],
      }),
      pack(),
    );

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      // Stored bare, so staleness has one form of id to compare against.
      expect(verdict.read.observations[0].basis).toEqual([
        "top-expense:groceries",
      ]);
      expect(verdict.trimmed).toEqual([]);
    }
  });

  it("takes the first four observations rather than refusing a fifth", () => {
    // A surplus observation is one too many, not a broken answer. The count
    // is what the card holds, so it cuts; it does not gate.
    const verdict = verifyMonthRead(
      answer({
        observations: Array.from({ length: 6 }, (_, index) => ({
          text: `Observation ${"x".repeat(index)} about the month.`,
          basis: ["income"],
          tone: "neutral",
        })),
        suggestions: Array.from({ length: 5 }, () => ({
          text: "Check the charges that are waiting.",
          basis: ["income"],
          effort: "now",
        })),
      }),
      pack(),
    );

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.read.observations).toHaveLength(MAX_OBSERVATIONS);
      expect(verdict.read.suggestions).toHaveLength(MAX_SUGGESTIONS);
    }
  });

  it("accepts a claim resting on more figures than the card usually shows", () => {
    const verdict = verifyMonthRead(
      answer({
        observations: [
          {
            text: "The shape of the month.",
            basis: [
              "income",
              "expenses",
              "savings",
              "remaining",
              "savings-rate",
            ],
            tone: "neutral",
          },
        ],
      }),
      pack(),
    );

    expect(verdict.ok).toBe(true);
  });

  describe("trimmed", () => {
    it("drops one offending suggestion and keeps the read", () => {
      const verdict = verifyMonthRead(
        answer({
          suggestions: [
            {
              text: "Keep groceries under 350 next month.",
              basis: ["income"],
              effort: "this-month",
            },
            {
              text: "Confirm the charges that are waiting.",
              basis: ["income"],
              effort: "now",
            },
          ],
        }),
        pack(),
      );

      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.read.suggestions).toHaveLength(1);
        expect(verdict.trimmed).toEqual([
          expect.objectContaining({ kind: "suggestion", why: "figure" }),
        ]);
      }
    });

    it("drops a claim too long for the card, and keeps the rest", () => {
      // Measured against a real answer that was thirty characters over: the
      // read as a whole is still worth showing, and binning it would spend an
      // allowance to display nothing.
      const verdict = verifyMonthRead(
        answer({
          observations: [
            {
              text: "Groceries were the largest.",
              basis: ["income"],
              tone: "watch",
            },
            {
              text: `Also, ${"a".repeat(300)}`,
              basis: ["income"],
              tone: "watch",
            },
          ],
        }),
        pack(),
      );

      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.read.observations).toHaveLength(1);
        expect(verdict.trimmed[0]).toMatchObject({ why: "too-long" });
      }
    });

    it("does not charge a claim for the markup a reader never sees", () => {
      // Four placeholders are eighty characters of `{{fact:...}}` that render
      // as short amounts. Counted raw, this claim is over the cap and gets
      // dropped for citing its figures — which is the thing the app asked it
      // to do, so counting raw would punish the behaviour it wants.
      const ids = ["income", "expenses", "savings", "remaining"];
      const text = `In was {{fact:income}}, out was {{fact:expenses}}, aside was {{fact:savings}}, and what stayed was {{fact:remaining}}. ${"a".repeat(150)}`;

      expect(text.length).toBeGreaterThan(MAX_CLAIM_LENGTH);
      expect(visibleLength(text)).toBeLessThanOrEqual(MAX_CLAIM_LENGTH);

      const verdict = verifyMonthRead(
        answer({ observations: [{ text, basis: ids, tone: "neutral" }] }),
        pack(),
      );

      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.read.observations).toHaveLength(1);
        expect(verdict.trimmed).toEqual([]);
      }
    });

    it("drops a claim pointing at a figure it did not declare", () => {
      // The declaration is what makes staleness detectable later, so a
      // placeholder outside the basis is a claim with unverifiable footing.
      const verdict = verifyMonthRead(
        answer({
          observations: [
            {
              text: "Money in was {{fact:income}}.",
              basis: ["expenses"],
              tone: "good",
            },
            {
              text: "Groceries were the largest.",
              basis: ["top-expense:groceries"],
              tone: "watch",
            },
          ],
        }),
        pack(),
      );

      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.read.observations).toHaveLength(1);
        expect(verdict.trimmed[0]).toMatchObject({
          why: "unbacked-placeholder",
        });
      }
    });
  });
});

describe("visibleLength", () => {
  it("counts a placeholder at what it renders as, not what it is written as", () => {
    const raw = "Spending was {{fact:expenses}}.";

    expect(raw.length).toBe(31);
    // "Spending was " + a nominal amount + "." — what a reader actually meets.
    expect(visibleLength(raw)).toBe(22);
  });

  it("leaves prose without figures alone", () => {
    expect(visibleLength("A steady month")).toBe(14);
  });
});

describe("renderMonthRead", () => {
  const read: MonthRead = {
    headline: "A steady month",
    observations: [
      {
        text: "Groceries ran {{fact:top-expense:groceries}} this month.",
        basis: ["top-expense:groceries"],
        tone: "watch",
      },
    ],
    suggestions: [],
  };

  it("substitutes the app's own formatted figure, never the model's text", () => {
    const rendered = renderMonthRead(read, pack(), marked)!;
    const figure = rendered.observations[0]!.segments.find(
      (segment) => segment.kind === "figure",
    );

    expect(figure).toMatchObject({
      kind: "figure",
      factId: "top-expense:groceries",
      label: "Groceries",
      display: "«412»",
    });
  });

  it("keeps the prose either side of a figure", () => {
    const rendered = renderMonthRead(read, pack(), money)!;

    expect(rendered.observations[0]!.segments.map((s) => s.kind)).toEqual([
      "text",
      "figure",
      "text",
    ]);
  });

  it("drops a claim whose figure has since disappeared", () => {
    const withoutGroceries = pack({
      summary: summary({ expenseBreakdown: [] }),
    });
    const twoClaims: MonthRead = {
      ...read,
      observations: [
        ...read.observations,
        { text: "Money in held up.", basis: ["income"], tone: "good" },
      ],
    };

    const rendered = renderMonthRead(twoClaims, withoutGroceries, money)!;
    expect(rendered.observations).toHaveLength(1);
  });

  it("returns null when the headline's own figure has disappeared", () => {
    const headlined: MonthRead = {
      ...read,
      headline: "Groceries hit {{fact:top-expense:groceries}}",
    };

    expect(
      renderMonthRead(
        headlined,
        pack({ summary: summary({ expenseBreakdown: [] }) }),
        money,
      ),
    ).toBeNull();
  });

  it("orders suggestions by how soon they can be acted on", () => {
    const rendered = renderMonthRead(
      {
        ...read,
        suggestions: [
          { text: "Make it a habit.", basis: ["income"], effort: "habit" },
          { text: "Do this now.", basis: ["income"], effort: "now" },
          { text: "This month.", basis: ["income"], effort: "this-month" },
        ],
      },
      pack(),
      money,
    )!;

    expect(rendered.suggestions.map((s) => s.effort)).toEqual([
      "now",
      "this-month",
      "habit",
    ]);
  });
});

describe("readFooting", () => {
  it("is the union of what was declared and what was pointed at", () => {
    const footing = readFooting({
      headline: "Up on {{fact:expenses}}",
      observations: [
        {
          text: "Groceries ran {{fact:top-expense:groceries}}.",
          basis: ["top-expense:groceries"],
          tone: "watch",
        },
      ],
      suggestions: [{ text: "Trim it.", basis: ["income"], effort: "habit" }],
    });

    expect(footing).toEqual(["expenses", "income", "top-expense:groceries"]);
  });
});

describe("createFakeMonthReadSource", () => {
  it("records what it was asked, so a test can prove it was not", async () => {
    const source = createFakeMonthReadSource([answer()]);

    expect(source.calls).toEqual([]);
    await source.write({ system: "s", user: "u" });
    expect(source.calls).toEqual([{ system: "s", user: "u" }]);
  });

  it("answers null once its script runs out, like an unreachable writer", async () => {
    const source = createFakeMonthReadSource([]);

    expect(await source.write({ system: "s", user: "u" })).toBeNull();
  });
});

describe("MONTH_READ_JSON_SCHEMA", () => {
  it("forbids extra properties, matching the strict zod parse", () => {
    expect(MONTH_READ_JSON_SCHEMA.json_schema.schema.additionalProperties).toBe(
      false,
    );
    expect(MONTH_READ_JSON_SCHEMA.json_schema.strict).toBe(true);
  });

  it("carries no count or length rules, which zod enforces instead", () => {
    // Mistral's strict mode does not reliably honour minItems/maxLength, so
    // stating them here would imply a guarantee the app does not have.
    const asText = JSON.stringify(MONTH_READ_JSON_SCHEMA);
    expect(asText).not.toContain("maxItems");
    expect(asText).not.toContain("minItems");
    expect(asText).not.toContain("maxLength");
  });
});
