import { describe, expect, it } from "vitest";

import {
  buildMonthFacts,
  factIds,
  factsDigest,
  findFact,
  formatFact,
  MAX_BUDGETS,
  MAX_TOP_EXPENSES,
  type BuildMonthFactsInput,
  type MonthFact,
} from "./month-facts";
import type { MonthlySummary } from "./types/database";

const money = (amount: number) => `${amount.toFixed(2)} €`;

function summary(partial: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    income: 3200,
    expenses: 1650,
    savings: 200,
    investments: 0,
    investmentDeployments: 0,
    remaining: 1550,
    budgetView: "current",
    expenseBreakdown: [],
    savingsBreakdown: [],
    investmentBreakdown: [],
    investmentDeploymentBreakdown: [],
    ...partial,
  };
}

function input(
  partial: Partial<BuildMonthFactsInput> = {},
): BuildMonthFactsInput {
  return {
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
  };
}

function category(id: string, name: string, total: number) {
  return { categoryId: id, name, type: "expense" as const, icon: null, total };
}

describe("buildMonthFacts", () => {
  it("labels the month and carries the sense of each figure", () => {
    const pack = buildMonthFacts(input());

    expect(pack.monthKey).toBe("2026-03");
    expect(pack.monthLabel).toBe("March 2026");
    expect(findFact(pack, "income")).toMatchObject({
      value: 3200,
      sense: "up-is-good",
      unit: "money",
    });
    // The one that matters most: a model congratulating a rise here would be
    // reading the app's most important number backwards.
    expect(findFact(pack, "expenses")!.sense).toBe("up-is-bad");
  });

  it("marks unrecorded spending as measured rather than estimated", () => {
    const pack = buildMonthFacts(
      input({
        close: {
          monthKey: "2026-03",
          unrecorded: 268,
          kept: 1240,
          keptRate: 38.8,
          cashChange: 900,
        },
      }),
    );

    const fact = findFact(pack, "unrecorded")!;
    expect(fact.value).toBe(268);
    expect(fact.sense).toBe("up-is-bad");
    expect(fact.note).toContain("measured");
  });

  describe("absences are named, never zeroed", () => {
    it("says no bank rather than nothing on hand", () => {
      // "You have 0 € on hand" to someone with no bank connected is the exact
      // failure this design exists to avoid.
      const pack = buildMonthFacts(
        input({
          state: "in-progress",
          pulse: {
            onHand: null,
            committed: 0,
            arriving: 0,
            free: null,
            unrecordedSoFar: null,
            overRecorded: false,
            cap: null,
            capRatio: null,
            overCap: false,
            standing: "unknown",
          },
        }),
      );

      expect(factIds(pack).has("on-hand")).toBe(false);
      expect(pack.missing).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "on-hand", why: "no-bank" }),
        ]),
      );
    });

    it("says no close, and calls the picture partial", () => {
      const pack = buildMonthFacts(input({ close: null }));

      expect(factIds(pack).has("unrecorded")).toBe(false);
      expect(pack.missing).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "unrecorded", why: "no-close" }),
        ]),
      );
      expect(pack.coverage).toBe("partial");
    });

    it("blames the unfinished month rather than a missing close mid-month", () => {
      const pack = buildMonthFacts(input({ state: "in-progress" }));

      expect(pack.missing).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "unrecorded",
            why: "month-unfinished",
          }),
        ]),
      );
    });

    it("says no cap when none is set", () => {
      expect(buildMonthFacts(input({ unrecordedCap: null })).missing).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "unrecorded-allowance",
            why: "no-cap",
          }),
        ]),
      );
    });
  });

  describe("caps", () => {
    it("keeps a budget's overspend negative", () => {
      const pack = buildMonthFacts(
        input({
          budgets: [
            {
              budgetId: "b1",
              categoryId: "c1",
              label: "Groceries",
              limit: 450,
              spent: 512.4,
              remaining: -62.4,
              ratio: 1.14,
              over: true,
            },
          ],
        }),
      );

      expect(findFact(pack, "budget:b1")!.value).toBe(512.4);
      // A model reading "left" as a floor of zero would miss the breach.
      expect(findFact(pack, "budget-left:b1")!.value).toBe(-62.4);
    });

    it("gives the overshoot as its own positive figure", () => {
      // Without it a model writes "overshooting the cap by -62,40 €": it has
      // the breach right and the only figure it holds is the negative balance.
      // Supplying the subtraction is cheaper and safer than forbidding it.
      const pack = buildMonthFacts(
        input({
          budgets: [
            {
              budgetId: "b1",
              categoryId: "c1",
              label: "Groceries",
              limit: 450,
              spent: 512.4,
              remaining: -62.4,
              ratio: 1.14,
              over: true,
            },
          ],
        }),
      );

      expect(findFact(pack, "budget-over:b1")).toMatchObject({
        value: 62.4,
        sense: "up-is-bad",
      });
    });

    it("offers no overshoot for a cap that holds", () => {
      const pack = buildMonthFacts(
        input({
          budgets: [
            {
              budgetId: "b1",
              categoryId: "c1",
              label: "Groceries",
              limit: 450,
              spent: 300,
              remaining: 150,
              ratio: 0.67,
              over: false,
            },
          ],
        }),
      );

      expect(factIds(pack).has("budget-over:b1")).toBe(false);
    });

    it("says how far unrecorded spending went past the allowance", () => {
      // Same failure, different figure: "exceeded the allowance by 240,00 €"
      // is the allowance itself, quoted for want of the difference.
      const pack = buildMonthFacts(
        input({
          unrecordedCap: 240,
          close: {
            monthKey: "2026-03",
            unrecorded: 268.3,
            kept: 1240,
            keptRate: 38.8,
            cashChange: 900,
          },
        }),
      );

      expect(findFact(pack, "unrecorded-over")).toMatchObject({
        value: 28.3,
        sense: "up-is-bad",
      });
    });

    it("offers no overshoot while the allowance holds", () => {
      const pack = buildMonthFacts(
        input({
          unrecordedCap: 400,
          close: {
            monthKey: "2026-03",
            unrecorded: 268.3,
            kept: 1240,
            keptRate: 38.8,
            cashChange: 900,
          },
        }),
      );

      expect(factIds(pack).has("unrecorded-over")).toBe(false);
    });

    it("bounds the per-entity families so the prompt cannot grow with a category list", () => {
      const pack = buildMonthFacts(
        input({
          summary: summary({
            expenseBreakdown: Array.from({ length: 12 }, (_, index) =>
              category(`c${index}`, `Cat ${index}`, 100 - index),
            ),
          }),
          budgets: Array.from({ length: 9 }, (_, index) => ({
            budgetId: `b${index}`,
            categoryId: `c${index}`,
            label: `Cap ${index}`,
            limit: 100,
            spent: 50,
            remaining: 50,
            ratio: 0.5,
            over: false,
          })),
        }),
      );

      const ids = [...factIds(pack)];
      expect(ids.filter((id) => id.startsWith("top-expense:"))).toHaveLength(
        MAX_TOP_EXPENSES,
      );
      expect(ids.filter((id) => id.startsWith("budget:"))).toHaveLength(
        MAX_BUDGETS,
      );
    });

    it("takes the largest expenses, not the first ones given", () => {
      const pack = buildMonthFacts(
        input({
          summary: summary({
            expenseBreakdown: [
              category("small", "Small", 5),
              category("big", "Big", 900),
            ],
          }),
        }),
      );

      expect(factIds(pack).has("top-expense:big")).toBe(true);
      expect(findFact(pack, "top-expense:big")!.label).toBe("Big");
    });
  });

  describe("what is unfinished", () => {
    it("hands over the uncategorised count so the read can admit the gap", () => {
      // This feature ships before the model helps categorise anything, so a
      // month with rows still waiting has a genuinely partial picture.
      const pack = buildMonthFacts(input({ inboxPending: 7 }));

      expect(findFact(pack, "inbox-pending")).toMatchObject({
        value: 7,
        unit: "count",
        sense: "up-is-bad",
      });
      expect(pack.coverage).toBe("partial");
    });

    it("leaves the count out entirely when there is nothing waiting", () => {
      expect(factIds(buildMonthFacts(input())).has("inbox-pending")).toBe(
        false,
      );
    });
  });

  describe("thin months", () => {
    it("is thin when nothing was recorded and nothing closed", () => {
      const pack = buildMonthFacts(
        input({
          summary: summary({
            income: 0,
            expenses: 0,
            savings: 0,
            remaining: 0,
          }),
        }),
      );

      expect(pack.thin).toBe(true);
    });

    it("stops being thin as soon as anything exists", () => {
      const pack = buildMonthFacts(
        input({
          summary: summary({
            income: 0,
            expenses: 12,
            savings: 0,
            remaining: -12,
          }),
        }),
      );

      expect(pack.thin).toBe(false);
    });
  });
});

