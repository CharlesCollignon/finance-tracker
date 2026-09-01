import { describe, expect, it } from "vitest";

import {
  buildMonthComparison,
  formatMonthComparison,
  sumThroughDay,
} from "./month-comparison";
import type { CategoryType, TransactionWithCategory } from "./types/database";

let sequence = 0;

function tx(
  occurredOn: string,
  amount: number,
  type: CategoryType = "expense",
  countsTowardSummary = true,
): TransactionWithCategory {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    user_id: "user-1",
    category_id: "cat-1",
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T10:00:00.000Z`,
    categories: {
      name: "Groceries",
      type,
      icon: null,
      counts_toward_summary: countsTowardSummary,
    },
  };
}

const format = (amount: number) => `€${amount.toFixed(0)}`;

describe("sumThroughDay", () => {
  it("totals only the requested type", () => {
    const rows = [tx("2026-09-01", 10), tx("2026-09-02", 100, "income")];
    expect(sumThroughDay(rows, "expense", 31)).toBe(10);
  });

  it("stops at the given day", () => {
    const rows = [tx("2026-09-01", 10), tx("2026-09-20", 100)];
    expect(sumThroughDay(rows, "expense", 8)).toBe(10);
  });

  it("skips categories excluded from the summary", () => {
    const rows = [tx("2026-09-01", 10), tx("2026-09-02", 50, "expense", false)];
    expect(sumThroughDay(rows, "expense", 31)).toBe(10);
  });
});

describe("buildMonthComparison", () => {
  it("truncates the previous month to the same day mid-month", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-09-01", 100), tx("2026-09-05", 50)],
      previous: [
        tx("2026-08-01", 80),
        tx("2026-08-05", 40),
        // Later in August, and must not count on 8 September.
        tx("2026-08-25", 500),
      ],
      year: 2026,
      month: 9,
      today: "2026-09-08",
    });

    expect(comparison.current).toBe(150);
    expect(comparison.previous).toBe(120);
    expect(comparison.delta).toBe(30);
    expect(comparison.partial).toBe(true);
    expect(comparison.throughDay).toBe(8);
  });

  it("compares whole months once the month being viewed is over", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-08-25", 500)],
      previous: [tx("2026-07-30", 300)],
      year: 2026,
      month: 8,
      today: "2026-09-08",
    });

    expect(comparison.current).toBe(500);
    expect(comparison.previous).toBe(300);
    expect(comparison.partial).toBe(false);
    expect(comparison.throughDay).toBe(31);
  });

  it("does not let a 31-day month flatter a 28-day one", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-03-30", 100)],
      previous: [tx("2026-02-27", 100)],
      year: 2026,
      month: 3,
      today: "2026-04-01",
    });

    // March is compared only through 28 February's length.
    expect(comparison.throughDay).toBe(28);
    expect(comparison.current).toBe(0);
  });

  it("crosses the year boundary to find the previous month", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-01-05", 100)],
      previous: [tx("2025-12-05", 60)],
      year: 2026,
      month: 1,
      today: "2026-01-10",
    });

    expect(comparison.previous).toBe(60);
    expect(comparison.previousLabel).toContain("December");
  });

  it("reports a fall in spending", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-09-01", 50)],
      previous: [tx("2026-08-01", 120)],
      year: 2026,
      month: 9,
      today: "2026-09-08",
    });

    expect(comparison.direction).toBe("down");
    expect(comparison.delta).toBe(-70);
    expect(comparison.ratio).toBeCloseTo(-70 / 120, 6);
  });

  it("calls a pennies-apart month flat", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-09-01", 100)],
      previous: [tx("2026-08-01", 100)],
      year: 2026,
      month: 9,
      today: "2026-09-08",
    });

    expect(comparison.direction).toBe("flat");
  });

  it("is not comparable when the previous month is empty", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-09-01", 100)],
      previous: [],
      year: 2026,
      month: 9,
      today: "2026-09-08",
    });

    expect(comparison.comparable).toBe(false);
    expect(comparison.ratio).toBeNull();
  });

  it("counts nothing for a month that has not started", () => {
    const comparison = buildMonthComparison({
      current: [],
      previous: [tx("2026-09-01", 100)],
      year: 2026,
      month: 10,
      today: "2026-09-08",
    });

    expect(comparison.current).toBe(0);
    expect(comparison.throughDay).toBe(0);
  });

  it("can compare a type other than expense", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-09-01", 2400, "income")],
      previous: [tx("2026-08-01", 2300, "income")],
      year: 2026,
      month: 9,
      today: "2026-09-08",
      type: "income",
    });

    expect(comparison.delta).toBe(100);
  });
});

describe("formatMonthComparison", () => {
  function build(current: number, previous: number, today = "2026-09-08") {
    return buildMonthComparison({
      current: current > 0 ? [tx("2026-09-01", current)] : [],
      previous: previous > 0 ? [tx("2026-08-01", previous)] : [],
      year: 2026,
      month: 9,
      today,
    });
  }

  it("says how much more was spent, mid-month", () => {
    expect(formatMonthComparison(build(300, 120), format)).toBe(
      "€180 more than this point in August 2026.",
    );
  });

  it("says how much less was spent", () => {
    expect(formatMonthComparison(build(50, 120), format)).toBe(
      "€70 less than this point in August 2026.",
    );
  });

  it("drops the mid-month wording for a finished month", () => {
    const comparison = buildMonthComparison({
      current: [tx("2026-08-01", 300)],
      previous: [tx("2026-07-01", 120)],
      year: 2026,
      month: 8,
      today: "2026-09-08",
    });

    expect(formatMonthComparison(comparison, format)).toBe(
      "€180 more than July 2026.",
    );
  });

  it("says nothing when there is no history to compare with", () => {
    expect(formatMonthComparison(build(300, 0), format)).toBeNull();
  });

  it("reports an unchanged month plainly", () => {
    expect(formatMonthComparison(build(120, 120), format)).toBe(
      "About the same as this point in August 2026.",
    );
  });
});
