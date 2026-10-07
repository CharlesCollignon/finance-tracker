import { describe, expect, it } from "vitest";

import type { Db } from "./client";
import { setBankAccountRole } from "./bank-accounts";

const LIVRET_ID = "5f0c6a3e-8a52-4f43-9d0e-2b7f0f6c1a11";

interface Write {
  table: string;
  payload: Record<string, unknown>;
  filters: [string, unknown][];
}

/**
 * A client that answers every read of a table with the same rows, and
 * records every update with the filters it was narrowed by.
 */
function fakeDb(tables: Record<string, { rows?: unknown[]; one?: unknown }>) {
  const writes: Write[] = [];
  const from = (table: string) => {
    let write: Write | null = null;
    const chain = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => {
        write = { table, payload, filters: [] };
        writes.push(write);
        return chain;
      },
      eq: (column: string, value: unknown) => {
        write?.filters.push([column, value]);
        return chain;
      },
      maybeSingle: async () => ({ data: tables[table]?.one ?? null }),
      then: (resolve: (value: unknown) => unknown) =>
        resolve(
          write
            ? { error: null }
            : { data: tables[table]?.rows ?? [], error: null },
        ),
    };
    return chain;
  };
  return { db: { from } as unknown as Db, writes };
}

describe("setBankAccountRole", () => {
  it("lets go of the Livret that read an account no longer Épargne", async () => {
    const { db, writes } = fakeDb({
      savings_accounts: {
        rows: [{ id: LIVRET_ID }],
        one: { bank_account_id: "acc", balance: 10, balance_on: "2026-01-01" },
      },
      bank_accounts: {
        one: { reported_balance: 250, reported_on: "2026-10-01" },
      },
    });

    await expect(
      setBankAccountRole(db, "u1", "acc", "spending"),
    ).resolves.toEqual({ success: true });

    expect(writes[0]).toEqual({
      table: "bank_accounts",
      payload: { role: "spending" },
      filters: [
        ["user_id", "u1"],
        ["provider_account_id", "acc"],
      ],
    });
    // The Livret keeps the last balance the bank gave as its own.
    expect(writes[1]).toMatchObject({
      table: "savings_accounts",
      payload: {
        bank_account_id: null,
        balance: 250,
        balance_on: "2026-10-01",
      },
    });
    expect(writes).toHaveLength(2);
  });

  it("leaves a Livret alone when the account is Épargne", async () => {
    const { db, writes } = fakeDb({
      savings_accounts: { rows: [{ id: LIVRET_ID }] },
    });

    await setBankAccountRole(db, "u1", "acc", "savings");

    expect(writes.map((write) => write.table)).toEqual(["bank_accounts"]);
  });

  it("refuses a role that is not one of the three, writing nothing", async () => {
    const { db, writes } = fakeDb({});

    await expect(
      setBankAccountRole(db, "u1", "acc", "joint" as "ignored"),
    ).resolves.toEqual({ error: "errors.invalidInput" });
    expect(writes).toHaveLength(0);
  });
});
