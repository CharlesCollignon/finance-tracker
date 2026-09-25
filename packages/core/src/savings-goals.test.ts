import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBudgetSavingsBreakdownWithProjection,
  computeMonthlyBudgetWithProjection,
} from "./budget";
import {
  buildGoalRunningTotals,
  buildSavingsGoalProgress,
  earliestGoalStart,
  EMPTY_GOAL_LEDGER,
  goalTotalsAsOf,
  type GoalLedger,
} from "./savings-goals";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
  SavingsGoal,
  TransactionWithCategory,
} from "./types/database";

let sequence = 0;

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  sequence += 1;
  return {
    id: `goal-${sequence}`,
    user_id: "user-1",
    name: "Holidays",
    target_amount: 1000,
    target_date: null,
    category_id: "cat-holidays",
    starts_on: "2026-01-01",
    created_at: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

function tx({
  on,
  amount,
  categoryId = "cat-holidays",
  type = "savings",
  counts = true,
  templateId = null,
}: {
  on: string;
  amount: number;
  categoryId?: string;
  type?: CategoryType;
  counts?: boolean;
  templateId?: string | null;
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
    categories: {
      name: categoryId,
      type,
      icon: null,
      counts_toward_summary: counts,
    },
  };
}

function template({
  id,
  amount,
  categoryId = "cat-holidays",
  counts = true,
  dayOfMonth = 5,
  active = true,
}: {
  id: string;
  amount: number;
  categoryId?: string;
  counts?: boolean;
  dayOfMonth?: number;
  active?: boolean;
}): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: categoryId,
    amount,
    day_of_month: dayOfMonth,
    day_of_week: null,
    month_of_year: null,
    recurrence: "monthly",
    active,
    description: null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: null,
    ends_on: null,
    created_at: "2025-01-01T00:00:00.000Z",
    categories: {
      name: categoryId,
      type: "savings",
      icon: null,
      counts_toward_summary: counts,
    },
  };
}

function ledger(
  transactions: TransactionWithCategory[],
  extra: Partial<GoalLedger> = {},
): GoalLedger {
  return {
    transactions,
    appliedKeys: new Set(
      transactions
        .filter((row) => row.recurring_template_id)
        .map((row) => `${row.recurring_template_id}:${row.occurred_on}`),
    ),
    skippedKeys: new Set(),
    ...extra,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildGoalRunningTotals", () => {
  it("adds a linked category across every month from the start to the as-of day", () => {
    const holidays = goal({ starts_on: "2026-01-01" });
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger([
        tx({ on: "2025-12-20", amount: 999 }), // before the start
        tx({ on: "2026-01-10", amount: 100 }),
        tx({ on: "2026-02-10", amount: 150 }),
        tx({ on: "2026-03-10", amount: 200 }),
        tx({ on: "2026-03-20", amount: 999 }), // after the as-of day
        tx({ on: "2026-02-11", amount: 50, categoryId: "cat-other" }),
      ]),
      [],
      "2026-03-15",
    );
    expect(totals.get(holidays.id)).toBe(450);
  });

  it("counts the first month from the start day, not from the first", () => {
    const holidays = goal({ starts_on: "2026-03-10" });
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger([
        tx({ on: "2026-03-03", amount: 40 }),
        tx({ on: "2026-03-12", amount: 60 }),
      ]),
      // Due on the 5th: before the start, so it does not count this month.
      [template({ id: "tpl-1", amount: 80, dayOfMonth: 5 })],
      "2026-03-31",
    );
    expect(totals.get(holidays.id)).toBe(60);
  });

  it("counts all savings for a goal with no category, and takes withdrawals off", () => {
    const buffer = goal({ category_id: null });
    const totals = buildGoalRunningTotals(
      [buffer],
      ledger([
        tx({ on: "2026-01-10", amount: 300, categoryId: "cat-a" }),
        tx({ on: "2026-02-10", amount: 200, categoryId: "cat-b" }),
        // A savings category marked as not counting is money coming back out.
        tx({
          on: "2026-02-20",
          amount: 120,
          categoryId: "cat-out",
          counts: false,
        }),
        // Not savings at all.
        tx({
          on: "2026-02-21",
          amount: 70,
          categoryId: "cat-food",
          type: "expense",
        }),
      ]),
      [],
      "2026-02-28",
    );
    expect(totals.get(buffer.id)).toBe(380);
  });

  it("counts occurrences due by the as-of day that were neither applied nor skipped", () => {
    const holidays = goal({ starts_on: "2026-01-01" });
    const monthly = template({ id: "tpl-1", amount: 50, dayOfMonth: 5 });
    const paused = template({ id: "tpl-2", amount: 999, active: false });
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger(
        // January's occurrence was applied, at its own amount.
        [tx({ on: "2026-01-05", amount: 55, templateId: "tpl-1" })],
        { skippedKeys: new Set(["tpl-1:2026-02-05"]) },
      ),
      [monthly, paused],
      "2026-04-04",
    );
    // January applied (55), February skipped, March unapplied (50), April not
    // due until the 5th.
    expect(totals.get(holidays.id)).toBe(105);
  });

  it("adds nothing for a non-counting template to an all-savings goal", () => {
    const buffer = goal({ category_id: null });
    const totals = buildGoalRunningTotals(
      [buffer],
      ledger([]),
      [
        template({
          id: "tpl-out",
          amount: 40,
          categoryId: "cat-out",
          counts: false,
        }),
      ],
      "2026-01-31",
    );
    expect(totals.get(buffer.id)).toBe(0);
  });

  it("is zero for a goal that starts after the as-of day", () => {
    const later = goal({ starts_on: "2026-06-01" });
    const totals = buildGoalRunningTotals(
      [later],
      ledger([tx({ on: "2026-05-10", amount: 100 })]),
      [template({ id: "tpl-1", amount: 50 })],
      "2026-05-31",
    );
    expect(totals.get(later.id)).toBe(0);
  });

  it("rounds to the cent", () => {
    const holidays = goal();
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger([
        tx({ on: "2026-01-10", amount: 0.1 }),
        tx({ on: "2026-01-11", amount: 0.2 }),
      ]),
      [],
      "2026-01-31",
    );
    expect(totals.get(holidays.id)).toBe(0.3);
  });

  it("agrees with the monthly summary for a goal that spans the whole month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
    const rows = [
      tx({ on: "2026-03-02", amount: 120, categoryId: "cat-holidays" }),
      tx({ on: "2026-03-08", amount: 30, categoryId: "cat-other" }),
      tx({
        on: "2026-03-09",
        amount: 25,
        categoryId: "cat-out",
        counts: false,
      }),
      tx({
        on: "2026-03-05",
        amount: 50,
        categoryId: "cat-holidays",
        templateId: "tpl-1",
      }),
    ];
    const templates = [
      template({ id: "tpl-1", amount: 50, dayOfMonth: 5 }),
      template({
        id: "tpl-2",
        amount: 70,
        categoryId: "cat-other",
        dayOfMonth: 15,
      }),
      template({
        id: "tpl-3",
        amount: 90,
        categoryId: "cat-other",
        dayOfMonth: 25,
      }),
    ];
    const linked = goal({
      starts_on: "2026-03-01",
      category_id: "cat-holidays",
    });
    const everything = goal({ starts_on: "2026-03-01", category_id: null });

    const totals = buildGoalRunningTotals(
      [linked, everything],
      ledger(rows),
      templates,
      "2026-03-20",
    );

    const breakdown = buildBudgetSavingsBreakdownWithProjection(
      rows,
      templates,
      2026,
      3,
      "current",
    );
    const month = computeMonthlyBudgetWithProjection(
      rows,
      templates,
      2026,
      3,
      "current",
    );
    expect(totals.get(linked.id)).toBe(
      breakdown.find((row) => row.categoryId === "cat-holidays")?.total,
    );
    expect(totals.get(everything.id)).toBe(month.savings);
  });
});

