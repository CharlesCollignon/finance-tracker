import { describe, expect, it } from "vitest";

import { groupDecidedFeed, type DecidedFeedItem } from "./bank-decided-groups";

function row(
  overrides: Partial<DecidedFeedItem> & { id: string },
): DecidedFeedItem {
  return {
    occurredOn: "2026-09-10",
    amount: 10,
    direction: "out",
    counterparty: "CARREFOUR CITY",
    note: "CB CARREFOUR CITY",
    status: "imported",
    categoryId: "groceries",
    ...overrides,
  };
}

describe("groupDecidedFeed", () => {
  it("puts one shop filed one way into one group", () => {
    const groups = groupDecidedFeed([
      row({ id: "a", occurredOn: "2026-09-02", amount: 12.5 }),
      row({ id: "b", occurredOn: "2026-09-09", amount: 7.25 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      count: 2,
      total: 19.75,
      lastOn: "2026-09-09",
      status: "imported",
      categoryId: "groceries",
    });
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("keeps apart what one decision could not have produced together", () => {
    const groups = groupDecidedFeed([
      row({ id: "filed" }),
      row({ id: "other-category", categoryId: "eating-out" }),
      row({ id: "left-out", status: "ignored", categoryId: null }),
      row({ id: "refund", direction: "in", categoryId: "income" }),
    ]);
    expect(groups).toHaveLength(4);
  });

  it("gives a row with no usable description a group of its own", () => {
    const groups = groupDecidedFeed([
      row({ id: "x", counterparty: null, note: "" }),
      row({ id: "y", counterparty: null, note: "" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("puts the latest decision first", () => {
    const groups = groupDecidedFeed([
      row({
        id: "old",
        counterparty: "SNCF",
        note: "SNCF",
        occurredOn: "2026-08-01",
      }),
      row({ id: "new", occurredOn: "2026-09-20" }),
    ]);
    expect(groups.map((group) => group.rows[0]!.id)).toEqual(["new", "old"]);
  });
});
