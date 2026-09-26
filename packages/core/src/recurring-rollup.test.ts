import { describe, expect, it } from "vitest";

import { allocationSegments, rollUpRecurring } from "./recurring-rollup";
import type { RecurringTemplateWithCategory } from "./types/database";

function template({
  id,
  amount,
  type = "expense",
  counts = true,
  active = true,
}: {
  id: string;
  amount: number;
  type?: RecurringTemplateWithCategory["categories"]["type"];
  counts?: boolean;
  active?: boolean;
}): RecurringTemplateWithCategory {
  return {
    id,
    amount,
    active,
    recurrence: "monthly",
    day_of_month: 1,
    day_of_week: null,
    month_of_year: null,
    categories: {
      name: type,
      type,
      icon: null,
      counts_toward_summary: counts,
    },
  } as unknown as RecurringTemplateWithCategory;
}

describe("rollUpRecurring", () => {
  it("keeps income out of committed", () => {
    // The regression this module exists to prevent. Both clients used to sum
    // every counting template into one figure labelled "Committed every
    // month"; a salary landing in that sum would have read as an outgoing.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
    ]);

    expect(rollup.income).toBe(3200);
    expect(rollup.committed).toBe(1150);
  });

  it("subtracts what is set aside as well as what is committed", () => {
    // Money promised to a fund is not spending, but it is not free either.
    // A saver and a spender on the same income with the same rent have the
    // same room; leaving contributions out would report the saver as having
    // more, when they have simply already used theirs.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({ id: "fund", amount: 400, type: "savings" }),
    ]);

    expect(rollup.left).toBe(1650);
  });

  it("takes a broker transfer out of what is left", () => {
    // It is not spending, and the monthly summary does not count it — but it
    // does leave the account, which is what this figure is about.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({
        id: "transfer",
        amount: 500,
        type: "investment",
        counts: false,
      }),
    ]);

    expect(rollup.left).toBe(1550);
  });

  it("leaves nothing out of the sum the header shows", () => {
    // The four tiles are income, committed, everything put by, and what is
    // left. This pins them together: if a fifth kind of outflow is ever added
    // to the rollup and not to the header, this fails.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({ id: "fund", amount: 400, type: "savings" }),
      template({
        id: "transfer",
        amount: 500,
        type: "investment",
        counts: false,
      }),
    ]);

    const putBy = rollup.setAside + rollup.deployed;
    expect(rollup.income - rollup.committed - putBy).toBe(rollup.left);
    expect(rollup.left).toBe(1150);
  });

  it("leaves what income does not commit", () => {
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({ id: "power", amount: 90 }),
    ]);

    expect(rollup.left).toBe(1960);
  });

  it("counts savings and investments as set aside, not committed", () => {
    // `buildRunway` draws the same line and says why: contributions are what
    // a person under pressure stops before they stop paying rent, so counting
    // them as committed overstates what a month actually demands.
    const rollup = rollUpRecurring([
      template({ id: "rent", amount: 1150 }),
      template({ id: "fund", amount: 200, type: "savings" }),
      template({ id: "etf", amount: 150, type: "investment" }),
    ]);

    expect(rollup.committed).toBe(1150);
    expect(rollup.setAside).toBe(350);
  });

  it("keeps a broker transfer out of every summary figure", () => {
    const rollup = rollUpRecurring([
      template({ id: "rent", amount: 1150 }),
      template({
        id: "transfer",
        amount: 500,
        type: "investment",
        counts: false,
      }),
    ]);

    expect(rollup.deployed).toBe(500);
    expect(rollup.setAside).toBe(0);
    expect(rollup.committed).toBe(1150);
  });

  it("ignores a deactivated template", () => {
    const rollup = rollUpRecurring([
      template({ id: "old", amount: 800, type: "income", active: false }),
      template({ id: "rent", amount: 1150 }),
    ]);

    expect(rollup.income).toBe(0);
    expect(rollup.left).toBe(-1150);
  });
});

describe("byType", () => {
  it("sums every active template under its category type, counted or not", () => {
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3000, type: "income" }),
      template({ id: "rent", amount: 900 }),
      template({ id: "livret", amount: 200, type: "savings" }),
      template({ id: "etf", amount: 150, type: "investment" }),
      // A transfer into a broker: deployed for the summary, still an
      // investment for the page.
      template({
        id: "broker",
        amount: 100,
        type: "investment",
        counts: false,
      }),
      template({ id: "gym", amount: 40, active: false }),
    ]);

    expect(rollup.byType).toEqual({
      income: 3000,
      expense: 900,
      savings: 200,
      investment: 250,
    });
  });
});

describe("allocationSegments", () => {
  it("splits the income into expenses, savings, investments and what is left", () => {
    const segments = allocationSegments(
      rollUpRecurring([
        template({ id: "salary", amount: 2000, type: "income" }),
        template({ id: "rent", amount: 1000 }),
        template({ id: "livret", amount: 300, type: "savings" }),
        template({ id: "etf", amount: 200, type: "investment" }),
      ]),
    );

    expect(segments).toEqual([
      { kind: "expense", amount: 1000, share: 0.5 },
      { kind: "savings", amount: 300, share: 0.15 },
      { kind: "investment", amount: 200, share: 0.1 },
      { kind: "left", amount: 500, share: 0.25 },
    ]);
  });

  it("fills the bar with the outgoings when they exceed the income", () => {
    const segments = allocationSegments(
      rollUpRecurring([
        template({ id: "salary", amount: 1000, type: "income" }),
        template({ id: "rent", amount: 1200 }),
        template({ id: "livret", amount: 300, type: "savings" }),
      ]),
    );

    expect(segments.map((segment) => segment.kind)).toEqual([
      "expense",
      "savings",
    ]);
    expect(segments.reduce((sum, segment) => sum + segment.share, 0)).toBe(1);
  });

  it("leaves out a kind worth nothing", () => {
    const segments = allocationSegments(
      rollUpRecurring([
        template({ id: "salary", amount: 1000, type: "income" }),
        template({ id: "rent", amount: 400 }),
      ]),
    );

    expect(segments.map((segment) => segment.kind)).toEqual([
      "expense",
      "left",
    ]);
  });

  it("draws nothing when there is nothing to draw", () => {
    expect(allocationSegments(rollUpRecurring([]))).toEqual([]);
  });
});
