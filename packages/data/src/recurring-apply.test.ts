import { describe, expect, it, vi } from "vitest";

import type { RecurringOccurrenceUpdate } from "@finance/core/apply-recurring";

import type { Db } from "./client";
import { writeReprices } from "./recurring-apply";

function reprice(id: string, amount: number): RecurringOccurrenceUpdate {
  return {
    transactionId: id,
    templateId: "t1",
    categoryId: "c1",
    occurredOn: "2026-10-15",
    amount,
    note: "PEA",
    previousAmount: amount - 1,
    previousNote: "PEA",
    previousCategoryId: "c1",
  } as RecurringOccurrenceUpdate;
}

/** A client whose batch call answers as asked, and that counts the rest. */
function fakeDb(batch: { data: number | null; error: unknown }) {
  const rpc = vi.fn(async () => batch);
  const eq = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { db: { rpc, from } as unknown as Db, rpc, update };
}

describe("writeReprices", () => {
  it("reprices a month in one call", async () => {
    const { db, rpc, update } = fakeDb({ data: 2, error: null });
    await expect(
      writeReprices(db, "u1", [reprice("a", 101), reprice("b", 202)]),
    ).resolves.toEqual({ repriced: 2, failures: [] });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("reprice_occurrences", {
      target_user: "u1",
      updates: [
        { id: "a", amount: 101, note: "PEA", category_id: "c1" },
        { id: "b", amount: 202, note: "PEA", category_id: "c1" },
      ],
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("goes a row at a time before migration 067", async () => {
    const { db, update } = fakeDb({
      data: null,
      error: { code: "PGRST202", message: "not found" },
    });
    await expect(
      writeReprices(db, "u1", [reprice("a", 101), reprice("b", 202)]),
    ).resolves.toEqual({ repriced: 2, failures: [] });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("makes no call with nothing to reprice", async () => {
    const { db, rpc } = fakeDb({ data: 0, error: null });
    await expect(writeReprices(db, "u1", [])).resolves.toEqual({
      repriced: 0,
      failures: [],
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
