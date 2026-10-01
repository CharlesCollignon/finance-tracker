import { describe, expect, it } from "vitest";

import {
  budgetOrCashDateFilter,
  cashDateOf,
  isMovedRow,
  movedBetween,
} from "./cash-date";

describe("a transaction's two dates", () => {
  const early = { occurred_on: "2026-10-01", cash_on: "2026-09-22" };
  const plain = { occurred_on: "2026-09-12", cash_on: null };

  it("reads the day the money moved, falling back to the day it counts for", () => {
    expect(cashDateOf(early)).toBe("2026-09-22");
    expect(cashDateOf(plain)).toBe("2026-09-12");
    expect(cashDateOf({ occurred_on: "2026-09-12" })).toBe("2026-09-12");
  });

  it("places an early salary in the month its money arrived", () => {
    expect(movedBetween(early, "2026-09-01", "2026-09-30")).toBe(true);
    expect(movedBetween(early, "2026-10-01", "2026-10-31")).toBe(false);
  });

  it("knows which rows were moved", () => {
    expect(isMovedRow(early)).toBe(true);
    expect(isMovedRow(plain)).toBe(false);
  });

  it("asks the database for either date in the range", () => {
    expect(budgetOrCashDateFilter("2026-09-01", "2026-09-30")).toBe(
      "and(occurred_on.gte.2026-09-01,occurred_on.lte.2026-09-30)," +
        "and(cash_on.gte.2026-09-01,cash_on.lte.2026-09-30)",
    );
  });
});
