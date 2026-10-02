import { describe, expect, it } from "vitest";
import {
  aMonthAfter,
  defaultPropertyName,
  errorsByField,
  fieldText,
  monthsFromYears,
} from "./property-form";

describe("errorsByField", () => {
  it("keeps the first message for each field", () => {
    expect(
      errorsByField([
        { path: ["livingArea"], message: "errors.areaRequired" },
        { path: ["livingArea"], message: "errors.positiveNumber" },
        { path: ["name"], message: "errors.nameRequired" },
      ]),
    ).toEqual({
      livingArea: "errors.areaRequired",
      name: "errors.nameRequired",
    });
  });
});

describe("fieldText", () => {
  it("writes a figure the way the reader types one, ungrouped", () => {
    expect(fieldText(52.5, "fr")).toBe("52,5");
    expect(fieldText(420_000, "fr")).toBe("420000");
    expect(fieldText(3.125, "en", 3)).toBe("3.125");
  });
});

describe("monthsFromYears", () => {
  it("reads years in either language's decimal", () => {
    expect(monthsFromYears("20")).toBe(240);
    expect(monthsFromYears("20,5")).toBe(246);
    expect(monthsFromYears("12.5")).toBe(150);
    expect(monthsFromYears(" ")).toBe("");
    expect(monthsFromYears("vingt")).toBe("");
  });
});

describe("aMonthAfter", () => {
  it("is the same day a month on, or the month's last", () => {
    expect(aMonthAfter("2026-10-02")).toBe("2026-11-02");
    expect(aMonthAfter("2026-01-31")).toBe("2026-02-28");
    expect(aMonthAfter("2026-12-15")).toBe("2027-01-15");
  });
});

describe("defaultPropertyName", () => {
  it("says the kind and the place, the arrondissement the short way", () => {
    expect(
      defaultPropertyName("Appartement", {
        city: "Paris",
        district: "Paris 11e Arrondissement",
      }),
    ).toBe("Appartement Paris 11e");
    expect(
      defaultPropertyName("Maison", { city: "Gordes", district: null }),
    ).toBe("Maison Gordes");
    expect(defaultPropertyName("Maison", null)).toBe("Maison");
  });
});
