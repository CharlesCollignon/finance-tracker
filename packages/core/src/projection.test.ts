import { describe, expect, it } from "vitest";

import {
  buildForwardProjection,
  buildRunway,
  formatRunway,
  summarizeProjection,
} from "./projection";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
} from "./types/database";

function template({
  id,
  amount,
  type = "expense",
  name = "Rent",
  counts = true,
  recurrence = "monthly",
  dayOfMonth = 1,
  dayOfWeek = null,
  monthOfYear = null,
  active = true,
  startsOn = null,
  endsOn = null,
}: {
  id: string;
  amount: number;
  type?: CategoryType;
  name?: string;
  counts?: boolean;
  recurrence?: "monthly" | "weekly" | "yearly";
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  monthOfYear?: number | null;
  active?: boolean;
  startsOn?: string | null;
  endsOn?: string | null;
}): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: `cat-${id}`,
    amount,
    day_of_month: dayOfMonth,
    day_of_week: dayOfWeek,
    month_of_year: monthOfYear,
    recurrence,
    active,
    description: null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: startsOn,
    ends_on: endsOn,
    created_at: "2024-01-01T00:00:00.000Z",
    categories: { name, type, icon: null, counts_toward_summary: counts },
  };
}

const salary = template({
  id: "salary",
  amount: 3000,
  type: "income",
  name: "Salary",
});
const rent = template({ id: "rent", amount: 1000, dayOfMonth: 5 });

