import { describe, expect, it } from "vitest";

import { groupPendingFeed, type FeedGroupItem } from "./bank-inbox-groups";
import { buildBankMerchantIndex } from "./bank-merchant";

const categories = [
  { id: "groceries", type: "expense" as const },
  { id: "shopping", type: "expense" as const },
  { id: "salary", type: "income" as const },
  { id: "old", type: "expense" as const, archived: true },
];

function row(
  id: string,
  counterparty: string,
  amount: number,
  overrides: Partial<FeedGroupItem> = {},
): FeedGroupItem {
  return {
    id,
    occurredOn: "2026-09-10",
    amount,
    direction: "out",
    counterparty,
    note: `PAIEMENT PAR CARTE X7322 ${counterparty}`,
    ...overrides,
  };
}

function history(note: string, categoryId: string, occurredOn = "2026-08-01") {
  return {
    note,
    category_id: categoryId,
    occurred_on: occurredOn,
    categories: { name: categoryId, type: "expense" },
  };
}

const none = buildBankMerchantIndex([]);

describe("groupPendingFeed", () => {
  it("puts the same shop's rows together, whatever branch the bank wrote", () => {
    const groups = groupPendingFeed(
      [
        row("a", "CARREFOUR MARKET PARIS 11", 30, { occurredOn: "2026-09-02" }),
        row("b", "CARREFOUR MARKET LYON", 20, { occurredOn: "2026-09-20" }),
        row("c", "SNCF", 50),
      ],
      { bankMerchants: none, categories },
    );

    const carrefour = groups.find((group) => group.count === 2)!;
    expect(carrefour.rows.map((item) => item.id)).toEqual(["b", "a"]);
    expect(carrefour.total).toBe(50);
    expect(carrefour.firstOn).toBe("2026-09-02");
    expect(carrefour.lastOn).toBe("2026-09-20");
    expect(groups).toHaveLength(2);
  });

  it("orders groups by how much of the pile they clear", () => {
    const groups = groupPendingFeed(
      [
        row("a", "SNCF", 100),
        row("b", "CARREFOUR", 10),
        row("c", "CARREFOUR", 10),
        row("d", "CARREFOUR", 10),
      ],
      { bankMerchants: none, categories },
    );
    // 3 × 30 = 90 against 1 × 100 = 100: the single large one still leads.
    expect(groups.map((group) => group.count)).toEqual([1, 3]);
  });

  it("keeps money in and money out from the same merchant apart", () => {
    const groups = groupPendingFeed(
      [row("a", "AMAZON", 40), row("b", "AMAZON", 15, { direction: "in" })],
      { bankMerchants: none, categories },
    );
    expect(groups.map((group) => group.direction).sort()).toEqual([
      "in",
      "out",
    ]);
  });

  it("suggests what the user's history files the shop under", () => {
    const bankMerchants = buildBankMerchantIndex([
      history("CARREFOUR CITY", "groceries"),
      history("CARREFOUR MARKET", "groceries"),
    ]);
    const [group] = groupPendingFeed(
      [row("a", "CARREFOUR", 12), row("b", "CARREFOUR", 8)],
      { bankMerchants, categories },
    );
    expect(group!.suggestedCategoryId).toBe("groceries");
    expect(group!.mixed).toBe(false);
  });

  it("asks row by row where history files the shop more than one way", () => {
    const bankMerchants = buildBankMerchantIndex([
      history("AMAZON EU", "shopping", "2026-08-01"),
      history("AMAZON EU", "groceries", "2026-08-09"),
    ]);
    const [group] = groupPendingFeed(
      [row("a", "AMAZON EU", 12), row("b", "AMAZON EU", 8)],
      { bankMerchants, categories },
    );
    expect(group!.mixed).toBe(true);
    // Still preselected with the latest answer, for whoever files it anyway.
    expect(group!.suggestedCategoryId).toBe("groceries");
  });

  it("never suggests an expense for money coming in, nor an archived category", () => {
    const bankMerchants = buildBankMerchantIndex([history("ACME", "shopping")]);
    const [refund] = groupPendingFeed(
      [row("a", "ACME", 10, { direction: "in" })],
      { bankMerchants, categories },
    );
    expect(refund!.suggestedCategoryId).toBeNull();

    const [stale] = groupPendingFeed(
      [row("b", "BAKERY", 3, { suggestedCategoryId: "old" })],
      { bankMerchants: none, categories },
    );
    expect(stale!.suggestedCategoryId).toBeNull();
  });

  it("falls back to the rows' own suggestion when history has none", () => {
    const [agreed] = groupPendingFeed(
      [
        row("a", "EMPLOYER", 2000, {
          direction: "in",
          suggestedCategoryId: "salary",
        }),
        row("b", "EMPLOYER", 2000, {
          direction: "in",
          suggestedCategoryId: "salary",
        }),
      ],
      { bankMerchants: none, categories },
    );
    expect(agreed!.suggestedCategoryId).toBe("salary");

    const [split] = groupPendingFeed(
      [
        row("c", "SHOP", 5, { suggestedCategoryId: "groceries" }),
        row("d", "SHOP", 6, { suggestedCategoryId: "shopping" }),
      ],
      { bankMerchants: none, categories },
    );
    expect(split!.suggestedCategoryId).toBeNull();
    expect(split!.mixed).toBe(true);
  });

  it("keeps a row with nothing to key on as a group of its own", () => {
    const groups = groupPendingFeed(
      [
        row("a", "", 5, { counterparty: null, note: "X1" }),
        row("b", "", 7, { counterparty: null, note: "X1" }),
      ],
      { bankMerchants: none, categories },
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.count === 1 && !group.mixed)).toBe(
      true,
    );
  });

  it("names a group by the description its rows share most", () => {
    const [group] = groupPendingFeed(
      [
        row("a", "Franprix", 4),
        row("b", "FRANPRIX 5123", 6),
        row("c", "Franprix", 3),
      ],
      { bankMerchants: none, categories },
    );
    expect(group!.name).toBe("Franprix");
  });
});
