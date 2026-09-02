import { describe, expect, it } from "vitest";

import {
  buildMonthClose,
  buildRecordedCashFlows,
  closableMonth,
  MIN_CLOSES_FOR_CAP,
  monthColumnValue,
  monthWasWon,
  nextMonthKey,
  observationDateFor,
  previousMonthKey,
  recordedOutflow,
  runwayDaysAdded,
  suggestUnrecordedCap,
  summarizeCloseHistory,
  type ClosedMonthOutcome,
  type RecordedCashFlows,
} from "./month-close";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function tx(
  amount: number,
  type: CategoryType,
  options: {
    countsTowardSummary?: boolean;
    recurringTemplateId?: string | null;
  } = {},
): TransactionWithCategory {
  return {
    id: `tx-${Math.random()}`,
    user_id: "user-1",
    category_id: `cat-${type}`,
    recurring_template_id: options.recurringTemplateId ?? null,
    occurred_on: "2026-10-12",
    amount,
    note: null,
    created_at: "2026-10-12T00:00:00.000Z",
    categories: {
      name: type,
      type,
      icon: null,
      counts_toward_summary: options.countsTowardSummary ?? true,
    },
  };
}

function flows(overrides: Partial<RecordedCashFlows> = {}): RecordedCashFlows {
  return {
    income: 3000,
    expenses: 1200,
    savings: 300,
    transfers: 400,
    ...overrides,
  };
}

describe("buildRecordedCashFlows", () => {
  it("sorts recorded movements by what the bank saw", () => {
    const result = buildRecordedCashFlows([
      tx(3000, "income"),
      tx(900, "expense"),
      tx(300, "expense"),
      tx(300, "savings"),
      tx(400, "investment"),
    ]);

    expect(result).toEqual({
      income: 3000,
      expenses: 1200,
      savings: 300,
      transfers: 400,
    });
  });

  it("counts a yearly expense in full, in the month it was paid", () => {
    // The budget view amortises this to 100 a month; the account did not.
    const result = buildRecordedCashFlows([
      tx(1200, "expense", { recurringTemplateId: "yearly-tpl" }),
    ]);

    expect(result.expenses).toBe(1200);
  });

  it("ignores a deployment, whose cash left when it was transferred in", () => {
    const result = buildRecordedCashFlows([
      tx(400, "investment", { countsTowardSummary: false }),
    ]);

    expect(result.transfers).toBe(0);
    expect(recordedOutflow(result)).toBe(0);
  });

  it("adds wallet transfers to what left for a broker", () => {
    const result = buildRecordedCashFlows(
      [tx(400, "investment")],
      [{ amount: 250 }, { amount: 100 }],
    );

    expect(result.transfers).toBe(750);
  });

  it("totals everything that left the account", () => {
    expect(recordedOutflow(flows())).toBe(1900);
  });
});

