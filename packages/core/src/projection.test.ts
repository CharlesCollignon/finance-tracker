import { describe, expect, it } from "vitest";

import {
  buildForwardProjection,
  buildRunway,
  formatRunway,
  measuredUnrecorded,
} from "./projection";
import type { CloseHistorySummary } from "./month-close";
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

const MONTH_START = "2026-10-01";

/**
 * Paid on the 28th, so on the 1st of the month nothing has landed yet.
 *
 * The shared `salary` falls on the 1st, which makes it useless for the
 * opening-balance tests: a balance read on the 1st already contains it.
 */
const latePay = template({
  id: "late-pay",
  amount: 3000,
  type: "income",
  name: "Salary",
  dayOfMonth: 28,
});

function closes(baseline: number | null, sample: number): CloseHistorySummary {
  return { baseline, sample, streak: 0, bestStreak: 0 };
}

function project(
  templates: RecurringTemplateWithCategory[],
  overrides: Partial<Parameters<typeof buildForwardProjection>[0]> = {},
) {
  return buildForwardProjection({
    templates,
    year: 2026,
    month: 10,
    today: MONTH_START,
    onHand: null,
    closes: null,
    ...overrides,
  });
}

describe("buildForwardProjection", () => {
  it("projects twelve months by default", () => {
    expect(project([salary, rent]).points).toHaveLength(12);
  });

  it("starts at the month it is given and walks forward", () => {
    const { points } = project([salary], {
      month: 11,
      today: "2026-11-01",
      months: 3,
    });
    expect(points.map((p) => p.monthKey)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("computes each month's flows from the templates", () => {
    const [first] = project([salary, rent], { months: 1 }).points;
    expect(first!.income).toBe(3000);
    expect(first!.expense).toBe(1000);
    expect(first!.onHand).toBe(2000);
  });

  it("accumulates both tracks across months", () => {
    const { points } = project([salary, rent], { months: 3 });
    expect(points.map((p) => p.onHand)).toEqual([2000, 4000, 6000]);
    expect(points.map((p) => p.kept)).toEqual([2000, 4000, 6000]);
  });

  it("separates the two tracks by exactly what is set aside", () => {
    const save = template({
      id: "save",
      amount: 400,
      type: "savings",
      name: "Fund",
    });
    const { points } = project([salary, rent, save], { months: 3 });

    expect(points.map((p) => p.onHand)).toEqual([1600, 3200, 4800]);
    expect(points.map((p) => p.kept)).toEqual([2000, 4000, 6000]);
    // Money set aside leaves the account and stays the user's.
    expect(points[2]!.kept - points[2]!.onHand).toBe(1200);
  });

  it("leaves both tracks alone for money already inside a wallet", () => {
    // A DCA whose cash left the account when it was transferred in.
    const dca = template({
      id: "dca",
      amount: 300,
      type: "investment",
      name: "PEA",
      counts: false,
    });
    const [first] = project([salary, dca], { months: 1 }).points;

    expect(first!.deployed).toBe(300);
    expect(first!.setAside).toBe(0);
    expect(first!.onHand).toBe(3000);
    expect(first!.kept).toBe(3000);
  });

  it("starts both tracks from the money actually on hand", () => {
    const { points, summary } = project([latePay, rent], {
      months: 2,
      onHand: 5000,
    });

    expect(points.map((p) => p.onHand)).toEqual([7000, 9000]);
    expect(summary!.grounded).toBe(true);
    expect(summary!.addedToAccounts).toBe(4000);
  });

  it("takes off what this month has already put through the account", () => {
    /* Rent lands on the 5th, the pay on the 28th. A balance of 5000 read on
       the 20th has already lost the rent and not yet gained the pay, so it
       is a richer position than the same 5000 read on the 1st — and October
       ends at 8000 rather than 7000. The month itself still projects whole;
       what moves is the opening it is added to. */
    const atStart = project([latePay, rent], { months: 2, onHand: 5000 });
    const midMonth = project([latePay, rent], {
      months: 2,
      onHand: 5000,
      today: "2026-10-20",
    });

    expect(midMonth.opening.elapsed).toEqual({
      income: 0,
      expense: 1000,
      setAside: 0,
    });
    expect(atStart.points.map((p) => p.onHand)).toEqual([7000, 9000]);
    expect(midMonth.points.map((p) => p.onHand)).toEqual([8000, 10000]);
    // The whole window shifts by the same amount; nothing compounds.
    expect(midMonth.points[1]!.onHand - atStart.points[1]!.onHand).toBe(1000);
  });

  it("starts from zero and says so when there is no balance to read", () => {
    const { points, summary } = project([salary, rent], { months: 2 });

    expect(points[0]!.onHand).toBe(2000);
    expect(summary!.grounded).toBe(false);
    // The figures are what the months add, and the caller has to say so.
    expect(summary!.endingOnHand).toBe(summary!.addedToAccounts);
  });

  it("subtracts what closed months measure a normal one costs unseen", () => {
    const { points, summary } = project([salary, rent], {
      months: 2,
      closes: closes(250, 4),
    });

    expect(points[0]!.unrecorded).toBe(250);
    expect(points.map((p) => p.onHand)).toEqual([1750, 3500]);
    // It is spending, so it comes off both tracks.
    expect(points.map((p) => p.kept)).toEqual([1750, 3500]);
    expect(summary!.unrecordedCounted).toBe(true);
  });

  it("subtracts nothing from too short a history", () => {
    const { points, summary } = project([salary, rent], {
      months: 1,
      closes: closes(250, 1),
    });

    expect(points[0]!.unrecorded).toBe(0);
    expect(points[0]!.onHand).toBe(2000);
    expect(summary!.unrecordedCounted).toBe(false);
  });

  it("projects a whole month even when starting mid-month", () => {
    const late = template({ id: "late", amount: 100, dayOfMonth: 25 });
    const [first] = project([late], { months: 1 }).points;
    expect(first!.expense).toBe(100);
  });

  it("amortises a yearly expense across every month", () => {
    const yearly = template({
      id: "insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 3,
      name: "Insurance",
    });

    const { points } = project([yearly], { months: 3 });
    expect(points.every((point) => point.expense === 100)).toBe(true);
  });

  it("leaves no rounding residue on the running totals", () => {
    // 1000/12 is a repeating decimal, and twelve of them used to accumulate
    // into a headline unrounded.
    const yearly = template({
      id: "insurance",
      amount: 1000,
      recurrence: "yearly",
      monthOfYear: 3,
      name: "Insurance",
    });

    const { points } = project([yearly], { months: 12 });
    for (const point of points) {
      expect(point.onHand).toBe(Math.round(point.onHand * 100) / 100);
    }
  });

  it("stops counting a template after its end date", () => {
    const ending = template({ id: "gym", amount: 50, endsOn: "2026-11-30" });
    const { points } = project([ending], { months: 4 });
    expect(points.map((p) => p.expense)).toEqual([50, 50, 0, 0]);
  });

  it("starts counting a template only from its start date", () => {
    const starting = template({
      id: "course",
      amount: 80,
      startsOn: "2026-12-01",
    });

    const { points } = project([starting], { months: 4 });
    expect(points.map((p) => p.expense)).toEqual([0, 0, 80, 80]);
  });

  it("ignores inactive templates", () => {
    const paused = template({ id: "paused", amount: 99, active: false });
    const [first] = project([paused], { months: 1 }).points;
    expect(first!.expense).toBe(0);
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

    const { points } = project([weekly], { months: 2 });
    expect(points[0]!.expense).toBe(50);
    expect(points[1]!.expense).toBe(40);
  });

  it("crosses the year boundary", () => {
    const { points } = project([salary], {
      month: 12,
      today: "2026-12-01",
      months: 2,
    });
    expect(points[1]!.monthKey).toBe("2027-01");
    expect(points[1]!.label).toContain("January");
  });

  it("labels the months in the caller's language", () => {
    const { points } = project([salary], { months: 1, locale: "fr" });
    expect(points[0]!.label).toContain("octobre");
  });

  it("returns nothing for a zero-month window", () => {
    const projection = project([salary], { months: 0 });
    expect(projection.points).toEqual([]);
    expect(projection.summary).toBeNull();
  });
});

describe("the summary", () => {
  it("summarises the window", () => {
    const summary = project([salary, rent], { months: 12 }).summary!;

    expect(summary.endingOnHand).toBe(24000);
    expect(summary.addedToAccounts).toBe(24000);
    expect(summary.monthlyToAccounts).toBe(2000);
    expect(summary.shrinking).toBe(false);
  });

  it("excludes the opening balance from what was added", () => {
    const summary = project([latePay, rent], {
      months: 2,
      onHand: 1000,
    }).summary!;

    expect(summary.endingOnHand).toBe(5000);
    expect(summary.addedToAccounts).toBe(4000);
  });

  it("alarms on what is kept rather than on what the accounts hold", () => {
    // Everything above the rent goes into a wallet. The accounts flatline;
    // the person is not getting poorer, and must not be told they are.
    const invest = template({
      id: "etf",
      amount: 2000,
      type: "investment",
      name: "World",
    });
    const summary = project([salary, rent, invest], { months: 3 }).summary!;

    expect(summary.accountsFalling).toBe(false);
    expect(summary.shrinking).toBe(false);
    expect(summary.addedToAccounts).toBe(0);
    expect(summary.addedAltogether).toBe(6000);
  });

  it("says the accounts are falling without calling it shrinking", () => {
    const invest = template({
      id: "etf",
      amount: 2500,
      type: "investment",
      name: "World",
    });
    const summary = project([salary, rent, invest], { months: 3 }).summary!;

    expect(summary.accountsFalling).toBe(true);
    expect(summary.shrinking).toBe(false);
  });

  it("flags a genuinely shrinking projection", () => {
    const expensive = template({ id: "big", amount: 4000 });
    const summary = project([salary, expensive], { months: 3 }).summary!;

    expect(summary.shrinking).toBe(true);
    expect(summary.accountsFalling).toBe(true);
  });
});

describe("what the projection is made of", () => {
  const ingredient = (projection: ReturnType<typeof project>, kind: string) =>
    projection.makeup.ingredients.find((row) => row.kind === kind);

  /** The same, narrowed to the kinds that count charges behind them. */
  const charged = (projection: ReturnType<typeof project>, kind: string) => {
    const row = ingredient(projection, kind);
    return row && row.kind !== "unrecorded" ? row : undefined;
  };

  it("states each ingredient and how many charges back it", () => {
    const save = template({
      id: "save",
      amount: 400,
      type: "savings",
      name: "Fund",
    });
    const projection = project([salary, rent, save], { months: 12 });

    expect(ingredient(projection, "income")).toMatchObject({
      monthly: 3000,
      charges: 1,
    });
    expect(ingredient(projection, "committed")).toMatchObject({
      monthly: 1000,
      charges: 1,
    });
    expect(ingredient(projection, "set-aside")).toMatchObject({
      monthly: 400,
      charges: 1,
    });
  });

  it("counts charges rather than occurrences", () => {
    const weekly = template({
      id: "weekly",
      amount: 10,
      recurrence: "weekly",
      dayOfMonth: null,
      dayOfWeek: 4,
    });
    const yearly = template({
      id: "insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 3,
      name: "Insurance",
    });
    const projection = project([rent, weekly, yearly], { months: 12 });

    expect(charged(projection, "committed")!.charges).toBe(3);
  });

  it("averages a charge that ends mid-window over the whole window", () => {
    const ending = template({ id: "gym", amount: 60, endsOn: "2026-11-30" });
    // Two months of 60 across a four-month window.
    const projection = project([ending], { months: 4 });

    expect(charged(projection, "committed")!.monthly).toBe(30);
  });

  it("reconciles with what a month adds to the accounts", () => {
    const save = template({
      id: "save",
      amount: 400,
      type: "savings",
      name: "Fund",
    });
    const projection = project([salary, rent, save], {
      months: 12,
      closes: closes(200, 3),
    });
    const { makeup, summary } = projection;
    const value = (kind: string) =>
      makeup.ingredients.find((row) => row.kind === kind)!.monthly;

    expect(
      value("income") -
        value("committed") -
        value("set-aside") -
        value("unrecorded"),
    ).toBe(summary!.monthlyToAccounts);
  });

  it("mentions money moved inside a wallet only when there is some", () => {
    const dca = template({
      id: "dca",
      amount: 300,
      type: "investment",
      name: "PEA",
      counts: false,
    });

    expect(ingredient(project([salary, dca]), "deployed")).toMatchObject({
      monthly: 300,
      charges: 1,
    });
    expect(ingredient(project([salary, rent]), "deployed")).toBeUndefined();
  });

  it("says whether everyday spending was measured or not", () => {
    expect(
      ingredient(project([salary], { closes: closes(250, 4) }), "unrecorded"),
    ).toMatchObject({ monthly: 250, closes: 4, counted: true });
    expect(
      ingredient(project([salary], { closes: closes(250, 1) }), "unrecorded"),
    ).toMatchObject({ monthly: 0, closes: 1, counted: false });
    expect(ingredient(project([salary]), "unrecorded")).toMatchObject({
      monthly: 0,
      closes: 0,
      counted: false,
    });
  });

  it("flags a window that nothing brings money into", () => {
    expect(project([rent]).makeup.noIncomeScheduled).toBe(true);
    expect(project([salary, rent]).makeup.noIncomeScheduled).toBe(false);
    expect(project([]).makeup.noIncomeScheduled).toBe(true);
  });

  it("flags no income when the only income charge has already ended", () => {
    const past = template({
      id: "old-job",
      amount: 3000,
      type: "income",
      name: "Salary",
      endsOn: "2026-09-30",
    });

    expect(project([past, rent]).makeup.noIncomeScheduled).toBe(true);
  });
});

describe("measuredUnrecorded", () => {
  it("answers zero without a history to measure from", () => {
    expect(measuredUnrecorded(null)).toBe(0);
    expect(measuredUnrecorded(closes(null, 0))).toBe(0);
  });

  it("waits for a second close before believing the median", () => {
    expect(measuredUnrecorded(closes(300, 1))).toBe(0);
    expect(measuredUnrecorded(closes(300, 2))).toBe(300);
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
