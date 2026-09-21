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
