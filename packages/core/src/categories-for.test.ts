import { describe, expect, it } from "vitest";

import { categoriesFor, refundCategoryOf } from "./categories";

const categories = [
  {
    id: "salary",
    name: "Salaire",
    type: "income" as const,
    counts_toward_summary: true,
  },
  {
    id: "refunds",
    name: "Remboursements",
    type: "income" as const,
    counts_toward_summary: false,
  },
  {
    id: "food",
    name: "Courses",
    type: "expense" as const,
    counts_toward_summary: true,
  },
  {
    id: "livret",
    name: "Retrait Livret A",
    type: "savings" as const,
    counts_toward_summary: false,
  },
  {
    id: "save",
    name: "Épargne",
    type: "savings" as const,
    counts_toward_summary: true,
  },
];

describe("categoriesFor", () => {
  it("offers money in only what can receive it", () => {
    expect(categoriesFor("in", categories).map((c) => c.id)).toEqual([
      "salary",
      "refunds",
      "livret",
    ]);
  });

  it("offers money out anything but income", () => {
    expect(categoriesFor("out", categories).map((c) => c.id)).toEqual([
      "food",
      "livret",
      "save",
    ]);
  });
});

describe("refundCategoryOf", () => {
  it("finds the refund category by either name", () => {
    expect(refundCategoryOf(categories)?.id).toBe("refunds");
    expect(refundCategoryOf([{ name: "Refunds", type: "income" }])?.name).toBe(
      "Refunds",
    );
    expect(refundCategoryOf([{ name: "Salaire", type: "income" }])).toBeNull();
  });
});
