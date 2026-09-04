import { describe, expect, it } from "vitest";

import {
  balanceAsOf,
  cashBalanceAsOf,
  intradayIndexes,
  type BalanceRow,
} from "./bank-balance";

/** Newest first within a day, which is the order a statement arrives in. */
function day(date: string, balances: number[]): BalanceRow[] {
  return balances.map((balanceAfter, intradayIndex) => ({
    occurredOn: date,
    balanceAfter,
    intradayIndex,
  }));
}

describe("balanceAsOf", () => {
  it("takes the last movement of the day asked for", () => {
    const rows = [
      ...day("2026-08-31", [-395.63, -365.63, -300.0]),
      ...day("2026-08-30", [-250.0]),
    ];

    const result = balanceAsOf(rows, "2026-08-31");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reading.amount).toBe(-395.63);
      expect(result.reading.daysStale).toBe(0);
    }
  });

  it("reaches back when the day itself had no movements", () => {
    const rows = day("2026-08-28", [1200]);

    const result = balanceAsOf(rows, "2026-08-31");

    expect(result.ok).toBe(true);
    if (result.ok) {
      // A balance does not change on a day nothing happened, so this is the
      // right answer — just an older one.
      expect(result.reading.amount).toBe(1200);
      expect(result.reading.fromDate).toBe("2026-08-28");
      expect(result.reading.daysStale).toBe(3);
    }
  });

  it("ignores movements after the date asked for", () => {
    const rows = [...day("2026-09-02", [2093.13]), ...day("2026-08-31", [-395.63])];

    const result = balanceAsOf(rows, "2026-08-31");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reading.amount).toBe(-395.63);
    }
  });

  it("fails rather than guesses when the statement starts later", () => {
    const rows = day("2026-09-01", [500]);

    expect(balanceAsOf(rows, "2026-08-31")).toEqual({
      ok: false,
      reason: "no-rows-before",
    });
  });

  it("fails when the bank gave no running balance on the row that matters", () => {
    const rows: BalanceRow[] = [
      { occurredOn: "2026-08-31", balanceAfter: null, intradayIndex: 0 },
      { occurredOn: "2026-08-31", balanceAfter: -300, intradayIndex: 1 },
    ];

    expect(balanceAsOf(rows, "2026-08-31")).toEqual({
      ok: false,
      reason: "no-running-balance",
    });
  });
});

describe("cashBalanceAsOf", () => {
  it("sums the accounts it was told to count", () => {
    const result = cashBalanceAsOf(
      [
        { accountId: "a", label: "Compte de Dépôt", rows: day("2026-08-31", [-395.63]) },
        { accountId: "b", label: "Livret", rows: day("2026-08-30", [5.75]) },
      ],
      "2026-08-31",
    );

    expect(result.ok).toBe(true);
    expect(result.total).toBe(-389.88);
    expect(result.missing).toEqual([]);
  });

  /**
   * The reason this is all-or-nothing. A lapsed consent returns no rows and a
   * zero "expected" balance; adding that zero in would report a month where
   * thousands of euros vanished, and the close would invent unrecorded
   * spending to explain it.
   */
  it("refuses the sum when a counted account cannot be read", () => {
    const result = cashBalanceAsOf(
      [
        { accountId: "a", label: "Compte de Dépôt", rows: day("2026-08-31", [2000]) },
        { accountId: "b", label: "Individual Space", rows: [] },
      ],
      "2026-08-31",
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      { accountId: "b", label: "Individual Space", reason: "no-rows-before" },
    ]);
    // The figure it did manage is still reported, for a screen that wants to
    // show what it saw — but `ok` is what decides whether a month closes.
    expect(result.total).toBe(2000);
  });

  it("counts nothing as unreadable rather than as zero", () => {
    expect(cashBalanceAsOf([], "2026-08-31").ok).toBe(false);
  });
});

describe("intradayIndexes", () => {
  it("numbers a day's rows from the newest, in provider order", () => {
    const map = intradayIndexes([
      { id: "c", date: "2026-08-31" },
      { id: "b", date: "2026-08-31" },
      { id: "a", date: "2026-08-30" },
    ]);

    expect(map.get("c")).toBe(0);
    expect(map.get("b")).toBe(1);
    expect(map.get("a")).toBe(0);
  });

  /**
   * Own-account transfers are dropped before they reach the ledger, but they
   * still moved the balance. Numbering after the drop would give index 0 to a
   * row the day did not end on, and the close would read the wrong figure.
   */
  it("counts rows that will later be discarded", () => {
    const map = intradayIndexes([
      { id: "own-transfer", date: "2026-08-31" },
      { id: "groceries", date: "2026-08-31" },
    ]);

    expect(map.get("own-transfer")).toBe(0);
    expect(map.get("groceries")).toBe(1);
  });

  it("skips rows the provider left undated", () => {
    const map = intradayIndexes([
      { id: "x", date: null },
      { id: "y", date: "2026-08-31" },
    ]);

    expect(map.has("x")).toBe(false);
    expect(map.get("y")).toBe(0);
  });
});

describe("balanceAsOf, when a day's last movement was dropped", () => {
  /**
   * Positions are numbered over the bank's whole batch, so index 0 is always
   * the day's last movement. Its absence means a row was filtered out after
   * numbering — an own-account transfer, say — and the newest balance held
   * for that day is the one from before it.
   */
  it("refuses rather than answering with a mid-day balance", () => {
    const rows: BalanceRow[] = [
      { occurredOn: "2026-08-31", balanceAfter: -300, intradayIndex: 1 },
      { occurredOn: "2026-08-31", balanceAfter: -250, intradayIndex: 2 },
    ];

    expect(balanceAsOf(rows, "2026-08-31")).toEqual({
      ok: false,
      reason: "day-incomplete",
    });
  });

  it("is content when an earlier complete day answers", () => {
    const rows: BalanceRow[] = [
      { occurredOn: "2026-08-28", balanceAfter: 1200, intradayIndex: 0 },
    ];

    const result = balanceAsOf(rows, "2026-08-31");

    expect(result.ok).toBe(true);
  });
});
