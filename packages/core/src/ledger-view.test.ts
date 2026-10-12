import { describe, expect, it } from "vitest";

import type { PlannedOccurrence } from "./apply-recurring";
import {
  filterLedger,
  filterPlanned,
  ledgerDays,
  ledgerTotals,
  ledgerWeeks,
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

describe("a week's range", () => {
  const week = { from: "2026-10-02", to: "2026-10-04" };

  it("keeps the rows dated within it, both days included", () => {
    expect(
      filterLedger(rows, { ...all, range: week }).map((r) => r.id),
    ).toEqual(["a", "b"]);
    expect(
      filterLedger(rows, {
        ...all,
        range: { from: "2026-10-01", to: "2026-10-01" },
      }).map((r) => r.id),
    ).toEqual(["c"]);
  });

  it("narrows what is still to come the same way", () => {
    const coming = [
      planned("2026-10-04", "Loyer"),
      planned("2026-10-20", "Loyer"),
    ];
    expect(
      filterPlanned(coming, { ...all, range: week }).map((p) => p.occurredOn),
    ).toEqual(["2026-10-04"]);
  });

  it("keeps everything when there is none", () => {
    expect(filterLedger(rows, { ...all, range: null })).toHaveLength(3);
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

describe("ledgerWeeks", () => {
  it("cuts October 2026, which starts on a Thursday, into five weeks", () => {
    const weeks = ledgerWeeks(2026, 10, [], []);
    expect(weeks.map((week) => [week.from, week.to])).toEqual([
      ["2026-10-01", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
      ["2026-10-19", "2026-10-25"],
      ["2026-10-26", "2026-10-31"],
    ]);
    // Seven places a week, the days outside the month left empty.
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(weeks[0]!.days.slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0]!.days[3]?.date).toBe("2026-10-01");
    expect(weeks[4]!.days[6]).toBeNull();
  });

  it("gives a month that starts on a Sunday a week of one day", () => {
    const weeks = ledgerWeeks(2026, 3, [], []);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toMatchObject({ from: "2026-03-01", to: "2026-03-01" });
    expect(weeks[5]).toMatchObject({ from: "2026-03-30", to: "2026-03-31" });
  });

  it("gives February 2027, Monday to Sunday four times, four whole weeks", () => {
    const weeks = ledgerWeeks(2027, 2, [], []);
    expect(weeks).toHaveLength(4);
    expect(weeks.flatMap((week) => week.days).includes(null)).toBe(false);
  });

  it("counts the rows on each day, and the week's", () => {
    const weeks = ledgerWeeks(2026, 10, rows, [planned("2026-10-04", "Loyer")]);
    expect(weeks[0]!.days[3]).toEqual({
      date: "2026-10-01",
      recorded: 1,
      planned: 0,
    });
    expect(weeks[0]!.days[5]).toEqual({
      date: "2026-10-03",
      recorded: 2,
      planned: 0,
    });
    expect(weeks[0]).toMatchObject({ recorded: 3, planned: 1 });
    expect(weeks[1]).toMatchObject({ recorded: 0, planned: 0 });
  });
});
