import { describe, expect, it } from "vitest";
import type { PlannedOccurrence } from "./apply-recurring";
import {
  buildCalendarWeeks,
  buildPulseDays,
  calendarMonthTotals,
  computeDayTotals,
  plannedTotals,
} from "./calendar";
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

describe("purchases made at the broker", () => {
  // A DCA PEA bought with money the transfer already took out of the
  // account, and Bitstack's buy, which the bank debits from it.
  const dca = {
    amount: 400,
    category_id: "cat-dca",
    categories: { type: "investment", counts_toward_summary: false },
  } as unknown as TransactionWithCategory;
  const bitstack = {
    amount: 18,
    category_id: "cat-bitstack",
    categories: { type: "investment", counts_toward_summary: false },
  } as unknown as TransactionWithCategory;
  const transfer = {
    amount: 1750,
    category_id: "cat-transfer",
    categories: { type: "investment", counts_toward_summary: true },
  } as unknown as TransactionWithCategory;
  const debited = new Set(["cat-bitstack"]);

  it("are not money out on their day, unless the bank debits them", () => {
    expect(computeDayTotals([dca, bitstack, transfer], debited)).toMatchObject({
      income: 0,
      outflow: 1768,
      count: 3,
    });
  });

  it("are not planned money out either", () => {
    const plannedDca: PlannedOccurrence = {
      ...planned(400, "investment"),
      categoryId: "cat-dca",
      countsTowardSummary: false,
    };
    const plannedBitstack: PlannedOccurrence = {
      ...planned(18, "investment"),
      categoryId: "cat-bitstack",
      countsTowardSummary: false,
    };
    expect(
      plannedTotals(
        [plannedDca, plannedBitstack, planned(950, "expense")],
        debited,
      ),
    ).toEqual({ income: 0, outflow: 968 });
  });

  it("come out of the month's « in and out »", () => {
    expect(
      calendarMonthTotals(
        { income: 3200, outflow: 950 + 1750 + 400 + 18 },
        [dca, bitstack, transfer],
        debited,
      ),
    ).toEqual({ income: 3200, outflow: 2718, net: 482 });
  });
});