describe("goalTotalsAsOf", () => {
  it("is today for the month in progress", () => {
    expect(goalTotalsAsOf(2026, 9, "2026-09-25")).toBe("2026-09-25");
  });

  it("is the last day of a past month", () => {
    expect(goalTotalsAsOf(2026, 2, "2026-09-25")).toBe("2026-02-28");
  });
});

describe("earliestGoalStart", () => {
  it("is null with no goals", () => {
    expect(earliestGoalStart([])).toBeNull();
  });

  it("is the earliest start", () => {
    expect(
      earliestGoalStart([
        { starts_on: "2026-04-01" },
        { starts_on: "2025-11-15" },
        { starts_on: "2026-01-01" },
      ]),
    ).toBe("2025-11-15");
  });
});

describe("buildSavingsGoalProgress", () => {
  it("reads each goal's running total", () => {
    const holidays = goal({ target_amount: 1000 });
    const [row] = buildSavingsGoalProgress(
      [holidays],
      new Map([[holidays.id, 250]]),
    );
    expect(row).toMatchObject({
      saved: 250,
      remaining: 750,
      ratio: 0.25,
      complete: false,
    });
  });

  it("never draws a negative bar when withdrawals outweigh deposits", () => {
    const buffer = goal({ category_id: null, target_amount: 500 });
    const [row] = buildSavingsGoalProgress(
      [buffer],
      new Map([[buffer.id, -80]]),
    );
    expect(row.saved).toBe(-80);
    expect(row.ratio).toBe(0);
    expect(row.remaining).toBe(580);
    expect(row.complete).toBe(false);
  });

  it("treats a goal with no total as nothing saved yet", () => {
    const holidays = goal();
    const [row] = buildSavingsGoalProgress([holidays], new Map());
    expect(row.saved).toBe(0);
  });

  it("is complete at the target", () => {
    const holidays = goal({ target_amount: 300 });
    const [row] = buildSavingsGoalProgress(
      [holidays],
      new Map([[holidays.id, 300]]),
    );
    expect(row.complete).toBe(true);
    expect(row.ratio).toBe(1);
  });
});

describe("EMPTY_GOAL_LEDGER", () => {
  it("gives every goal zero", () => {
    const holidays = goal();
    expect(
      buildGoalRunningTotals(
        [holidays],
        EMPTY_GOAL_LEDGER,
        [],
        "2026-09-25",
      ).get(holidays.id),
    ).toBe(0);
  });
});
