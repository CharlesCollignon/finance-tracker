import { describe, expect, it } from "vitest";

import { buildCategoryHistory } from "./category-history";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function tx(
  occurredOn: string,
  amount: number,
  categoryId = "cat-groceries",
  name = "Groceries",
  type: CategoryType = "expense",
  counts = true,
): TransactionWithCategory {
  return {
    id: `tx-${Math.random()}`,
    user_id: "u",
    category_id: categoryId,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T00:00:00.000Z`,
    categories: { name, type, icon: null, counts_toward_summary: counts },
  };
}

describe("buildCategoryHistory", () => {
  it("gives every month in the window a bar, including the empty ones", () => {
    const [history] = buildCategoryHistory([tx("2026-09-04", 100)], 2026, 9, {
      months: 3,
    });

    expect(history!.points.map((p) => p.monthKey)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    // A subscription that stopped should read as a hole, not as a shorter run.
    expect(history!.points.map((p) => p.empty)).toEqual([true, true, false]);
  });

  it("sums a month rather than showing its last transaction", () => {
    const [history] = buildCategoryHistory(
      [tx("2026-09-04", 40), tx("2026-09-19", 60)],
      2026,
      9,
      { months: 1 },
    );

    expect(history!.points[0]!.total).toBe(100);
  });

  it("averages over the months that had something in them", () => {
    // Two months of 100, one empty: the average is 100, not 66.67.
    const [history] = buildCategoryHistory(
      [tx("2026-08-04", 100), tx("2026-09-04", 100)],
      2026,
      9,
      { months: 3 },
    );

    expect(history!.average).toBe(100);
    expect(history!.total).toBe(200);
    expect(history!.peak).toBe(100);
  });

  it("reads the latest month against the ones before it", () => {
    const [history] = buildCategoryHistory(
      [
        tx("2026-06-04", 100),
        tx("2026-07-04", 100),
        tx("2026-08-04", 100),
        tx("2026-09-04", 150),
      ],
      2026,
      9,
      { months: 4 },
    );

    // Half again over a 100 baseline.
    expect(history!.trend).toBe(0.5);
  });

  it("says nothing about a trend it cannot support", () => {
    const [history] = buildCategoryHistory(
      [tx("2026-08-04", 100), tx("2026-09-04", 150)],
      2026,
      9,
      { months: 3 },
    );

    expect(history!.trend).toBeNull();
  });

  it("counts a withdrawal against what was set aside", () => {
    // Moving money back out should not read as a month of heavy saving.
    const [history] = buildCategoryHistory(
      [
        tx("2026-09-02", 800, "cat-save", "Savings account", "savings", true),
        tx("2026-09-20", 500, "cat-save", "Savings account", "savings", false),
      ],
      2026,
      9,
      { months: 1 },
    );

    expect(history!.points[0]!.total).toBe(300);
  });

  it("ignores anything outside the window", () => {
    const histories = buildCategoryHistory([tx("2025-01-04", 100)], 2026, 9, {
      months: 3,
    });

    expect(histories).toEqual([]);
  });

  it("puts the busiest category first", () => {
    const histories = buildCategoryHistory(
      [
        tx("2026-09-04", 20, "cat-small", "Sport"),
        tx("2026-09-05", 400, "cat-big", "Rent"),
      ],
      2026,
      9,
      { months: 1 },
    );

    expect(histories.map((h) => h.name)).toEqual(["Rent", "Sport"]);
  });

  it("crosses a year boundary without losing a month", () => {
    const [history] = buildCategoryHistory(
      [tx("2025-12-04", 100), tx("2026-01-04", 100)],
      2026,
      1,
      { months: 3 },
    );

    expect(history!.points.map((p) => p.monthKey)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
  });
});

describe("buildCategoryHistory, when payments straddle a month boundary", () => {
  function salary(id: string, occurredOn: string): TransactionWithCategory {
    return {
      id,
      user_id: "u",
      category_id: "pay",
      recurring_template_id: null,
      occurred_on: occurredOn,
      amount: 4500,
      note: null,
      created_at: "2026-01-01T00:00:00Z",
      categories: {
        name: "Salary",
        type: "income",
        icon: null,
        counts_toward_summary: true,
      },
    };
  }

  /**
   * A perfectly regular income clearing on the 30th or the 1st reads, on a
   * calendar, as two payments one month and none the next. That makes the
   * chart look wild and pushes "a normal month" up by however often it
   * doubled.
   */
  it("counts one payment per period instead of two-then-none", () => {
    const dates = [
      "2025-10-31",
      "2025-12-01",
      "2025-12-31",
      "2026-02-01",
      "2026-02-28",
      "2026-03-31",
      "2026-05-01",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-10-01",
    ];
    const [history] = buildCategoryHistory(
      dates.map((date, index) => salary(`t${index}`, date)),
      2026,
      9,
      { months: 12 },
    );

    expect(history!.periodShifted).toBe(true);
    const active = history!.points.filter((point) => !point.empty);
    // Every month in the window holds exactly one salary.
    expect(active).toHaveLength(12);
    expect(new Set(active.map((point) => point.total))).toEqual(
      new Set([4500]),
    );
  });

  it("leaves ordinary spending on the calendar", () => {
    const dates = [
      "2026-08-02",
      "2026-08-11",
      "2026-08-19",
      "2026-09-04",
      "2026-09-17",
      "2026-09-28",
    ];
    const [history] = buildCategoryHistory(
      dates.map((date, index) => ({
        ...salary(`g${index}`, date),
        category_id: "food",
        categories: {
          name: "Groceries",
          type: "expense" as const,
          icon: null,
          counts_toward_summary: true,
        },
      })),
      2026,
      9,
      { months: 12 },
    );

    expect(history!.periodShifted).toBe(false);
  });
});
