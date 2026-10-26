import { describe, expect, it } from "vitest";
import {
  buildMerchantScreen,
  filterMerchants,
  merchantKeyOf,
  merchantWindow,
} from "./merchant-screen";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function tx(
  id: string,
  note: string | null,
  occurredOn: string,
  amount: number,
  category: { id: string; name: string; type?: CategoryType; counts?: boolean } = {
    id: "c-groceries",
    name: "Courses",
  },
): TransactionWithCategory {
  return {
    id,
    user_id: "u",
    category_id: category.id,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note,
    created_at: `${occurredOn}T00:00:00.000Z`,
    cash_on: null,
    deleted_at: null,
    categories: {
      name: category.name,
      type: category.type ?? "expense",
      icon: "basket",
      counts_toward_summary: category.counts ?? true,
    },
  };
}

const at = { year: 2026, month: 10, locale: "fr" as const };

describe("merchantKeyOf", () => {
  it("keys a shop by its first two meaningful words, whatever the bank added", () => {
    expect(merchantKeyOf("PAIEMENT PAR CARTE X7322 CARREFOUR MARKET PARIS")).toBe(
      "carrefour market",
    );
    expect(merchantKeyOf("CARREFOUR MARKET LYON 03")).toBe("carrefour market");
    expect(merchantKeyOf("Carrefour")).toBe("carrefour");
    expect(merchantKeyOf("Boulangerie Dupont")).toBe("boulangerie dupont");
    expect(merchantKeyOf("Boulangerie Martin")).toBe("boulangerie martin");
    expect(merchantKeyOf("LE BISTROT SAS")).toBe("bistrot");
  });

  it("names nothing from no words", () => {
    expect(merchantKeyOf("")).toBe("");
    expect(merchantKeyOf("  ")).toBe("");
    expect(merchantKeyOf(null)).toBe("");
    expect(merchantKeyOf("X1")).toBe("");
  });
});

describe("merchantWindow", () => {
  it("spans twelve months ending on the month asked", () => {
    const window = merchantWindow(2026, 10, "fr");
    expect(window.keys).toHaveLength(12);
    expect(window.keys[0]!.monthKey).toBe("2025-11");
    expect(window.keys[11]!.monthKey).toBe("2026-10");
    expect(window.from).toBe("2025-11-01");
    expect(window.to).toBe("2026-10-31");
  });
});

describe("buildMerchantScreen", () => {
  it("gathers a shop's rows however the bank spelled it, biggest shop first", () => {
    const screen = buildMerchantScreen(
      [
        tx("1", "CARREFOUR MARKET PARIS 11", "2026-10-02", 42.1),
        tx("2", "PAIEMENT PAR CARTE X7322 CARREFOUR MARKET LYON", "2026-09-14", 18.3),
        tx("3", "Carrefour Market", "2026-08-01", 60),
        tx("4", "Boulangerie Dupont", "2026-10-05", 3.2),
      ],
      at,
    );
    expect(screen.merchants.map((card) => card.key)).toEqual([
      "carrefour market",
      "boulangerie dupont",
    ]);
    const carrefour = screen.merchants[0]!;
    expect(carrefour.visits).toBe(3);
    expect(carrefour.total).toBe(120.4);
    expect(carrefour.perVisit).toBe(40.13);
    expect(carrefour.lastOn).toBe("2026-10-02");
    expect(carrefour.lastAmount).toBe(42.1);
    expect(carrefour.rows.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });

  it("says what a normal month comes to as a median over the months it was visited", () => {
    const [card] = buildMerchantScreen(
      [
        tx("1", "Lidl", "2026-10-01", 10),
        tx("2", "Lidl", "2026-10-15", 10),
        tx("3", "Lidl", "2026-09-01", 100),
        tx("4", "Lidl", "2026-07-01", 30),
      ],
      at,
    ).merchants;
    // Months: Oct 20, Sep 100, Jul 30 → median 30; empty months left out.
    expect(card!.normal).toBe(30);
    expect(card!.points).toHaveLength(12);
    expect(card!.points.filter((point) => !point.empty)).toHaveLength(3);
    expect(card!.points[11]).toMatchObject({ monthKey: "2026-10", total: 20 });
  });

  it("names the shop as it is written most often, and its usual category", () => {
    const [card] = buildMerchantScreen(
      [
        tx("1", "Amazon", "2026-10-01", 20, { id: "c-shop", name: "Achats" }),
        tx("2", "AMAZON EU SARL", "2026-09-01", 20, { id: "c-shop", name: "Achats" }),
        tx("3", "Amazon", "2026-08-01", 9, { id: "c-books", name: "Livres" }),
      ],
      at,
    ).merchants;
    expect(card!.name).toBe("Amazon");
    expect(card!.categoryName).toBe("Achats");
    expect(card!.mixed).toBe(true);
  });

  it("leaves out a purchase inside a wallet and a row with no words", () => {
    const screen = buildMerchantScreen(
      [
        tx("1", "DCA PEA", "2026-10-01", 100, {
          id: "c-pea",
          name: "DCA PEA",
          type: "investment",
          counts: false,
        }),
        tx("2", null, "2026-10-01", 5),
        tx("3", "  ", "2026-10-01", 5),
      ],
      at,
    );
    expect(screen.merchants).toEqual([]);
  });
});

describe("filterMerchants", () => {
  const screen = buildMerchantScreen(
    [
      tx("1", "Café Joyeux", "2026-10-01", 4, { id: "c-out", name: "Sorties" }),
      tx("2", "Lidl", "2026-10-01", 30, { id: "c-groceries", name: "Courses" }),
    ],
    at,
  );

  it("finds a shop by its words, without accents, or by its category", () => {
    expect(filterMerchants(screen.merchants, "cafe").map((c) => c.key)).toEqual([
      "cafe joyeux",
    ]);
    expect(
      filterMerchants(screen.merchants, "courses").map((c) => c.key),
    ).toEqual(["lidl"]);
    expect(filterMerchants(screen.merchants, "")).toHaveLength(2);
  });
});