describe("buildMonthClose", () => {
  it("only drops an anchor when there is nothing to measure from", () => {
    const result = buildMonthClose({
      openingBalance: null,
      closingBalance: 2000,
      flows: flows(),
    });

    expect(result.status).toBe("baseline");
    expect(result.kept).toBeNull();
    expect(result.unrecorded).toBeNull();
    expect(result.keptRate).toBeNull();
  });

  it("finds the spending no transaction accounts for", () => {
    const result = buildMonthClose({
      openingBalance: 2000,
      closingBalance: 2900,
      flows: flows(),
    });

    expect(result.status).toBe("reconciled");
    expect(result.unrecorded).toBe(200);
    expect(result.kept).toBe(1600);
    expect(result.keptRate).toBe(53.3);
  });

  it("keeps kept, income, expenses and unrecorded consistent", () => {
    const input = {
      openingBalance: 2000,
      closingBalance: 2900,
      flows: flows(),
    };
    const result = buildMonthClose(input);

    expect(result.kept).toBeCloseTo(
      input.flows.income - input.flows.expenses - result.unrecorded!,
      2,
    );
  });

  it("reports nothing unrecorded when the balance explains itself", () => {
    const result = buildMonthClose({
      openingBalance: 2000,
      closingBalance: 3100,
      flows: flows(),
    });

    expect(result.status).toBe("reconciled");
    expect(result.unrecorded).toBe(0);
    expect(result.kept).toBe(1800);
  });

  it("treats a sub-cent gap as rounding rather than a finding", () => {
    const result = buildMonthClose({
      openingBalance: 2000,
      closingBalance: 3100.005,
      flows: flows(),
    });

    expect(result.status).toBe("reconciled");
    expect(result.unrecorded).toBe(0);
  });

  it("flags a balance the recorded movements cannot explain", () => {
    const result = buildMonthClose({
      openingBalance: 2000,
      closingBalance: 3200,
      flows: flows(),
    });

    expect(result.status).toBe("over-recorded");
    expect(result.unexplainedCredit).toBe(100);
    expect(result.unrecorded).toBeNull();
  });

  it("has no rate to give without income", () => {
    const result = buildMonthClose({
      openingBalance: 2000,
      closingBalance: 1500,
      flows: flows({ income: 0 }),
    });

    expect(result.keptRate).toBeNull();
    expect(result.kept).toBe(200);
  });

  it("handles a month that went backwards", () => {
    const result = buildMonthClose({
      openingBalance: 2000,
      closingBalance: 1000,
      flows: flows({ income: 0, savings: 0, transfers: 0, expenses: 400 }),
    });

    expect(result.kept).toBe(-1000);
    expect(result.unrecorded).toBe(600);
  });
});

describe("monthWasWon", () => {
  const won: ClosedMonthOutcome = {
    monthKey: "2026-10",
    unrecorded: 180,
    kept: 400,
  };

  it("asks only that the month ended ahead before a cap exists", () => {
    expect(monthWasWon(won, null)).toBe(true);
    expect(monthWasWon({ ...won, kept: -50 }, null)).toBe(false);
  });

  it("asks that unrecorded spending stayed inside the cap once set", () => {
    expect(monthWasWon(won, 200)).toBe(true);
    expect(monthWasWon(won, 180)).toBe(true);
    expect(monthWasWon(won, 150)).toBe(false);
  });

  it("cannot be won by a month that never reconciled", () => {
    expect(monthWasWon({ ...won, unrecorded: null }, 200)).toBe(false);
  });
});

describe("summarizeCloseHistory", () => {
  function outcome(monthKey: string, unrecorded: number): ClosedMonthOutcome {
    return { monthKey, unrecorded, kept: 500 };
  }

  it("takes the middle month as typical, not the average", () => {
    const summary = summarizeCloseHistory(
      [
        outcome("2026-08", 150),
        outcome("2026-09", 180),
        // A holiday month, which should not become the new normal.
        outcome("2026-10", 900),
      ],
      null,
    );

    expect(summary.baseline).toBe(180);
    expect(summary.sample).toBe(3);
  });

  it("counts a streak back from the latest close", () => {
    const summary = summarizeCloseHistory(
      [
        outcome("2026-08", 150),
        outcome("2026-09", 160),
        outcome("2026-10", 170),
      ],
      200,
    );

    expect(summary.streak).toBe(3);
    expect(summary.bestStreak).toBe(3);
  });

  it("breaks a streak on a month over the cap", () => {
    const summary = summarizeCloseHistory(
      [
        outcome("2026-08", 150),
        outcome("2026-09", 900),
        outcome("2026-10", 170),
      ],
      200,
    );

    expect(summary.streak).toBe(1);
    expect(summary.bestStreak).toBe(1);
  });

  it("does not bridge a month that was never closed", () => {
    const summary = summarizeCloseHistory(
      [
        outcome("2026-07", 150),
        // August never closed.
        outcome("2026-09", 160),
        outcome("2026-10", 170),
      ],
      200,
    );

    expect(summary.streak).toBe(2);
  });

  it("remembers the best run after the current one breaks", () => {
    const summary = summarizeCloseHistory(
      [
        outcome("2026-05", 150),
        outcome("2026-06", 160),
        outcome("2026-07", 150),
        outcome("2026-08", 900),
        outcome("2026-09", 170),
      ],
      200,
    );

    expect(summary.streak).toBe(1);
    expect(summary.bestStreak).toBe(3);
  });

  it("has nothing to say about an empty history", () => {
    const summary = summarizeCloseHistory([], 200);

    expect(summary).toEqual({
      baseline: null,
      sample: 0,
      streak: 0,
      bestStreak: 0,
    });
  });
});

