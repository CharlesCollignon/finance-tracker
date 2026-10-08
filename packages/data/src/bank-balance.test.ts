import { describe, expect, it } from "vitest";
import type { BankAccount } from "@finance/core/types/database";

import type { Db } from "./client";
import {
  getBankAccounts,
  readCashBalance,
  readCloseWait,
} from "./bank-balance";

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
    user_id: "u1",
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
      // The owner's accounts and the joint ones feeding it: one owner here.
      or: () => chain,
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

describe("readCashBalance for a shared space", () => {
  it("counts the joint account feeding it, once however many partners connected it", async () => {
    const joint = (id: string, user: string, seen: string) =>
      account(id, {
        user_id: user,
        role: "joint",
        counts_as_cash: false,
        space_id: "space",
        iban_hash: "same",
        first_seen_at: seen,
      });
    const db = fakeDb(
      [
        joint("alice-copy", "alice", "2026-01-01T00:00:00Z"),
        joint("bob-copy", "bob", "2026-03-01T00:00:00Z"),
      ],
      [
        movement("alice-copy", "2026-09-29", 1200),
        movement("bob-copy", "2026-09-29", 9999),
      ],
    );
    const balance = await readCashBalance(db, "space", "2026-09-30");
    expect(balance?.total).toBe(1200);
  });
});

describe("readCloseWait", () => {
  const september = {
    year: 2026,
    month: 9,
    monthKey: "2026-09",
    label: "septembre 2026",
    observeOn: "2026-10-05",
    isBaseline: false,
  };

  it("names each account the month waits on, by bank, and why", async () => {
    const db = fakeDb(
      [
        account("bourso", { bank_name: "BoursoBank", label: "Compte" }),
        account("ca", {
          bank_name: "Crédit Agricole",
          label: "Compte de dépôt",
          needs_reconnect: true,
          history_imported_at: null,
        }),
      ],
      [movement("bourso", "2026-09-20", 900)],
    );

    await expect(
      readCloseWait(db, "u1", september, "2026-10-07"),
    ).resolves.toEqual([
      { name: "Crédit Agricole · Compte de dépôt", reason: "lapsed" },
    ]);
  });

  it("waits on nothing before the month is due, or once it reads", async () => {
    const db = fakeDb(
      [account("bourso", { bank_name: "BoursoBank" })],
      [movement("bourso", "2026-09-20", 900)],
    );

    await expect(
      readCloseWait(db, "u1", september, "2026-10-04"),
    ).resolves.toEqual([]);
    await expect(
      readCloseWait(db, "u1", september, "2026-10-07"),
    ).resolves.toEqual([]);
    await expect(readCloseWait(db, "u1", null, "2026-10-07")).resolves.toEqual(
      [],
    );
  });
});

describe("getBankAccounts before migration 060", () => {
  it("reads the person's own accounts when there is no space to ask about", async () => {
    const asked: string[] = [];
    const db = {
      from: () => {
        let spaces = false;
        const chain = {
          select: () => chain,
          or: () => {
            spaces = true;
            return chain;
          },
          eq: () => chain,
          order: () => chain,
          then: (resolve: (value: unknown) => unknown) => {
            asked.push(spaces ? "or" : "eq");
            return resolve(
              spaces
                ? { data: null, error: { code: "42703" } }
                : { data: [account("own")], error: null },
            );
          },
        };
        return chain;
      },
    } as unknown as Db;

    const accounts = await getBankAccounts(db, "u1");
    expect(asked).toEqual(["or", "eq"]);
    expect(accounts.map((each) => each.provider_account_id)).toEqual(["own"]);
  });
});
