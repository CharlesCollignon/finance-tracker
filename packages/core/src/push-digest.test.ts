import { describe, expect, it } from "vitest";

import { buildDueNotifications, isGoneStatus } from "./push-digest";
import type { BudgetProgress } from "./budget-limits";

function cap(
  budgetId: string,
  label: string,
  spent: number,
  limit: number,
): BudgetProgress {
  return {
    budgetId,
    categoryId: `cat-${budgetId}`,
    label,
    limit,
    spent,
    remaining: limit - spent,
    ratio: limit > 0 ? spent / limit : 0,
    over: spent > limit,
  };
}

const format = (amount: number) => `€${amount.toFixed(0)}`;

function build(options: Partial<Parameters<typeof buildDueNotifications>[0]>) {
  return buildDueNotifications({
    today: "2026-09-14",
    budgetProgress: [],
    alreadySent: new Set(),
    formatAmount: format,
    ...options,
  });
}

describe("buildDueNotifications", () => {
  it("says nothing on an ordinary day with nothing wrong", () => {
    expect(build({})).toEqual([]);
  });

  it("announces the new month on the first", () => {
    const due = build({ today: "2026-09-01" });
    expect(due).toHaveLength(1);
    expect(due[0]!.key).toBe("month-open:2026-09");
    expect(due[0]!.url).toBe("/dashboard");
  });

  it("counts the waiting recurring items when it knows them", () => {
    const due = build({ today: "2026-09-01", pendingRecurring: 8 });
    expect(due[0]!.body).toContain("8 recurring items are ready");
  });

  it("uses the singular for one waiting item", () => {
    const due = build({ today: "2026-09-01", pendingRecurring: 1 });
    expect(due[0]!.body).toContain("1 recurring item is ready");
  });

  it("does not announce the month twice", () => {
    const due = build({
      today: "2026-09-01",
      alreadySent: new Set(["month-open:2026-09"]),
    });
    expect(due).toEqual([]);
  });

  it("announces a cap that has been crossed", () => {
    const due = build({
      budgetProgress: [cap("b1", "Groceries", 420, 400)],
    });
    expect(due).toHaveLength(1);
    expect(due[0]!.title).toBe("Groceries is over budget");
    expect(due[0]!.body).toBe("€420 spent of €400.");
    expect(due[0]!.url).toBe("/budgets");
  });

  it("says nothing about a cap that is merely close", () => {
    expect(build({ budgetProgress: [cap("b1", "Groceries", 399, 400)] })).toEqual(
      [],
    );
  });

  it("does not repeat a breach it has already reported", () => {
    const due = build({
      budgetProgress: [cap("b1", "Groceries", 420, 400)],
      alreadySent: new Set(["breach:2026-09:b1"]),
    });
    expect(due).toEqual([]);
  });

  it("reports the same cap again in a new month", () => {
    const due = build({
      today: "2026-10-14",
      budgetProgress: [cap("b1", "Groceries", 420, 400)],
      alreadySent: new Set(["breach:2026-09:b1"]),
    });
    expect(due).toHaveLength(1);
    expect(due[0]!.key).toBe("breach:2026-10:b1");
  });

  it("puts the worst overrun first", () => {
    const due = build({
      budgetProgress: [
        cap("b1", "Slightly over", 410, 400),
        cap("b2", "Way over", 900, 300),
      ],
    });
    expect(due[0]!.title).toContain("Way over");
  });

  it("sends at most a handful in one run", () => {
    const due = build({
      today: "2026-09-01",
      budgetProgress: [
        cap("b1", "A", 500, 100),
        cap("b2", "B", 400, 100),
        cap("b3", "C", 300, 100),
        cap("b4", "D", 200, 100),
      ],
    });
    expect(due.length).toBeLessThanOrEqual(3);
  });

  it("keeps the month announcement when caps compete for the limit", () => {
    const due = build({
      today: "2026-09-01",
      budgetProgress: [
        cap("b1", "A", 500, 100),
        cap("b2", "B", 400, 100),
        cap("b3", "C", 300, 100),
      ],
    });
    expect(due[0]!.key).toBe("month-open:2026-09");
  });
});

describe("isGoneStatus", () => {
  it("treats the two defined gone codes as permanent", () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
  });

  it("keeps the subscription for anything transient", () => {
    expect(isGoneStatus(500)).toBe(false);
    expect(isGoneStatus(429)).toBe(false);
    expect(isGoneStatus(201)).toBe(false);
  });
});
