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
    category_id: `cat-${id}`,
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

  it("takes the broker transfer out of what is left, and not the DCAs it buys", () => {
    // The transfer leaves the account; the DCA PEA is bought at the broker
    // with that same money. Taking both out took the same euros twice.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({ id: "transfer", amount: 500, type: "investment" }),
      template({ id: "dca", amount: 450, type: "investment", counts: false }),
    ]);

    expect(rollup.left).toBe(1550);
    expect(rollup.deployed).toBe(450);
  });

  it("takes out the buys of a wallet the bank debits from the account", () => {
    // Bitstack takes its buys from the account by card: no transfer funds
    // them, and they leave it like any contribution.
    const rollup = rollUpRecurring(
      [
        template({ id: "salary", amount: 3200, type: "income" }),
        template({
          id: "bitstack",
          amount: 80,
          type: "investment",
          counts: false,
        }),
      ],
      { debited: new Set(["cat-bitstack"]) },
    );

    expect(rollup.left).toBe(3120);
    expect(rollup.setAside).toBe(80);
    expect(rollup.deployed).toBe(0);
  });

  it("leaves money coming back in out of what is left", () => {
    // A reimbursement or money brought back out of savings is not counted by
    // the summary, and it is not an outgoing either.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "refund", amount: 20, type: "income", counts: false }),
      template({ id: "back", amount: 100, type: "savings", counts: false }),
    ]);

    expect(rollup.left).toBe(3200);
    expect(rollup.deployed).toBe(0);
  });

  it("leaves nothing out of the sum the header shows", () => {
    // The four tiles are income, committed, everything put by, and what is
    // left. This pins them together: if a fifth kind of outflow is ever added
    // to the rollup and not to the header, this fails.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({ id: "fund", amount: 400, type: "savings" }),
      template({ id: "transfer", amount: 500, type: "investment" }),
      template({ id: "dca", amount: 500, type: "investment", counts: false }),
    ]);

    expect(rollup.income - rollup.committed - rollup.setAside).toBe(
      rollup.left,
    );
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

  it("keeps a DCA bought at the broker out of every summary figure", () => {
    const rollup = rollUpRecurring([
      template({ id: "rent", amount: 1150 }),
      template({ id: "dca", amount: 500, type: "investment", counts: false }),
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
      template({ id: "refund", amount: 50, type: "income", counts: false }),
      template({ id: "rent", amount: 900 }),
      template({ id: "livret", amount: 200, type: "savings" }),
      template({ id: "etf", amount: 150, type: "investment" }),
      template({ id: "gym", amount: 40, active: false }),
    ]);

    expect(rollup.byType).toEqual({
      income: 3050,
      expense: 900,
      savings: 200,
      investment: 150,
    });
  });

  it("counts the transfer to the broker and not the DCAs it buys", () => {
    // The investments' total on the Charges page added the transfer and the
    // DCAs it pays for: the same euros twice.
    const rollup = rollUpRecurring([
      template({ id: "transfer", amount: 550, type: "investment" }),
      template({ id: "cto", amount: 480, type: "investment", counts: false }),
    ]);

    expect(rollup.byType.investment).toBe(550);
    expect(rollup.deployed).toBe(480);
  });

  it("counts the buys of a wallet the bank debits", () => {
    // Bitstack: not paid by the transfer, so its own buys are what leaves.
    const rollup = rollUpRecurring(
      [
        template({ id: "transfer", amount: 550, type: "investment" }),
        template({ id: "btc", amount: 78, type: "investment", counts: false }),
      ],
      { debited: new Set(["cat-btc"]) },
    );

    expect(rollup.byType.investment).toBe(628);
    expect(rollup.deployed).toBe(0);
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

  it("draws the transfer and not the DCAs it buys", () => {
    const segments = allocationSegments(
      rollUpRecurring([
        template({ id: "salary", amount: 2000, type: "income" }),
        template({ id: "rent", amount: 1000 }),
        template({ id: "transfer", amount: 500, type: "investment" }),
        template({ id: "dca", amount: 450, type: "investment", counts: false }),
      ]),
    );

    expect(segments).toEqual([
      { kind: "expense", amount: 1000, share: 0.5 },
      { kind: "investment", amount: 500, share: 0.25 },
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
