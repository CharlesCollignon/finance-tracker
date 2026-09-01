import { describe, expect, it } from "vitest";

import {
  buildMerchantIndex,
  guessCategoryForDescription,
  lookupMerchant,
  normalizeMerchant,
  suggestMerchants,
} from "./merchant-memory";
import type { CategoryType, TransactionWithCategory } from "./types/database";

let sequence = 0;

function tx(
  note: string | null,
  categoryName: string,
  amount: number,
  occurredOn: string,
  type: CategoryType = "expense",
): TransactionWithCategory {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    user_id: "user-1",
    category_id: `cat-${categoryName}`,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note,
    created_at: `${occurredOn}T10:00:00.000Z`,
    categories: {
      name: categoryName,
      type,
      icon: null,
      counts_toward_summary: true,
    },
  };
}

describe("normalizeMerchant", () => {
  it("folds case and accents", () => {
    expect(normalizeMerchant("Café Crème")).toBe("cafe creme");
  });

  it("strips card-network noise a bank puts on the line", () => {
    expect(normalizeMerchant("CARTE 12/03 FRANPRIX PARIS")).toBe(
      "franprix paris",
    );
  });

  it("strips long reference numbers", () => {
    expect(normalizeMerchant("PRLV SEPA EDF 45219987")).toBe("edf");
  });

  it("returns an empty key for a note with no merchant in it", () => {
    expect(normalizeMerchant("  ")).toBe("");
    expect(normalizeMerchant(null)).toBe("");
  });

  it("gives two spellings of one merchant the same key", () => {
    expect(normalizeMerchant("franprix")).toBe(
      normalizeMerchant("CB FRANPRIX 03/09"),
    );
  });
});

describe("buildMerchantIndex", () => {
  it("skips transactions with no note", () => {
    const index = buildMerchantIndex([tx(null, "Groceries", 12, "2026-08-01")]);
    expect(index.size).toBe(0);
  });

  it("counts every sighting of a merchant", () => {
    const index = buildMerchantIndex([
      tx("Franprix", "Groceries", 12, "2026-08-01"),
      tx("FRANPRIX", "Groceries", 18, "2026-08-08"),
      tx("carte franprix", "Groceries", 22, "2026-08-15"),
    ]);

    expect(index.get("franprix")?.count).toBe(3);
  });

  it("suggests the most recent category and amount, not the first", () => {
    const index = buildMerchantIndex([
      tx("Monoprix", "Groceries", 30, "2026-07-01"),
      tx("Monoprix", "Household", 45, "2026-08-01"),
    ]);

    const rule = index.get("monoprix");
    expect(rule?.categoryName).toBe("Household");
    expect(rule?.lastAmount).toBe(45);
  });

  it("is not fooled by input order", () => {
    const index = buildMerchantIndex([
      tx("Monoprix", "Household", 45, "2026-08-01"),
      tx("Monoprix", "Groceries", 30, "2026-07-01"),
    ]);

    expect(index.get("monoprix")?.categoryName).toBe("Household");
  });

  it("keeps the spelling the user last typed for display", () => {
    const index = buildMerchantIndex([
      tx("franprix", "Groceries", 12, "2026-07-01"),
      tx("Franprix Bastille", "Groceries", 12, "2026-08-01"),
    ]);

    expect(index.get("franprix bastille")?.label).toBe("Franprix Bastille");
  });
});

describe("lookupMerchant", () => {
  const index = buildMerchantIndex([
    tx("Franprix", "Groceries", 24, "2026-08-01"),
  ]);

  it("matches a differently-spelled note", () => {
    expect(lookupMerchant(index, "  FRANPRIX  ")?.categoryName).toBe(
      "Groceries",
    );
  });

  it("returns nothing for an unknown merchant", () => {
    expect(lookupMerchant(index, "Picard")).toBeNull();
  });

  it("returns nothing for an empty note", () => {
    expect(lookupMerchant(index, "")).toBeNull();
  });
});

describe("suggestMerchants", () => {
  const index = buildMerchantIndex([
    tx("Franprix", "Groceries", 24, "2026-08-01"),
    tx("Franprix", "Groceries", 24, "2026-08-08"),
    tx("Franchise fee", "Fees", 90, "2026-08-02"),
    tx("Boulangerie Fran", "Groceries", 3, "2026-08-03"),
  ]);

  it("ranks a prefix match above a substring match", () => {
    const results = suggestMerchants(index, "fran");
    expect(results[0]?.key).toBe("franprix");
    expect(results.map((r) => r.key)).toContain("boulangerie fran");
    expect(results.indexOf(results.find((r) => r.key === "boulangerie fran")!)).
      toBeGreaterThan(0);
  });

  it("ranks the more frequent merchant first among prefix matches", () => {
    const results = suggestMerchants(index, "fran");
    expect(results[0]?.count).toBe(2);
  });

  it("excludes the exact key the user has already typed in full", () => {
    const results = suggestMerchants(index, "Franprix");
    expect(results.map((r) => r.key)).not.toContain("franprix");
  });

  it("returns nothing for an empty query", () => {
    expect(suggestMerchants(index, "")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(suggestMerchants(index, "fran", 1)).toHaveLength(1);
  });
});

describe("guessCategoryForDescription", () => {
  const index = buildMerchantIndex([
    tx("Franprix", "Groceries", 24, "2026-08-01"),
    tx("SNCF", "Transport", 80, "2026-08-01"),
    tx("Franprix Bastille", "Groceries daily", 12, "2026-08-05"),
  ]);

  it("finds a remembered merchant inside a noisy statement line", () => {
    const rule = guessCategoryForDescription(
      index,
      "CARTE 12/03 FRANPRIX PARIS 11 4429",
    );
    expect(rule?.categoryName).toBe("Groceries");
  });

  it("prefers the more specific remembered merchant", () => {
    const rule = guessCategoryForDescription(
      index,
      "PAIEMENT CB FRANPRIX BASTILLE",
    );
    expect(rule?.categoryName).toBe("Groceries daily");
  });

  it("returns nothing when no merchant is recognised", () => {
    expect(
      guessCategoryForDescription(index, "VIREMENT INTERNE 998877"),
    ).toBeNull();
  });

  it("returns nothing for a blank description", () => {
    expect(guessCategoryForDescription(index, "")).toBeNull();
  });

  it("does not match on a key shorter than three characters", () => {
    const shortIndex = buildMerchantIndex([
      tx("Ed", "Groceries", 10, "2026-08-01"),
    ]);
    expect(
      guessCategoryForDescription(shortIndex, "SOMETHING EDIFICE"),
    ).toBeNull();
  });
});
