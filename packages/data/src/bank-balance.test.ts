import { describe, expect, it } from "vitest";
import type { BankAccount } from "@finance/core/types/database";

import type { Db } from "./client";
import { readCashBalance } from "./bank-balance";

interface Row {
  provider_account_id: string;
  occurred_on: string;
  balance_after: number | null;
  intraday_index: number;
  amount: number;
  direction: "in" | "out";
}

function account(
  id: string,
  overrides: Partial<BankAccount> = {},
): Partial<BankAccount> {
  return {
    provider_account_id: id,
    label: id,
    role: "spending",
    counts_as_cash: true,
    history_imported_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * A client over two tables that honours what the balance read asks of the
 * statement: one account, on or before a day, newest or oldest first, so
 * many rows.
 */
function fakeDb(accounts: Partial<BankAccount>[], statement: Row[]) {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let upTo: string | null = null;
    let newestFirst = true;
    let limit = Infinity;
    const result = () => {
      if (table === "bank_accounts") {
        return { data: accounts, error: null };
      }
      const rows = statement
        .filter(
          (row) =>
            row.provider_account_id === filters.provider_account_id &&
            (upTo === null || row.occurred_on <= upTo),
        )
        .sort((a, b) =>
          a.occurred_on === b.occurred_on
            ? (a.intraday_index - b.intraday_index) * (newestFirst ? 1 : -1)
            : a.occurred_on < b.occurred_on === newestFirst
              ? 1
              : -1,
        )
        .slice(0, limit);
      return { data: rows, error: null };
    };
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      },
      lte: (_column: string, value: string) => {
        upTo = value;
        return chain;
      },
      order: (column: string, options: { ascending: boolean }) => {
        if (column === "occurred_on") {
          newestFirst = !options.ascending;
        }
        return chain;
      },
      limit: (count: number) => {
        limit = count;
        return chain;
      },
      then: (resolve: (value: unknown) => unknown) => resolve(result()),
    };
    return chain;
  };
  return { from } as unknown as Db;
}

function movement(
  id: string,
  occurredOn: string,
  balanceAfter: number | null,
  intradayIndex = 0,
  amount = 10,
  direction: "in" | "out" = "out",
): Row {
  return {
    provider_account_id: id,
    occurred_on: occurredOn,
    balance_after: balanceAfter,
    intraday_index: intradayIndex,
    amount,
    direction,
  };
}

describe("readCashBalance", () => {
  it("reads a quiet account however busy the other one is", async () => {
    const busy = Array.from({ length: 500 }, (_, index) =>
      movement("busy", "2026-09-30", 1000 + index, index),
    );
    const db = fakeDb(
      [account("busy"), account("quiet")],
      [...busy, movement("quiet", "2026-06-02", 300)],
    );

    const balance = await readCashBalance(db, "u1", "2026-09-30");

    expect(balance?.ok).toBe(true);
    expect(balance?.total).toBe(1300);
  });

  it("counts only the accounts that count", async () => {
    const db = fakeDb(
      [
        account("courant"),
        account("livret", { role: "savings", counts_as_cash: false }),
      ],
      [
        movement("courant", "2026-09-10", 500),
        movement("livret", "2026-09-10", 9000),
      ],
    );

    expect((await readCashBalance(db, "u1", "2026-09-30"))?.total).toBe(500);
  });

  it("reads a day before the statement begins from its first movement", async () => {
    const db = fakeDb(
      [account("new")],
      [
        // The first day: the salary came in first, then the rent went out.
        movement("new", "2026-10-03", 800, 0, 700, "out"),
        movement("new", "2026-10-03", 1500, 1, 1500, "in"),
        movement("new", "2026-10-09", 760),
      ],
    );

    const balance = await readCashBalance(db, "u1", "2026-09-30");

    expect(balance?.ok).toBe(true);
    expect(balance?.total).toBe(0);
  });

  it("does not, while the account's history is not in", async () => {
    const db = fakeDb(
      [account("new", { history_imported_at: null })],
      [movement("new", "2026-10-03", 800)],
    );

    const balance = await readCashBalance(db, "u1", "2026-09-30");

    expect(balance?.ok).toBe(false);
    expect(balance?.missing.map((entry) => entry.reason)).toEqual([
      "no-rows-before",
    ]);
  });

  it("says nothing when no account counts", async () => {
    const db = fakeDb(
      [account("livret", { role: "savings", counts_as_cash: false })],
      [],
    );

    expect(await readCashBalance(db, "u1", "2026-09-30")).toBeNull();
  });
});
