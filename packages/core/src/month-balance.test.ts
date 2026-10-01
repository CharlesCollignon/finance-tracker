import { describe, expect, it } from "vitest";

import {
  buildMonthBalance,
  leftAtMonthEnd,
  spendingByMonth,
  topSpending,
  transactionDelta,
  upcomingDelta,
  recordedDeltas,
} from "./month-balance";
import type { TransactionWithCategory } from "./types/database";

function tx(
  overrides: Partial<TransactionWithCategory> & {
    type?: TransactionWithCategory["categories"]["type"];
    counts?: boolean;
    name?: string;
  } = {},
): TransactionWithCategory {
  const {
    type = "expense",
    counts = true,
    name = "Groceries",
    ...rest
  } = overrides;
  return {
    id: "tx-1",
    user_id: "user-1",
    category_id: `cat-${name}`,
    recurring_template_id: null,
    occurred_on: "2026-01-10",
    amount: 10,
    note: null,
    created_at: "2026-01-10T00:00:00.000Z",
    categories: {
      name,
      type,
      icon: null,
      counts_toward_summary: counts,
    },
    ...rest,
  } as TransactionWithCategory;
}

const TODAY = "2026-01-20";

describe("transactionDelta", () => {
  it("follows the month close's rule for what left the account", () => {
    expect(transactionDelta(tx({ type: "income", amount: 100 }))).toBe(100);
    expect(transactionDelta(tx({ type: "expense", amount: 40 }))).toBe(-40);
    expect(transactionDelta(tx({ type: "savings", amount: 50 }))).toBe(-50);
    // A withdrawal from savings comes back to the account.
    expect(
      transactionDelta(tx({ type: "savings", counts: false, amount: 50 })),
    ).toBe(50);
    // A buy inside a wallet moved money that had already left.
    expect(
      transactionDelta(tx({ type: "investment", counts: false, amount: 90 })),
    ).toBe(0);
    expect(transactionDelta(tx({ type: "investment", amount: 90 }))).toBe(-90);
  });
});

describe("upcomingDelta", () => {
  it("counts what arrives in and everything else out", () => {
    const charge = {
      key: "k",
      name: "Rent",
      description: null,
      occurredOn: "2026-01-25",
      amount: 800,
      recorded: false,
    };
    expect(upcomingDelta({ ...charge, type: "expense" })).toBe(-800);
    expect(upcomingDelta({ ...charge, type: "income" })).toBe(800);
  });

  it("moves nothing for a purchase inside a wallet", () => {
    // The October DCA, paid for by a transfer to the broker on 22 September.
    expect(
      upcomingDelta({
        key: "dca",
        name: "DCA PEA",
        description: null,
        occurredOn: "2026-10-05",
        amount: 300,
        type: "investment",
        recorded: false,
        tracked: true,
      }),
    ).toBe(0);
  });
});

describe("leftAtMonthEnd", () => {
  it("counts the month's rows by the account's rule, and what is still to come", () => {
    expect(
      leftAtMonthEnd(
        [
          tx({ id: "pay", type: "income", amount: 3_000, name: "Salaire" }),
          tx({ id: "rent", amount: 900, name: "Loyer" }),
          tx({
            id: "transfer",
            type: "investment",
            amount: 400,
            name: "Virement vers le courtier",
          }),
          // Bought with the transfer above: no money moves twice.
          tx({ id: "dca", type: "investment", counts: false, amount: 400 }),
          tx({ id: "out", type: "savings", counts: false, amount: 100 }),
        ],
        { arriving: 0, budgetedOutflow: 250 },
      ),
    ).toBe(1_550);
  });
});

