import { describe, expect, it } from "vitest";

import { categoryNameVariants } from "./constants";
import { buildMissingCategorySeeds } from "./seed-categories";

describe("default categories", () => {
  it("seeds a new account in its own language", () => {
    const french = buildMissingCategorySeeds("u", [], "fr");
    const english = buildMissingCategorySeeds("u", [], "en");
    expect(french.map((row) => row.name)).toContain("Courses");
    expect(english.map((row) => row.name)).toContain("Groceries");
    expect(french).toHaveLength(english.length);
  });

  it("never adds a French default beside its English twin", () => {
    // An account seeded in English before the defaults were French.
    const existing = [
      { name: "Groceries", type: "expense" },
      { name: "salary", type: "income" },
    ];
    const missing = buildMissingCategorySeeds("u", existing, "fr").map(
      (row) => row.name,
    );
    expect(missing).not.toContain("Courses");
    expect(missing).not.toContain("Salaire");
    expect(missing).toContain("Électricité");
  });

  it("keeps the wallet in the name of each investment default", () => {
    const names = buildMissingCategorySeeds("u", [], "fr")
      .filter((row) => row.type === "investment")
      .map((row) => row.name);
    expect(names.some((name) => name.includes("PEA"))).toBe(true);
    expect(names.some((name) => name.includes("CTO"))).toBe(true);
    expect(names.some((name) => name.includes("Bitstack"))).toBe(true);
  });

  it("knows both names of a default from either one", () => {
    expect(categoryNameVariants("Groceries")).toEqual(["Groceries", "Courses"]);
    expect(categoryNameVariants("courses")).toContain("Groceries");
    expect(categoryNameVariants("Vacances")).toEqual(["Vacances"]);
  });
});
