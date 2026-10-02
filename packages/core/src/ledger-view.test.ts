import { describe, expect, it } from "vitest";

import type { PlannedOccurrence } from "./apply-recurring";
import {
  filterLedger,
  filterPlanned,
  ledgerDays,
  ledgerTotals,
} from "./ledger-view";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function tx(
  id: string,
  occurredOn: string,
  amount: number,
  type: CategoryType,
  name: string,
  note: string | null = null,
): TransactionWithCategory {
  return {
    id,
    user_id: "u",
    category_id: `${name}-id`,
    recurring_template_id: null,
    amount,
    occurred_on: occurredOn,
    note,
    created_at: "",
    cash_on: null,
    deleted_at: null,
    categories: { name, type, icon: null, counts_toward_summary: true },
  } as TransactionWithCategory;
}

function planned(occurredOn: string, name: string): PlannedOccurrence {
  return {
    templateId: "t",
    occurredOn,
    key: `t:${occurredOn}`,
    name,
    amount: 50,
    note: null,
    categoryId: "Loyer-id",
    categoryName: "Loyer",
    categoryType: "expense",
    categoryIcon: null,
  };
}

const rows = [
  tx("a", "2026-10-03", 40, "expense", "Courses", "lait"),
  tx("b", "2026-10-03", 2000, "income", "Salaire"),
  tx("c", "2026-10-01", 15, "expense", "Courses", "pain"),
];
const all = { type: "all", categoryId: "all", query: "" } as const;

describe("filterLedger", () => {
  it("keeps by type, category and what was typed", () => {
    expect(
      filterLedger(rows, { ...all, type: "income" }).map((r) => r.id),
    ).toEqual(["b"]);
    expect(
      filterLedger(rows, { ...all, categoryId: "Courses-id" }).map((r) => r.id),
    ).toEqual(["a", "c"]);
    expect(
      filterLedger(rows, { ...all, query: " PAIN " }).map((r) => r.id),
    ).toEqual(["c"]);
  });

  it("looks in each field on its own, never across the seam", () => {
    // "courses lait" spans the name and the note; neither holds it.
    expect(filterLedger(rows, { ...all, query: "courses lait" })).toEqual([]);
  });
});

describe("filterPlanned", () => {
  it("applies the same filter to what is still to come", () => {
    const list = [planned("2026-10-20", "Appartement")];
    expect(filterPlanned(list, { ...all, type: "income" })).toEqual([]);
    expect(filterPlanned(list, { ...all, query: "appart" })).toHaveLength(1);
    expect(filterPlanned(list, { ...all, query: "loyer" })).toHaveLength(1);
  });
});

describe("ledgerTotals", () => {
  it("adds each kind of money on its own", () => {
    expect(ledgerTotals(rows)).toEqual({
      income: 2000,
      expense: 55,
      savings: 0,
      investment: 0,
    });
  });
});

describe("ledgerDays", () => {
  it("reads a day at a time, newest first, with planned rows outside the net", () => {
    const days = ledgerDays(rows, [planned("2026-10-20", "Appartement")]);
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-20",
      "2026-10-03",
      "2026-10-01",
    ]);
    expect(days[0]).toMatchObject({ rows: [], net: 0 });
    expect(days[0]!.planned).toHaveLength(1);
    expect(days[1]!.net).toBe(1960);
    expect(days[1]!.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