describe("buildForwardProjection", () => {
  it("projects twelve months by default", () => {
    expect(buildForwardProjection([salary, rent], 2026, 10)).toHaveLength(12);
  });

  it("starts at the month it is given and walks forward", () => {
    const points = buildForwardProjection([salary], 2026, 11, { months: 3 });
    expect(points.map((p) => p.monthKey)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("computes each month's net from the templates", () => {
    const [first] = buildForwardProjection([salary, rent], 2026, 10, {
      months: 1,
    });
    expect(first!.income).toBe(3000);
    expect(first!.outflow).toBe(1000);
    expect(first!.net).toBe(2000);
  });

  it("accumulates the running total across months", () => {
    const points = buildForwardProjection([salary, rent], 2026, 10, {
      months: 3,
    });
    expect(points.map((p) => p.cumulative)).toEqual([2000, 4000, 6000]);
  });

  it("starts the running total from an opening balance", () => {
    const points = buildForwardProjection([salary, rent], 2026, 10, {
      months: 2,
      startingBalance: 5000,
    });
    expect(points.map((p) => p.cumulative)).toEqual([7000, 9000]);
  });

  it("counts savings and investment as set aside, not as loss", () => {
    const save = template({
      id: "save",
      amount: 400,
      type: "savings",
      name: "Fund",
    });
    const [first] = buildForwardProjection([salary, save], 2026, 10, {
      months: 1,
    });

    expect(first!.setAside).toBe(400);
    // It still leaves the month's spendable money.
    expect(first!.net).toBe(2600);
  });

  it("projects a whole month even when starting mid-month", () => {
    // A template on day 25 must still count in the starting month.
    const late = template({ id: "late", amount: 100, dayOfMonth: 25 });
    const [first] = buildForwardProjection([late], 2026, 10, { months: 1 });
    expect(first!.outflow).toBe(100);
  });

  it("amortises a yearly expense across every month", () => {
    const yearly = template({
      id: "insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 3,
      name: "Insurance",
    });

    const points = buildForwardProjection([yearly], 2026, 10, { months: 3 });
    // One twelfth every month, including months it is not paid in.
    expect(points.every((point) => point.outflow === 100)).toBe(true);
  });

  it("stops counting a template after its end date", () => {
    const ending = template({
      id: "gym",
      amount: 50,
      endsOn: "2026-11-30",
    });

    const points = buildForwardProjection([ending], 2026, 10, { months: 4 });
    expect(points.map((p) => p.outflow)).toEqual([50, 50, 0, 0]);
  });

  it("starts counting a template only from its start date", () => {
    const starting = template({
      id: "course",
      amount: 80,
      startsOn: "2026-12-01",
    });

    const points = buildForwardProjection([starting], 2026, 10, { months: 4 });
    expect(points.map((p) => p.outflow)).toEqual([0, 0, 80, 80]);
  });

  it("ignores inactive templates", () => {
    const paused = template({ id: "paused", amount: 99, active: false });
    const [first] = buildForwardProjection([paused], 2026, 10, { months: 1 });
    expect(first!.outflow).toBe(0);
  });

  it("varies with the number of weekly occurrences in each month", () => {
    // Thursdays: October 2026 has 5, November has 4.
    const weekly = template({
      id: "weekly",
      amount: 10,
      recurrence: "weekly",
      dayOfMonth: null,
      dayOfWeek: 4,
    });

    const points = buildForwardProjection([weekly], 2026, 10, { months: 2 });
    expect(points[0]!.outflow).toBe(50);
    expect(points[1]!.outflow).toBe(40);
  });

  it("crosses the year boundary", () => {
    const points = buildForwardProjection([salary], 2026, 12, { months: 2 });
    expect(points[1]!.monthKey).toBe("2027-01");
    expect(points[1]!.label).toContain("January");
  });

  it("returns nothing for a zero-month window", () => {
    expect(buildForwardProjection([salary], 2026, 10, { months: 0 })).toEqual(
      [],
    );
  });
});

describe("summarizeProjection", () => {
  it("summarises the window", () => {
    const points = buildForwardProjection([salary, rent], 2026, 10, {
      months: 12,
    });
    const summary = summarizeProjection(points)!;

    expect(summary.endingBalance).toBe(24000);
    expect(summary.totalAdded).toBe(24000);
    expect(summary.monthlyAverage).toBe(2000);
    expect(summary.shrinking).toBe(false);
  });

  it("excludes the opening balance from what was added", () => {
    const points = buildForwardProjection([salary, rent], 2026, 10, {
      months: 2,
      startingBalance: 1000,
    });
    const summary = summarizeProjection(points, 1000)!;

    expect(summary.endingBalance).toBe(5000);
    expect(summary.totalAdded).toBe(4000);
  });

  it("flags a shrinking projection", () => {
    const expensive = template({ id: "big", amount: 4000 });
    const points = buildForwardProjection([salary, expensive], 2026, 10, {
      months: 3,
    });

    expect(summarizeProjection(points)!.shrinking).toBe(true);
  });

  it("returns null for an empty projection", () => {
    expect(summarizeProjection([])).toBeNull();
  });
});

describe("buildRunway", () => {
  it("divides the reserve by committed expenses", () => {
    const runway = buildRunway(4200, [salary, rent], 2026, 10);

    expect(runway.monthlyCommitted).toBe(1000);
    expect(runway.months).toBe(4.2);
  });

  it("excludes savings and investment from what is committed", () => {
    // Someone under pressure stops contributing; they still pay rent.
    const save = template({
      id: "save",
      amount: 500,
      type: "savings",
      name: "Fund",
    });
    const invest = template({
      id: "dca",
      amount: 300,
      type: "investment",
      name: "PEA",
      counts: false,
    });

    const runway = buildRunway(2000, [rent, save, invest], 2026, 10);
    expect(runway.monthlyCommitted).toBe(1000);
    expect(runway.months).toBe(2);
  });

  it("has no answer when nothing is committed", () => {
    const runway = buildRunway(5000, [salary], 2026, 10);
    expect(runway.monthlyCommitted).toBe(0);
    expect(runway.months).toBeNull();
  });
});

describe("formatRunway", () => {
  it("states the months covered", () => {
    expect(formatRunway(buildRunway(4200, [rent], 2026, 10))).toBe(
      "4.2 months of committed costs.",
    );
  });

  it("says nothing when there is no reserve", () => {
    expect(formatRunway(buildRunway(0, [rent], 2026, 10))).toBeNull();
  });

  it("says nothing when nothing is committed", () => {
    expect(formatRunway(buildRunway(5000, [], 2026, 10))).toBeNull();
  });

  it("handles less than a month plainly", () => {
    expect(formatRunway(buildRunway(500, [rent], 2026, 10))).toBe(
      "Under a month of committed costs.",
    );
  });
});
