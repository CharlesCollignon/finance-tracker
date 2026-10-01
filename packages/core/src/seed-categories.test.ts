import { describe, expect, it } from "vitest";

import { categoryNameVariants } from "./constants";
import {
  buildCategoryRenames,
  buildMissingCategorySeeds,
} from "./seed-categories";

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

  it("does not seed a DCA again under its new name", () => {
    const missing = buildMissingCategorySeeds(
      "u",
      [{ name: "PEA monthly DCA", type: "investment" }],
      "fr",
    ).map((row) => row.name);
    expect(missing).not.toContain("DCA PEA");
  });
});

describe("renaming the defaults into the reader's language", () => {
  it("renames English defaults and old DCA names for a French reader", () => {
    expect(
      buildCategoryRenames(
        [
          { id: "1", name: "Groceries", type: "expense" },
          { id: "2", name: "PEA monthly DCA", type: "investment" },
          { id: "3", name: "Achat hebdomadaire CTO", type: "investment" },
          { id: "4", name: "Vacances", type: "expense" },
          { id: "5", name: "Salaire", type: "income" },
        ],
        "fr",
      ),
    ).toEqual([
      { id: "1", name: "Courses" },
      { id: "2", name: "DCA PEA" },
      { id: "3", name: "DCA CTO" },
    ]);
  });

  it("renames French defaults back for an English reader", () => {
    expect(
      buildCategoryRenames(
        [{ id: "1", name: "Courses", type: "expense" }],
        "en",
      ),
    ).toEqual([{ id: "1", name: "Groceries" }]);
  });

  it("never takes a name another category already has", () => {
    expect(
      buildCategoryRenames(
        [
          { id: "1", name: "Groceries", type: "expense" },
          { id: "2", name: "Courses", type: "expense" },
          { id: "3", name: "CTO weekly DCA", type: "investment" },
          { id: "4", name: "Achat hebdomadaire CTO", type: "investment" },
        ],
        "fr",
      ),
    ).toEqual([{ id: "3", name: "DCA CTO" }]);
  });
});