describe("factsDigest", () => {
  it("is stable across two builds of the same month", () => {
    expect(factsDigest(buildMonthFacts(input()))).toBe(
      factsDigest(buildMonthFacts(input())),
    );
  });

  it("ignores a sub-cent move and notices a one-cent move", () => {
    const base = factsDigest(buildMonthFacts(input()));

    expect(
      factsDigest(
        buildMonthFacts(input({ summary: summary({ expenses: 1650.004 }) })),
      ),
    ).toBe(base);
    expect(
      factsDigest(
        buildMonthFacts(input({ summary: summary({ expenses: 1650.01 }) })),
      ),
    ).not.toBe(base);
  });

  it("notices a fact appearing or disappearing", () => {
    const without = factsDigest(buildMonthFacts(input()));
    const with_ = factsDigest(buildMonthFacts(input({ inboxPending: 1 })));

    expect(with_).not.toBe(without);
  });

  it("does not depend on the order facts were built in", () => {
    const one = buildMonthFacts(
      input({
        summary: summary({
          expenseBreakdown: [category("a", "A", 10), category("b", "B", 20)],
        }),
      }),
    );
    const other = buildMonthFacts(
      input({
        summary: summary({
          expenseBreakdown: [category("b", "B", 20), category("a", "A", 10)],
        }),
      }),
    );

    expect(factsDigest(one)).toBe(factsDigest(other));
  });
});

describe("formatFact", () => {
  const fact = (partial: Partial<MonthFact>): MonthFact => ({
    id: "x",
    label: "X",
    unit: "money",
    value: 1,
    sense: "neutral",
    ...partial,
  });

  it("hands money to the injected formatter, because the currency is the reader's", () => {
    expect(formatFact(fact({ value: 412.4 }), money)).toBe("412.40 €");
    expect(formatFact(fact({ value: 412.4 }), () => "«masked»")).toBe(
      "«masked»",
    );
  });

  it("writes a percent to one decimal at most", () => {
    expect(formatFact(fact({ unit: "percent", value: 11.42 }), money)).toBe(
      "11.4%",
    );
    expect(formatFact(fact({ unit: "percent", value: 11 }), money)).toBe("11%");
  });

  it("writes a count without a currency", () => {
    expect(formatFact(fact({ unit: "count", value: 3 }), money)).toBe("3");
  });
});
