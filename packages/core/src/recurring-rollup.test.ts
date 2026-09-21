import { describe, expect, it } from "vitest";

import { rollUpRecurring } from "./recurring-rollup";
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