describe("buildMonthBalance", () => {
  it("carries a balance read today back and forward through the month", () => {
    const balance = buildMonthBalance({
      year: 2026,
      month: 1,
      today: TODAY,
      anchor: { onDate: TODAY, balance: 1000 },
      recorded: [
        { date: "2026-01-05", delta: -200 },
        { date: "2026-01-15", delta: 500 },
      ],
      planned: [
        { date: "2026-01-25", delta: -800 },
        { date: "2026-01-28", delta: 2000 },
      ],
    });

    expect(balance.period).toBe("current");
    expect(balance.basis).toBe("balance");
    expect(balance.today).toBe(1000);
    // Before the 5th and the 15th had happened.
    expect(balance.start).toBe(700);
    expect(balance.end).toBe(2200);
    expect(balance.points).toHaveLength(31);
    expect(balance.points[4]).toEqual({
      date: "2026-01-05",
      value: 500,
      planned: false,
    });
    expect(balance.points[24]).toEqual({
      date: "2026-01-25",
      value: 200,
      planned: true,
    });
  });

  it("finds the tightest day still to come", () => {
    const balance = buildMonthBalance({
      year: 2026,
      month: 1,
      today: TODAY,
      anchor: { onDate: TODAY, balance: 1000 },
      recorded: [{ date: "2026-01-02", delta: -5000 }],
      planned: [
        { date: "2026-01-25", delta: -800 },
        { date: "2026-01-28", delta: 2000 },
      ],
    });
    // The 2nd is lower still, but it is behind today.
    expect(balance.lowest).toEqual({ date: "2026-01-25", value: 200 });
  });

  it("counts forward from a close at the end of last month", () => {
    const balance = buildMonthBalance({
      year: 2026,
      month: 1,
      today: TODAY,
      anchor: { onDate: "2025-12-31", balance: 300 },
      recorded: [{ date: "2026-01-10", delta: -100 }],
      planned: [{ date: "2026-01-28", delta: 1000 }],
    });
    expect(balance.start).toBe(300);
    expect(balance.today).toBe(200);
    expect(balance.end).toBe(1200);
  });

  it("counts the month's net from zero when no balance was ever read", () => {
    const balance = buildMonthBalance({
      year: 2026,
      month: 1,
      today: TODAY,
      anchor: null,
      recorded: [{ date: "2026-01-10", delta: -100 }],
      planned: [{ date: "2026-01-28", delta: 1000 }],
    });
    expect(balance.basis).toBe("net");
    expect(balance.start).toBe(0);
    expect(balance.today).toBe(-100);
    expect(balance.end).toBe(900);
  });

  it("describes a past month with no planned part", () => {
    const balance = buildMonthBalance({
      year: 2025,
      month: 12,
      today: TODAY,
      anchor: { onDate: "2025-12-31", balance: 500 },
      recorded: [{ date: "2025-12-10", delta: -50 }],
      planned: [],
    });
    expect(balance.period).toBe("past");
    expect(balance.today).toBeNull();
    expect(balance.start).toBe(550);
    expect(balance.end).toBe(500);
    expect(balance.points.every((point) => !point.planned)).toBe(true);
  });

  it("plans a future month from today's balance", () => {
    const balance = buildMonthBalance({
      year: 2026,
      month: 2,
      today: TODAY,
      anchor: { onDate: TODAY, balance: 1000 },
      recorded: [],
      planned: [
        { date: "2026-01-25", delta: -800 },
        { date: "2026-02-05", delta: -800 },
        { date: "2026-02-27", delta: 2000 },
      ],
    });
    expect(balance.period).toBe("future");
    expect(balance.start).toBe(200);
    expect(balance.end).toBe(1400);
    expect(balance.lowest).toEqual({ date: "2026-02-05", value: -600 });
    expect(balance.points.every((point) => point.planned)).toBe(true);
  });
});

describe("spendingByMonth", () => {
  it("sums expenses into the months asked about", () => {
    const totals = spendingByMonth(
      [
        tx({ amount: 10, occurred_on: "2026-01-02" }),
        tx({ amount: 5, occurred_on: "2026-01-20" }),
        tx({ amount: 99, occurred_on: "2026-01-21", type: "income" }),
        tx({ amount: 7, occurred_on: "2025-12-31" }),
        tx({ amount: 3, occurred_on: "2025-11-30" }),
      ],
      ["2025-12", "2026-01"],
    );
    expect([...totals]).toEqual([
      ["2025-12", 7],
      ["2026-01", 15],
    ]);
  });
});

describe("topSpending", () => {
  it("keeps the largest categories and folds the rest", () => {
    const rows = [
      tx({ name: "Rent", amount: 800 }),
      tx({ name: "Food", amount: 300 }),
      tx({ name: "Food", amount: 50 }),
      tx({ name: "Fun", amount: 40 }),
      tx({ name: "Pay", amount: 3000, type: "income" }),
    ];
    const { top, rest, total } = topSpending(rows, 2);
    expect(top.map((entry) => [entry.name, entry.total])).toEqual([
      ["Rent", 800],
      ["Food", 350],
    ]);
    expect(rest).toBe(40);
    expect(total).toBe(1190);
  });
});

describe("recordedDeltas", () => {
  // An October salary paid on 22 September, and a September grocery bill.
  const salary = tx({
    id: "tx-salary",
    type: "income",
    name: "Salaire",
    amount: 2400,
    occurred_on: "2026-10-01",
    cash_on: "2026-09-22",
  });
  const groceries = tx({
    id: "tx-food",
    occurred_on: "2026-09-12",
    amount: 80,
  });

  it("puts a moved row on the day its money moved, against a balance", () => {
    expect(
      recordedDeltas([groceries], {
        from: "2026-09-01",
        today: "2026-09-30",
        anchored: true,
        moved: [salary],
      }),
    ).toEqual([
      { date: "2026-09-12", delta: -80 },
      { date: "2026-09-22", delta: 2400 },
    ]);
  });

  it("counts it once when both reads bring it", () => {
    expect(
      recordedDeltas([salary], {
        from: "2026-09-01",
        today: "2026-10-05",
        anchored: true,
        moved: [salary],
      }),
    ).toEqual([{ date: "2026-09-22", delta: 2400 }]);
  });

  it("goes by the day a row counts for when there is no balance", () => {
    expect(
      recordedDeltas([salary], {
        from: "2026-10-01",
        today: "2026-10-05",
        anchored: false,
        moved: [salary],
      }),
    ).toEqual([{ date: "2026-10-01", delta: 2400 }]);
  });
});
