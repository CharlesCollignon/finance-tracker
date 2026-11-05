import { describe, expect, it } from "vitest";

import {
  buildLeftToSpend,
  leftToSpendThrough,
  nextPayDay,
  payTemplate,
} from "./left-to-spend";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
} from "./types/database";

function template(
  id: string,
  day: number,
  amount: number,
  type: CategoryType,
  options: {
    active?: boolean;
    recurrence?: "monthly" | "weekly" | "yearly";
    startsOn?: string;
    endsOn?: string;
    months?: number[];
  } = {},
): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "u",
    category_id: `cat-${type}`,
    amount,
    day_of_month: day,
    day_of_week: null,
    month_of_year: options.recurrence === "yearly" ? 12 : null,
    recurrence: options.recurrence ?? "monthly",
    months: options.months ?? null,
    active: options.active ?? true,
    description: null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: options.startsOn ?? null,
    ends_on: options.endsOn ?? null,
    property_id: null,
    funded_by_transfer: false,
    created_at: "2026-01-01T00:00:00Z",
    categories: { name: type, type, icon: null, counts_toward_summary: true },
  };
}

/** A line from `from` to `to`, one point a day, from a function of the day. */
function line(
  from: string,
  to: string,
  value: (date: string) => number,
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (
    let at = new Date(`${from}T00:00:00Z`);
    at <= new Date(`${to}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + 1)
  ) {
    const date = at.toISOString().slice(0, 10);
    points.push({ date, value: value(date) });
  }
  return points;
}

describe("payTemplate", () => {
  it("picks the largest active recurring income", () => {
    const salary = template("salary", 28, 2400, "income");
    expect(
      payTemplate([
        template("rent", 5, 900, "expense"),
        template("caf", 5, 180, "income"),
        salary,
        template("old", 1, 3000, "income", { active: false }),
        template("bonus", 15, 5000, "income", { recurrence: "yearly" }),
      ]),
    ).toBe(salary);
  });

  it("is null with no recurring income", () => {
    expect(payTemplate([template("rent", 5, 900, "expense")])).toBeNull();
  });

  it("compares by what each brings a month, so a quarterly bonus does not outrank the salary", () => {
    const salary = template("salary", 28, 2500, "income");
    expect(
      payTemplate([
        template("quarterly", 15, 3000, "income", { months: [3, 6, 9, 12] }),
        salary,
      ]),
    ).toBe(salary);
  });

  it("runs to a pay that only comes every quarter", () => {
    const quarterly = template("quarterly", 15, 9000, "income", {
      months: [1, 4, 7, 10],
    });
    expect(payTemplate([quarterly])).toBe(quarterly);
  });
});

describe("nextPayDay, paid every quarter", () => {
  it("finds the next quarter's day, months ahead", () => {
    expect(
      nextPayDay({
        template: template("quarterly", 15, 9000, "income", {
          months: [1, 4, 7, 10],
        }),
        today: "2026-11-05",
        owed: [],
      }),
    ).toBe("2027-01-15");
  });

  it("finds a pay that comes twice a year", () => {
    expect(
      nextPayDay({
        template: template("half", 30, 9000, "income", { months: [6, 12] }),
        today: "2027-01-10",
        owed: [],
      }),
    ).toBe("2027-06-30");
  });
});

describe("nextPayDay", () => {
  const salary = template("salary", 28, 2400, "income");

  it("is this month's when it is still owed", () => {
    expect(
      nextPayDay({
        template: salary,
        today: "2026-10-08",
        owed: [{ key: "salary:2026-10-28", occurredOn: "2026-10-28" }],
      }),
    ).toBe("2026-10-28");
  });

  it("is tomorrow for one the bank still owes from a day behind", () => {
    expect(
      nextPayDay({
        template: salary,
        today: "2026-10-29",
        owed: [{ key: "salary:2026-10-28", occurredOn: "2026-10-28" }],
      }),
    ).toBe("2026-10-30");
  });

  it("is next month's once this month's has come", () => {
    expect(
      nextPayDay({ template: salary, today: "2026-10-29", owed: [] }),
      // The 28th is a Saturday: paid on the Friday.
    ).toBe("2026-11-27");
  });

  it("ignores what other templates still owe", () => {
    expect(
      nextPayDay({
        template: salary,
        today: "2026-10-08",
        owed: [{ key: "caf:2026-10-10", occurredOn: "2026-10-10" }],
      }),
    ).toBe("2026-11-27");
  });

  it("is null once the income has ended", () => {
    expect(
      nextPayDay({
        template: template("salary", 28, 2400, "income", {
          endsOn: "2026-10-31",
        }),
        today: "2026-10-29",
        owed: [],
      }),
    ).toBeNull();
  });
});

describe("leftToSpendThrough", () => {
  it("runs to the eve of the pay day", () => {
    expect(leftToSpendThrough("2026-10-08", "2026-10-28")).toBe("2026-10-27");
  });

  it("runs to the month's end without one", () => {
    expect(leftToSpendThrough("2026-10-08", null)).toBe("2026-10-31");
  });
});

describe("buildLeftToSpend", () => {
  it("is the balance on the eve of the pay day when only charges are ahead", () => {
    // 1,000 today; 300 of rent on the 15th.
    const points = line("2026-10-01", "2026-10-31", (date) =>
      date < "2026-10-15" ? 1000 : 700,
    );
    expect(
      buildLeftToSpend({
        today: "2026-10-08",
        payDay: "2026-10-28",
        points,
        monthlyMarge: null,
      }),
    ).toEqual({
      amount: 700,
      through: "2026-10-27",
      payDay: "2026-10-28",
      days: 20,
      perDay: 35,
      marge: 0,
      card: null,
    });
  });

  it("takes the lowest point, not the last day's", () => {
    // A charge of 900 on the 12th, then 200 back on the 20th.
    const points = line("2026-10-01", "2026-10-31", (date) =>
      date < "2026-10-12" ? 1000 : date < "2026-10-20" ? 100 : 300,
    );
    const figure = buildLeftToSpend({
      today: "2026-10-08",
      payDay: "2026-10-28",
      points,
      monthlyMarge: null,
    });
    expect(figure?.amount).toBe(100);
  });

  it("takes the marge's share for the days it covers", () => {
    const points = line("2026-10-01", "2026-10-31", () => 1000);
    const figure = buildLeftToSpend({
      today: "2026-10-08",
      payDay: "2026-10-28",
      points,
      // 20 days of a 31-day month.
      monthlyMarge: 310,
    });
    expect(figure?.marge).toBe(200);
    expect(figure?.amount).toBe(800);
    expect(figure?.perDay).toBe(40);
  });

  it("runs into next month when the pay day is there", () => {
    const points = [
      ...line("2026-10-01", "2026-10-31", () => 500),
      ...line("2026-11-01", "2026-11-30", (date) =>
        date < "2026-11-05" ? 400 : 2900,
      ),
    ];
    const figure = buildLeftToSpend({
      today: "2026-10-29",
      payDay: "2026-11-05",
      points,
      monthlyMarge: null,
    });
    expect(figure).toMatchObject({
      amount: 400,
      through: "2026-11-04",
      days: 7,
    });
  });

  it("runs to the month's end with no pay day", () => {
    const points = line("2026-10-01", "2026-10-31", () => 620);
    expect(
      buildLeftToSpend({
        today: "2026-10-08",
        payDay: null,
        points,
        monthlyMarge: null,
      }),
    ).toMatchObject({ through: "2026-10-31", payDay: null, days: 24 });
  });

  it("says what is missing below zero, and spreads nothing", () => {
    const points = line("2026-10-01", "2026-10-31", (date) =>
      date < "2026-10-20" ? 200 : -80,
    );
    expect(
      buildLeftToSpend({
        today: "2026-10-08",
        payDay: "2026-10-28",
        points,
        monthlyMarge: null,
      }),
    ).toMatchObject({ amount: -80, perDay: null });
  });

  it("covers today alone on the eve of the pay day", () => {
    const points = line("2026-10-01", "2026-10-31", () => 90);
    expect(
      buildLeftToSpend({
        today: "2026-10-27",
        payDay: "2026-10-28",
        points,
        monthlyMarge: null,
      }),
    ).toMatchObject({ days: 1, perDay: 90 });
  });

  it("is null when the line does not reach today", () => {
    expect(
      buildLeftToSpend({
        today: "2026-10-08",
        payDay: null,
        points: line("2026-09-01", "2026-09-30", () => 1),
        monthlyMarge: null,
      }),
    ).toBeNull();
  });
});

describe("buildLeftToSpend, a deferred card", () => {
  // 1,000 today, the balance line already lower by 300 on the 25th: the
  // card's October payments debited then, before the pay on the 28th.
  const points = line("2026-10-01", "2026-10-31", (date) =>
    date < "2026-10-25" ? 1000 : 700,
  );

  it("names a debit before the pay day, already in the balance's line", () => {
    const figure = buildLeftToSpend({
      today: "2026-10-08",
      payDay: "2026-10-28",
      points,
      monthlyMarge: null,
      laterDebits: [{ date: "2026-10-25", amount: 300 }],
    })!;
    expect(figure.amount).toBe(700);
    expect(figure.card).toEqual({ amount: 300, debitOn: "2026-10-25" });
  });

  it("still takes off a debit that falls after the pay day", () => {
    const flat = line("2026-10-01", "2026-10-31", () => 1000);
    const figure = buildLeftToSpend({
      today: "2026-10-08",
      payDay: "2026-10-28",
      points: flat,
      monthlyMarge: null,
      laterDebits: [{ date: "2026-10-31", amount: 450 }],
    })!;
    expect(figure.amount).toBe(550);
    expect(figure.card).toEqual({ amount: 450, debitOn: "2026-10-31" });
  });
});
