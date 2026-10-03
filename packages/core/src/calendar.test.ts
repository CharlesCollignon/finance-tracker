import { describe, expect, it } from "vitest";
import type { PlannedOccurrence } from "./apply-recurring";
import { buildCalendarWeeks, buildPulseDays, plannedTotals } from "./calendar";
import type { TransactionWithCategory } from "./types/database";

function planned(
  amount: number,
  categoryType: PlannedOccurrence["categoryType"],
): PlannedOccurrence {
  return {
    templateId: "tpl",
    occurredOn: "2026-10-05",
    key: "tpl:2026-10-05",
    name: "Loyer",
    amount,
    note: null,
    categoryId: "cat",
    categoryName: "Logement",
    categoryType,
    categoryIcon: null,
  };
}

function recorded(
  amount: number,
  type: "income" | "expense",
): TransactionWithCategory {
  return {
    amount,
    categories: { type },
  } as unknown as TransactionWithCategory;
}

describe("plannedTotals", () => {
  it("adds a day's planned income and outflow apart, and is null without any", () => {
    expect(
      plannedTotals([
        planned(900, "expense"),
        planned(40, "savings"),
        planned(2_400, "income"),
      ]),
    ).toEqual({ income: 2_400, outflow: 940 });
    expect(plannedTotals([])).toBeNull();
  });
});

describe("buildPulseDays", () => {
  it("draws the month's own days, with what each recorded and what is still planned", () => {
    const weeks = buildCalendarWeeks(2026, 10);
    const days = buildPulseDays(
      weeks,
      new Map([
        ["2026-10-02", [recorded(12.5, "expense"), recorded(80, "income")]],
      ]),
      new Map([["2026-10-05", [planned(900, "expense")]]]),
    );

    expect(days).toHaveLength(31);
    expect(days[0].date).toBe("2026-10-01");
    expect(days[1]).toMatchObject({
      outflow: 12.5,
      income: 80,
      plannedOutflow: 0,
    });
    expect(days[4]).toMatchObject({
      outflow: 0,
      plannedOutflow: 900,
      plannedIncome: 0,
    });
  });
});
