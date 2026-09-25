import { describe, expect, it } from "vitest";
import { allRows, PAGE_SIZE } from "./paging";

/** A fake capped endpoint over `total` numbered rows. */
function endpoint(total: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const rows = Array.from(
      { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
      (_, index) => from + index,
    );
    return { data: rows, error: null };
  };
  return { page, calls };
}

describe("allRows", () => {
  it("reads one short page and stops", async () => {
    const { page, calls } = endpoint(3);
    expect(await allRows(page)).toEqual([0, 1, 2]);
    expect(calls).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it("keeps reading past the server's cap", async () => {
    const { page, calls } = endpoint(PAGE_SIZE * 2 + 5);
    const rows = await allRows(page);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(rows.at(-1)).toBe(PAGE_SIZE * 2 + 4);
    expect(calls).toHaveLength(3);
  });

  it("asks once more after an exactly full page, and stops on the empty one", async () => {
    const { page, calls } = endpoint(PAGE_SIZE);
    expect(await allRows(page)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("throws the endpoint's error", async () => {
    const failure = new Error("boom");
    await expect(
      allRows(async () => ({ data: null, error: failure })),
    ).rejects.toBe(failure);
  });
});
