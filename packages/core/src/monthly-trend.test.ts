import { describe, expect, it } from "vitest";

import {
  bucketMonthlyTrend,
  monthlyTrendStart,
  type MonthlyTrendRow,
} from "./monthly-trend";

const NOW = new Date(2026, 2, 19); // 19 March 2026

function row(
  occurredOn: string,
  amount: number,
  type = "expense",
  countsTowardSummary = true,
): MonthlyTrendRow {
  return { occurredOn, amount, type, countsTowardSummary };
}

describe("monthlyTrendStart", () => {
  it("opens the window on the first of the earliest month it covers", () => {
    expect(monthlyTrendStart(6, NOW)).toBe("2025-10-01");
    expect(monthlyTrendStart(1, NOW)).toBe("2026-03-01");
  });

  it("zero-pads so the value compares as text against occurred_on", () => {
    expect(monthlyTrendStart(3, new Date(2026, 10, 5))).toBe("2026-09-01");
  });

  it("crosses a year boundary", () => {
    expect(monthlyTrendStart(6, new Date(2026, 1, 1))).toBe("2025-09-01");
  });
});

describe("bucketMonthlyTrend", () => {
  it("returns one point per month in the window, oldest first", () => {
    const points = bucketMonthlyTrend([], 6, NOW);

    expect(points.map((point) => point.monthKey)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("keeps a month with no rows as a zero rather than dropping it", () => {
    const points = bucketMonthlyTrend([row("2026-03-02", 100)], 3, NOW);

    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ monthKey: "2026-01", net: 0 });
    expect(points[1]).toMatchObject({ monthKey: "2026-02", net: 0 });
  });

  it("splits income from everything else and nets the two", () => {
    const points = bucketMonthlyTrend(
      [
        row("2026-03-01", 3200, "income"),
        row("2026-03-05", 850, "expense"),
        row("2026-03-12", 150, "savings"),
        row("2026-03-15", 200, "investment"),
      ],
      1,
      NOW,
    );

    expect(points[0]).toMatchObject({
      income: 3200,
      outflow: 1200,
      net: 2000,
    });
  });

  it("ignores categories excluded from the summary", () => {
    const points = bucketMonthlyTrend(
      [
        row("2026-03-01", 3200, "income"),
        row("2026-03-02", 500, "expense", false),
      ],
      1,
      NOW,
    );

    expect(points[0]).toMatchObject({ outflow: 0, net: 3200 });
  });

  it("ignores rows outside the window", () => {
    const points = bucketMonthlyTrend(
      [row("2024-01-01", 999), row("2026-03-01", 10)],
      2,
      NOW,
    );

    expect(points.reduce((sum, point) => sum + point.outflow, 0)).toBe(10);
  });

  it("accepts an amount that arrives as a string", () => {
    const points = bucketMonthlyTrend([row("2026-03-01", 0)], 1, NOW);
    const asText = bucketMonthlyTrend(
      [{ ...row("2026-03-01", 0), amount: "64.20" }],
      1,
      NOW,
    );

    expect(points[0]!.outflow).toBe(0);
    expect(asText[0]!.outflow).toBeCloseTo(64.2);
  });

  it("skips an unparseable amount instead of poisoning the month with NaN", () => {
    const points = bucketMonthlyTrend(
      [{ ...row("2026-03-01", 0), amount: "not a number" }],
      1,
      NOW,
    );

    expect(points[0]!.outflow).toBe(0);
    expect(points[0]!.net).toBe(0);
  });

  it("labels each point with the month it covers", () => {
    const points = bucketMonthlyTrend([], 2, NOW);

    expect(points.map((point) => point.label)).toEqual([
      "February 2026",
      "March 2026",
    ]);
  });
});
