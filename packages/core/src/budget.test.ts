import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  amortizedMonthlyAmount,
  buildBudgetExpenseBreakdownWithProjection,
  computeMonthlyBudget,
  computeMonthlyBudgetWithProjection,
  getActiveYearlyExpenseTemplates,
  resolveBudgetAsOfDate,
  yearlyExpenseTemplateIds,
} from "./budget";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";

let sequence = 0;

function tx({
  on,
  amount,
  type = "expense",
  name = "Groceries",
  counts = true,
  templateId = null,
  categoryId = "cat-groceries",
}: {
  on: string;
  amount: number;
  type?: CategoryType;
  name?: string;
  counts?: boolean;
  templateId?: string | null;
  categoryId?: string;
}): TransactionWithCategory {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    user_id: "user-1",
    category_id: categoryId,
    recurring_template_id: templateId,
    occurred_on: on,
    amount,
    note: null,
    created_at: `${on}T10:00:00.000Z`,
    categories: { name, type, icon: null, counts_toward_summary: counts },
  };
}

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
  categoryId = "cat-rent",
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
  categoryId?: string;
}): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: categoryId,
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

/** todayIsoLocal() reads the clock, so "current" view needs a fixed one. */
function freezeToday(iso: string) {
  vi.useFakeTimers();
  // Midday keeps the Europe/Paris date the same as the UTC date.
  vi.setSystemTime(new Date(`${iso}T12:00:00.000Z`));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("amortizedMonthlyAmount", () => {
  it("spreads a yearly amount over twelve months", () => {
    expect(amortizedMonthlyAmount(1200)).toBe(100);
  });
});

describe("yearly expense templates", () => {
  const yearly = template({
    id: "t-insurance",
    amount: 1200,
    recurrence: "yearly",
    monthOfYear: 3,
    name: "Insurance",
  });
  const monthly = template({ id: "t-rent", amount: 900 });
  const inactive = template({
    id: "t-old",
    amount: 600,
    recurrence: "yearly",
    monthOfYear: 5,
    active: false,
  });
  const yearlySavings = template({
    id: "t-save",
    amount: 1200,
    recurrence: "yearly",
    monthOfYear: 6,
    type: "savings",
  });

  it("picks only active yearly expense templates", () => {
    const found = getActiveYearlyExpenseTemplates([
      yearly,
      monthly,
      inactive,
      yearlySavings,
    ]);
    expect(found.map((t) => t.id)).toEqual(["t-insurance"]);
  });

  it("exposes their ids as a set", () => {
    expect(yearlyExpenseTemplateIds([yearly, monthly])).toEqual(
      new Set(["t-insurance"]),
    );
  });
});

describe("computeMonthlyBudget", () => {
  it("totals each category type", () => {
    const totals = computeMonthlyBudget(
      [
        tx({ on: "2026-09-01", amount: 2400, type: "income", name: "Salary" }),
        tx({ on: "2026-09-02", amount: 900, type: "expense", name: "Rent" }),
        tx({ on: "2026-09-03", amount: 300, type: "savings", name: "Fund" }),
        tx({ on: "2026-09-04", amount: 200, type: "investment", name: "PEA" }),
      ],
      [],
    );

    expect(totals.income).toBe(2400);
    expect(totals.expense).toBe(900);
    expect(totals.savings).toBe(300);
    expect(totals.investment).toBe(200);
    expect(totals.outflow).toBe(1400);
    expect(totals.net).toBe(1000);
  });

  it("counts an investment excluded from the summary as deployed, not invested", () => {
    const totals = computeMonthlyBudget(
      [
        tx({
          on: "2026-09-04",
          amount: 500,
          type: "investment",
          name: "PEA buy",
          counts: false,
        }),
      ],
      [],
    );

    expect(totals.investment).toBe(0);
    expect(totals.deployed).toBe(500);
    // Deployment is still money leaving the month.
    expect(totals.outflow).toBe(500);
  });

  it("skips an expense excluded from the summary", () => {
    const totals = computeMonthlyBudget(
      [tx({ on: "2026-09-02", amount: 40, counts: false })],
      [],
    );
    expect(totals.expense).toBe(0);
  });

  it("amortises a yearly expense instead of counting the cash payment", () => {
    const yearly = template({
      id: "t-insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 9,
      name: "Insurance",
    });

    const totals = computeMonthlyBudget(
      [
        // The actual once-a-year payment lands this month.
        tx({
          on: "2026-09-15",
          amount: 1200,
          name: "Insurance",
          templateId: "t-insurance",
        }),
      ],
      [yearly],
    );

    // The 1,200 cash payment is replaced by one twelfth of it.
    expect(totals.expense).toBe(100);
  });

  it("amortises a yearly expense in months where it is not paid", () => {
    const yearly = template({
      id: "t-insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 3,
      name: "Insurance",
    });

    expect(computeMonthlyBudget([], [yearly]).expense).toBe(100);
  });

  it("still counts a non-recurring expense in a yearly category", () => {
    const yearly = template({
      id: "t-insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 3,
      name: "Insurance",
    });

    // No template id, so it is a genuine one-off, not the yearly instalment.
    const totals = computeMonthlyBudget(
      [tx({ on: "2026-09-15", amount: 50, name: "Insurance" })],
      [yearly],
    );

    expect(totals.expense).toBe(150);
  });
});

describe("resolveBudgetAsOfDate", () => {
  it("uses the last day of the month for month_end", () => {
    expect(resolveBudgetAsOfDate(2026, 2, "month_end")).toBe("2026-02-28");
    expect(resolveBudgetAsOfDate(2024, 2, "month_end")).toBe("2024-02-29");
  });

  it("uses today for the month in progress", () => {
    freezeToday("2026-09-08");
    expect(resolveBudgetAsOfDate(2026, 9, "current")).toBe("2026-09-08");
  });

  it("uses the month end for a month already past", () => {
    freezeToday("2026-09-08");
    expect(resolveBudgetAsOfDate(2026, 8, "current")).toBe("2026-08-31");
  });

  it("uses the first of the month for a month not yet started", () => {
    freezeToday("2026-09-08");
    expect(resolveBudgetAsOfDate(2026, 10, "current")).toBe("2026-10-01");
  });
});

describe("computeMonthlyBudgetWithProjection", () => {
  const salary = template({
    id: "t-salary",
    amount: 2400,
    type: "income",
    name: "Salary",
    dayOfMonth: 1,
  });
  const rent = template({ id: "t-rent", amount: 900, dayOfMonth: 5 });

  beforeEach(() => {
    freezeToday("2026-09-08");
  });

  it("projects occurrences that have not been applied yet", () => {
    const totals = computeMonthlyBudgetWithProjection(
      [],
      [salary, rent],
      2026,
      9,
      "current",
    );

    expect(totals.income).toBe(2400);
    expect(totals.expense).toBe(900);
  });

  it("does not double-count an occurrence already applied", () => {
    const totals = computeMonthlyBudgetWithProjection(
      [
        tx({
          on: "2026-09-01",
          amount: 2400,
          type: "income",
          name: "Salary",
          templateId: "t-salary",
        }),
      ],
      [salary, rent],
      2026,
      9,
      "current",
    );

    expect(totals.income).toBe(2400);
  });

  it("uses the applied amount when it differs from the template", () => {
    const totals = computeMonthlyBudgetWithProjection(
      [
        tx({
          on: "2026-09-01",
          amount: 2500,
          type: "income",
          name: "Salary",
          templateId: "t-salary",
        }),
      ],
      [salary],
      2026,
      9,
      "current",
    );

    // A bonus month reads as 2,500, not the template's 2,400.
    expect(totals.income).toBe(2500);
  });

  it("excludes occurrences later in the month under the current view", () => {
    const late = template({ id: "t-late", amount: 100, dayOfMonth: 25 });

    const totals = computeMonthlyBudgetWithProjection(
      [],
      [late],
      2026,
      9,
      "current",
    );

    expect(totals.expense).toBe(0);
  });

  it("includes them under the month_end view", () => {
    const late = template({ id: "t-late", amount: 100, dayOfMonth: 25 });

    const totals = computeMonthlyBudgetWithProjection(
      [],
      [late],
      2026,
      9,
      "month_end",
    );

    expect(totals.expense).toBe(100);
  });

  it("ignores a skipped occurrence", () => {
    const totals = computeMonthlyBudgetWithProjection(
      [],
      [salary, rent],
      2026,
      9,
      "current",
      new Set(["t-rent:2026-09-05"]),
    );

    expect(totals.expense).toBe(0);
    expect(totals.income).toBe(2400);
  });

  it("ignores an inactive template", () => {
    const paused = template({ id: "t-gym", amount: 40, active: false });

    expect(
      computeMonthlyBudgetWithProjection([], [paused], 2026, 9, "current")
        .expense,
    ).toBe(0);
  });

  it("respects a template's start date", () => {
    const future = template({
      id: "t-new",
      amount: 50,
      dayOfMonth: 3,
      startsOn: "2026-10-01",
    });

    expect(
      computeMonthlyBudgetWithProjection([], [future], 2026, 9, "month_end")
        .expense,
    ).toBe(0);
  });

  it("respects a template's end date", () => {
    const finished = template({
      id: "t-old",
      amount: 50,
      dayOfMonth: 3,
      endsOn: "2026-08-31",
    });

    expect(
      computeMonthlyBudgetWithProjection([], [finished], 2026, 9, "month_end")
        .expense,
    ).toBe(0);
  });

  it("projects every weekly occurrence in the month", () => {
    // Tuesdays in September 2026: 1, 8, 15, 22, 29.
    const weekly = template({
      id: "t-weekly",
      amount: 10,
      recurrence: "weekly",
      dayOfMonth: null,
      dayOfWeek: 2,
    });

    expect(
      computeMonthlyBudgetWithProjection([], [weekly], 2026, 9, "month_end")
        .expense,
    ).toBe(50);
  });

  it("counts only the weekly occurrences that have happened so far", () => {
    const weekly = template({
      id: "t-weekly",
      amount: 10,
      recurrence: "weekly",
      dayOfMonth: null,
      dayOfWeek: 2,
    });

    // On 8 September, the 1st and the 8th have passed.
    expect(
      computeMonthlyBudgetWithProjection([], [weekly], 2026, 9, "current")
        .expense,
    ).toBe(20);
  });

  it("never projects a yearly expense as cash — it stays amortised", () => {
    const yearly = template({
      id: "t-insurance",
      amount: 1200,
      recurrence: "yearly",
      monthOfYear: 9,
      dayOfMonth: 3,
      name: "Insurance",
    });

    const totals = computeMonthlyBudgetWithProjection(
      [],
      [yearly],
      2026,
      9,
      "month_end",
    );

    expect(totals.expense).toBe(100);
  });

  it("clamps a day-31 template to a short month", () => {
    const late = template({ id: "t-31", amount: 60, dayOfMonth: 31 });

    // September has 30 days; the occurrence must still be counted once.
    expect(
      computeMonthlyBudgetWithProjection([], [late], 2026, 9, "month_end")
        .expense,
    ).toBe(60);
  });

  it("ignores transactions from other months", () => {
    const totals = computeMonthlyBudgetWithProjection(
      [
        tx({ on: "2026-08-31", amount: 500 }),
        tx({ on: "2026-10-01", amount: 500 }),
      ],
      [],
      2026,
      9,
      "month_end",
    );

    expect(totals.expense).toBe(0);
  });

  it("computes net as income minus every outflow", () => {
    const totals = computeMonthlyBudgetWithProjection(
      [
        tx({ on: "2026-09-02", amount: 300, type: "savings", name: "Fund" }),
        tx({
          on: "2026-09-03",
          amount: 200,
          type: "investment",
          name: "PEA",
          counts: false,
        }),
      ],
      [salary, rent],
      2026,
      9,
      "current",
    );

    expect(totals.income).toBe(2400);
    expect(totals.outflow).toBe(900 + 300 + 200);
    expect(totals.net).toBe(2400 - 1400);
  });
});

describe("buildBudgetExpenseBreakdownWithProjection", () => {
  beforeEach(() => {
    freezeToday("2026-09-08");
  });

  it("groups spend by category", () => {
    const rows = buildBudgetExpenseBreakdownWithProjection(
      [
        tx({ on: "2026-09-01", amount: 30, categoryId: "cat-a", name: "Food" }),
        tx({ on: "2026-09-02", amount: 20, categoryId: "cat-a", name: "Food" }),
        tx({ on: "2026-09-03", amount: 10, categoryId: "cat-b", name: "Bus" }),
      ],
      [],
      2026,
      9,
      "current",
    );

    const byCategory = new Map(rows.map((row) => [row.categoryId, row.total]));
    expect(byCategory.get("cat-a")).toBe(50);
    expect(byCategory.get("cat-b")).toBe(10);
  });

  it("includes projected occurrences in the breakdown", () => {
    const rent = template({
      id: "t-rent",
      amount: 900,
      dayOfMonth: 5,
      categoryId: "cat-rent",
    });

    const rows = buildBudgetExpenseBreakdownWithProjection(
      [],
      [rent],
      2026,
      9,
      "current",
    );

    expect(rows.find((row) => row.categoryId === "cat-rent")?.total).toBe(900);
  });

  it("sorts the largest category first", () => {
    const rows = buildBudgetExpenseBreakdownWithProjection(
      [
        tx({ on: "2026-09-01", amount: 10, categoryId: "cat-a", name: "Food" }),
        tx({ on: "2026-09-02", amount: 90, categoryId: "cat-b", name: "Rent" }),
      ],
      [],
      2026,
      9,
      "current",
    );

    expect(rows[0]?.categoryId).toBe("cat-b");
  });
});

describe("money that came back rather than came in", () => {
  const income = (amount: number, counts: boolean, name = "Reimbursements") =>
    ({
      id: `tx-${Math.random()}`,
      user_id: "u",
      category_id: "cat-r",
      recurring_template_id: null,
      occurred_on: "2026-09-10",
      amount,
      note: null,
      created_at: "2026-09-10T00:00:00.000Z",
      categories: {
        name,
        type: "income" as const,
        icon: null,
        counts_toward_summary: counts,
      },
    }) as TransactionWithCategory;

  const spend = (amount: number) =>
    ({
      id: `tx-${Math.random()}`,
      user_id: "u",
      category_id: "cat-subs",
      recurring_template_id: null,
      occurred_on: "2026-09-05",
      amount,
      note: null,
      created_at: "2026-09-05T00:00:00.000Z",
      categories: {
        name: "Subscriptions",
        type: "expense" as const,
        icon: null,
        counts_toward_summary: true,
      },
    }) as TransactionWithCategory;

  it("nets a reimbursement off spending instead of counting it as earnings", () => {
    // Twelve euros paid out for a family plan, nine returned by the others.
    const totals = computeMonthlyBudget([spend(12), income(9, false)], []);

    expect(totals.income).toBe(0);
    expect(totals.expense).toBe(3);
  });

  it("still counts a real income category in full", () => {
    const totals = computeMonthlyBudget(
      [spend(12), income(9, true, "Gifts")],
      [],
    );

    expect(totals.income).toBe(9);
    expect(totals.expense).toBe(12);
  });

  it("reads a month reimbursed more than it spent as having spent nothing", () => {
    const totals = computeMonthlyBudget([spend(5), income(20, false)], []);

    expect(totals.expense).toBe(0);
    expect(totals.income).toBe(0);
  });

  it("leaves the savings rate undistorted by money that was never earned", () => {
    const withReimbursement = computeMonthlyBudget(
      [income(2000, true, "Salary"), spend(12), income(9, false)],
      [],
    );

    // Income is the earnings alone, so the rate is not diluted.
    expect(withReimbursement.income).toBe(2000);
  });
});

describe("money coming back out of savings", () => {
  const saving = (amount: number, counts: boolean) =>
    ({
      id: `tx-${Math.random()}`,
      user_id: "u",
      category_id: counts ? "cat-save" : "cat-withdraw",
      recurring_template_id: null,
      occurred_on: "2026-09-10",
      amount,
      note: null,
      created_at: "2026-09-10T00:00:00.000Z",
      categories: {
        name: counts ? "Savings account" : "From savings",
        type: "savings" as const,
        icon: null,
        counts_toward_summary: counts,
      },
    }) as TransactionWithCategory;

  it("subtracts a withdrawal from what was set aside", () => {
    const totals = computeMonthlyBudget(
      [saving(800, true), saving(500, false)],
      [],
    );

    expect(totals.savings).toBe(300);
  });

  it("does not let a withdrawal read as income or spending", () => {
    const totals = computeMonthlyBudget([saving(500, false)], []);

    expect(totals.income).toBe(0);
    expect(totals.expense).toBe(0);
    expect(totals.savings).toBe(-500);
  });

  it("leaves the outflow lower by what came back", () => {
    // Moving your own money is not spending, and the month's net has to say so.
    const moved = computeMonthlyBudget([saving(500, false)], []);
    const nothing = computeMonthlyBudget([], []);

    expect(moved.outflow).toBe(nothing.outflow - 500);
    expect(moved.net).toBe(nothing.net + 500);
  });
});
