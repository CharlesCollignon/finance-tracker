import { describe, expect, it } from "vitest";

import type { PlannedOccurrence } from "./apply-recurring";
import {
  buildLedgerView,
  filterLedger,
  filterPlanned,
  hasLedgerFilters,
  hiddenFilterCount,
  ledgerCategoryOptions,
  ledgerDays,
  ledgerRows,
  ledgerTotals,
  ledgerPlannedTotals,
  ledgerShowing,
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

  it("keeps what one bank account brought in", () => {
    const accountOf = new Map([
      ["a", "bourso"],
      ["b", "ca"],
    ]);
    expect(
      filterLedger(rows, { ...all, accountId: "bourso" }, accountOf).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    // A row typed by hand came from no account.
    expect(
      filterLedger(rows, { ...all, accountId: "all" }, accountOf),
    ).toHaveLength(3);
  });
});

describe("filterPlanned", () => {
  it("applies the same filter to what is still to come", () => {
    const list = [planned("2026-10-20", "Appartement")];
    expect(filterPlanned(list, { ...all, type: "income" })).toEqual([]);
    expect(filterPlanned(list, { ...all, query: "appart" })).toHaveLength(1);
    expect(filterPlanned(list, { ...all, query: "loyer" })).toHaveLength(1);
  });

  it("keeps nothing still to come under one account", () => {
    const list = [planned("2026-10-20", "Appartement")];
    expect(filterPlanned(list, { ...all, accountId: "bourso" })).toEqual([]);
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

describe("ledgerDays, oldest first", () => {
  it("starts from the month's first day", () => {
    const days = ledgerDays(
      rows,
      [planned("2026-10-20", "Appartement")],
      "oldest",
    );
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-01",
      "2026-10-03",
      "2026-10-20",
    ]);
  });
});

describe("ledgerPlannedTotals", () => {
  it("sums what is still to come by kind of money", () => {
    const totals = ledgerPlannedTotals([
      planned("2026-10-04", "Loyer"),
      {
        ...planned("2026-10-28", "Salaire"),
        categoryType: "income",
        amount: 2000,
      },
    ]);
    expect(totals.income).toBe(2000);
    expect(totals.expense).toBe(planned("2026-10-04", "Loyer").amount);
  });
});

describe("ledgerShowing", () => {
  it("shows what was asked for when there is something in it", () => {
    expect(ledgerShowing("past", { past: 3, upcoming: 2 })).toBe("past");
    expect(ledgerShowing("upcoming", { past: 3, upcoming: 2 })).toBe(
      "upcoming",
    );
  });

  it("falls back to the half that has rows", () => {
    expect(ledgerShowing("upcoming", { past: 3, upcoming: 0 })).toBe("past");
    expect(ledgerShowing("past", { past: 0, upcoming: 2 })).toBe("upcoming");
    expect(ledgerShowing("past", { past: 0, upcoming: 0 })).toBe("past");
  });
});

describe("ledgerRows", () => {
  it("orders newest first, and oldest first as that list turned over", () => {
    expect(ledgerRows(rows, "newest").map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(ledgerRows(rows, "oldest").map((r) => r.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

describe("ledgerCategoryOptions", () => {
  it("names the categories the rows and the planned rows use, by name", () => {
    expect(
      ledgerCategoryOptions(rows, [planned("2026-10-20", "Loyer")]),
    ).toEqual([
      { id: "Courses-id", name: "Courses" },
      { id: "Loyer-id", name: "Loyer" },
      { id: "Salaire-id", name: "Salaire" },
    ]);
  });
});

describe("the filter helpers", () => {
  it("count the filters behind the button, and say whether any is on", () => {
    expect(hiddenFilterCount(all)).toBe(0);
    expect(hiddenFilterCount({ ...all, categoryId: "x", accountId: "y" })).toBe(
      2,
    );
    expect(hasLedgerFilters(all)).toBe(false);
    expect(hasLedgerFilters({ ...all, query: " a" })).toBe(true);
    expect(hasLedgerFilters({ ...all, type: "income" })).toBe(true);
    expect(hasLedgerFilters({ ...all, accountId: "y" })).toBe(true);
  });
});

describe("buildLedgerView", () => {
  it("works the whole list out once: the half shown, the rows, their days and figures", () => {
    const view = buildLedgerView({
      transactions: rows,
      planned: [planned("2026-10-20", "Loyer")],
      filter: all,
      time: "past",
      order: "oldest",
    });
    expect(view.showing).toBe("past");
    expect(view.rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(view.days.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-03"]);
    expect(view.days[1]!.rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(view.totals).toEqual({
      income: 2000,
      expense: 55,
      savings: 0,
      investment: 0,
    });
    expect(view.shownCount).toBe(3);
    expect(view.totalCount).toBe(3);
    expect(view.visibleIds).toEqual(["c", "b", "a"]);
  });

  it("shows what is to come when nothing has happened, soonest first", () => {
    const ahead = buildLedgerView({
      transactions: [],
      planned: [planned("2026-10-25", "Loyer"), planned("2026-10-20", "Loyer")],
      filter: all,
      time: "past",
      order: "newest",
    });
    expect(ahead.showing).toBe("upcoming");
    expect(ahead.days.map((d) => d.date)).toEqual(["2026-10-20", "2026-10-25"]);
    expect(ahead.totals.expense).toBe(100);
    expect(ahead.shownCount).toBe(2);
    expect(ahead.visibleIds).toEqual([]);
  });

  it("keeps the figures to what the filter keeps", () => {
    const view = buildLedgerView({
      transactions: rows,
      planned: [],
      filter: { ...all, type: "expense" },
      time: "past",
      order: "newest",
    });
    expect(view.totals.income).toBe(0);
    expect(view.shownCount).toBe(2);
    expect(view.totalCount).toBe(3);
  });
});