describe("suggestUnrecordedCap", () => {
  it("waits for enough months to stop guessing", () => {
    const summary = summarizeCloseHistory(
      [{ monthKey: "2026-10", unrecorded: 187, kept: 400 }],
      null,
    );

    expect(summary.sample).toBeLessThan(MIN_CLOSES_FOR_CAP);
    expect(suggestUnrecordedCap(summary)).toBeNull();
  });

  it("rounds the baseline down, so hitting it takes something", () => {
    const summary = summarizeCloseHistory(
      [
        { monthKey: "2026-09", unrecorded: 180, kept: 400 },
        { monthKey: "2026-10", unrecorded: 194, kept: 400 },
      ],
      null,
    );

    expect(summary.baseline).toBe(187);
    expect(suggestUnrecordedCap(summary)).toBe(180);
  });
});

describe("runwayDaysAdded", () => {
  it("turns a month's saving into time bought", () => {
    expect(runwayDaysAdded(1400, 1400)).toBe(30);
    expect(runwayDaysAdded(700, 1400)).toBe(15);
  });

  it("has nothing to celebrate when the month lost ground", () => {
    expect(runwayDaysAdded(-100, 1400)).toBeNull();
    expect(runwayDaysAdded(0, 1400)).toBeNull();
    expect(runwayDaysAdded(null, 1400)).toBeNull();
  });

  it("cannot buy time against no committed costs", () => {
    expect(runwayDaysAdded(500, 0)).toBeNull();
  });
});

describe("month keys and dates", () => {
  it("steps between months across a year boundary", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });

  it("reads a month's balance on the agreed day of the month after", () => {
    expect(observationDateFor(2026, 10, 5)).toBe("2026-11-05");
    expect(observationDateFor(2026, 12, 5)).toBe("2027-01-05");
    expect(observationDateFor(2026, 10, 12)).toBe("2026-11-12");
  });

  it("stores a close against the first of its month", () => {
    expect(monthColumnValue(2026, 9)).toBe("2026-09-01");
  });
});

describe("closableMonth", () => {
  it("anchors on the newest month whose reading date has passed", () => {
    // On 2 September, August cannot be read yet (that waits for the 5th),
    // so the anchor is July, which the user can look up today.
    const first = closableMonth("2026-09-02", 5, null);

    expect(first).toMatchObject({
      monthKey: "2026-07",
      observeOn: "2026-08-05",
      isBaseline: true,
    });
  });

  it("anchors on last month once its reading date arrives", () => {
    expect(closableMonth("2026-09-05", 5, null)).toMatchObject({
      monthKey: "2026-08",
      observeOn: "2026-09-05",
      isBaseline: true,
    });
  });

  it("offers the month straight after the last close", () => {
    expect(closableMonth("2026-11-06", 5, "2026-09")).toMatchObject({
      monthKey: "2026-10",
      observeOn: "2026-11-05",
      isBaseline: false,
    });
  });

  it("asks for nothing until the next reading date arrives", () => {
    // October is closed by reading the balance on 5 November, so on the 4th
    // there is still nothing to ask for.
    expect(closableMonth("2026-11-04", 5, "2026-09")).toBeNull();
    expect(closableMonth("2026-11-05", 5, "2026-09")).toMatchObject({
      monthKey: "2026-10",
    });
  });

  it("walks a user who has fallen behind forwards, in order", () => {
    // Three months missed: July is offered first, not October, because each
    // close measures from the one before it.
    expect(closableMonth("2026-11-20", 5, "2026-06")).toMatchObject({
      monthKey: "2026-07",
      observeOn: "2026-08-05",
    });
  });

  it("has nothing to ask when the latest month is already closed", () => {
    expect(closableMonth("2026-11-20", 5, "2026-10")).toBeNull();
  });
});
