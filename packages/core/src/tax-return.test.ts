import { describe, expect, it } from "vitest";

import {
  CATEGORY_BOXES,
  inTaxSeason,
  incomeYearFor,
  taxReturnBoxes,
  taxRulesFor,
  type TaxBoxId,
  type TaxRow,
} from "./tax-return";

function row(
  id: string,
  occurredOn: string,
  amount: number,
  extra: Partial<TaxRow> = {},
): TaxRow {
  return {
    id,
    occurredOn,
    amount,
    note: null,
    categoryId: "c-other",
    categoryName: "Divers",
    categoryType: "expense",
    walletId: null,
    rent: null,
    ...extra,
  };
}

describe("the rules", () => {
  it("are the year's own when its forms are known, the latest otherwise", () => {
    expect(taxRulesFor(2025)).toMatchObject({
      rules: { formsYear: 2026 },
      provisional: false,
    });
    expect(taxRulesFor(2026)).toMatchObject({
      rules: { incomeYear: 2025 },
      provisional: true,
    });
  });

  it("files in April to June, for the year before", () => {
    expect(inTaxSeason("2027-04-01")).toBe(true);
    expect(inTaxSeason("2027-06-30")).toBe(true);
    expect(inTaxSeason("2027-07-01")).toBe(false);
    expect(incomeYearFor("2027-04-15")).toBe(2026);
  });

  it("lets a person file categories in the boxes that take them", () => {
    expect(CATEGORY_BOXES).toEqual(["7UF", "7UD", "7DB", "7GA", "7GB", "7GC"]);
  });
});

describe("taxReturnBoxes", () => {
  const { rules } = taxRulesFor(2025);
  const amountOf = (figures: ReturnType<typeof taxReturnBoxes>, id: TaxBoxId) =>
    figures.find((figure) => figure.rule.id === id)!.amount;

  it("sums the year's rows of the categories filed in a box", () => {
    const figures = taxReturnBoxes(
      rules,
      [
        row("a", "2025-03-01", 50, { categoryId: "dons" }),
        row("b", "2025-11-20", 30.5, { categoryId: "dons" }),
        row("c", "2024-12-31", 99, { categoryId: "dons" }),
        row("d", "2025-05-01", 400, { categoryId: "menage" }),
      ],
      new Map<string, TaxBoxId>([
        ["dons", "7UF"],
        ["menage", "7DB"],
      ]),
    );
    expect(amountOf(figures, "7UF")).toBe(80.5);
    expect(amountOf(figures, "7DB")).toBe(400);
    expect(
      figures.find((f) => f.rule.id === "7UF")!.rows.map((r) => r.id),
    ).toEqual(["b", "a"]);
  });

  it("fills the PER and the rents from what the app already knows", () => {
    const figures = taxReturnBoxes(
      rules,
      [
        row("p", "2025-02-01", 200, {
          categoryType: "investment",
          walletId: "per",
        }),
        row("q", "2025-02-01", 150, {
          categoryType: "investment",
          walletId: "pea",
        }),
        row("r", "2025-02-01", 620, { categoryType: "income", rent: "bare" }),
        row("s", "2025-02-01", 700, {
          categoryType: "income",
          rent: "furnished",
        }),
      ],
      new Map(),
    );
    expect(amountOf(figures, "6NS")).toBe(200);
    expect(amountOf(figures, "4BE")).toBe(620);
    expect(amountOf(figures, "5NI")).toBe(700);
  });

  it("counts a row once, in the box its category was filed in", () => {
    const figures = taxReturnBoxes(
      rules,
      [
        row("r", "2025-02-01", 620, {
          categoryId: "loyers",
          categoryType: "income",
          rent: "bare",
        }),
      ],
      new Map<string, TaxBoxId>([["loyers", "7UF"]]),
    );
    // Filed in a box of expenses, an income row counts in neither.
    expect(amountOf(figures, "7UF")).toBe(0);
    expect(amountOf(figures, "4BE")).toBe(0);
  });
});
