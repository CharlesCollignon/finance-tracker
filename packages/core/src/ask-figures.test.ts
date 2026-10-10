import { describe, expect, it } from "vitest";

import {
  figureKey,
  figureMatches,
  figuresIn,
  numbersIn,
  readNumber,
  untracedFigures,
  valuesIn,
} from "./ask-figures";

describe("readNumber", () => {
  it("reads French and English writing alike", () => {
    expect(readNumber("1 234,56", "fr")).toEqual({
      value: 1234.56,
      step: 0.01,
    });
    expect(readNumber("1 234,5", "fr")).toEqual({ value: 1234.5, step: 0.1 });
    expect(readNumber("1,234.56", "en")).toEqual({
      value: 1234.56,
      step: 0.01,
    });
    expect(readNumber("12,5", "fr")).toEqual({ value: 12.5, step: 0.1 });
    expect(readNumber("12.5", "en")).toEqual({ value: 12.5, step: 0.1 });
  });

  it("lets the language settle a lone mark before three digits", () => {
    expect(readNumber("1.234", "fr")?.value).toBe(1234);
    expect(readNumber("1,234", "en")?.value).toBe(1234);
    expect(readNumber("1,234", "fr")?.value).toBe(1.234);
    expect(readNumber("1.234", "en")?.value).toBe(1.234);
  });

  it("reads the same mark repeated as thousands", () => {
    expect(readNumber("1.234.567", "fr")?.value).toBe(1234567);
    expect(readNumber("1,234,567", "en")?.value).toBe(1234567);
  });

  it("takes trailing zeros as rounding", () => {
    expect(readNumber("1 200", "fr")?.step).toBe(100);
    expect(readNumber("3000", "fr")?.step).toBe(1000);
    expect(readNumber("1 234", "fr")?.step).toBe(1);
    expect(readNumber("40", "fr")?.step).toBe(1);
  });
});

describe("figuresIn", () => {
  it("finds amounts with the currency on either side, and percentages", () => {
    const figures = figuresIn(
      "Vous avez dépensé 1 234,56 € en mars, soit 12,5 % de plus, et $40 ailleurs.",
      "fr",
    );
    expect(
      figures.map((figure) => [figure.text, figure.value, figure.unit]),
    ).toEqual([
      ["1 234,56 €", 1234.56, "money"],
      ["12,5 %", 12.5, "percent"],
      ["$40", 40, "money"],
    ]);
  });

  it("reads a scale and a sign", () => {
    const figures = figuresIn(
      "Un écart de −1,2 k€ et de 3 M€, puis -45 EUR.",
      "fr",
    );
    expect(figures.map((figure) => figure.value)).toEqual([-1200, 3e6, -45]);
    expect(figures[0]!.step).toBe(100);
  });

  it("reads words for the currency", () => {
    expect(figuresIn("about 300 euros", "en")[0]?.value).toBe(300);
    expect(figuresIn("12 dollars", "en")[0]?.value).toBe(12);
  });

  it("leaves bare numbers, years and counts alone", () => {
    expect(figuresIn("En 2026, sur 12 mois, 3 fois.", "fr")).toEqual([]);
  });
});

describe("figureMatches", () => {
  it("matches a figure written to the cent or the unit", () => {
    expect(figureMatches({ value: 1234.56, step: 0.01 }, [1234.56])).toBe(true);
    expect(figureMatches({ value: 1234, step: 1 }, [1234.56])).toBe(true);
    expect(figureMatches({ value: 1235, step: 1 }, [1234.56])).toBe(true);
    expect(figureMatches({ value: 1234.57, step: 0.01 }, [1234.55])).toBe(
      false,
    );
  });

  it("matches a round figure only when it rounds to the value", () => {
    expect(figureMatches({ value: 1200, step: 100 }, [1234.56])).toBe(true);
    expect(figureMatches({ value: 1200, step: 100 }, [1260])).toBe(false);
    expect(figureMatches({ value: 100, step: 100 }, [140])).toBe(false);
    expect(figureMatches({ value: 100, step: 100 }, [103])).toBe(true);
  });

  it("ignores the sign", () => {
    expect(figureMatches({ value: 450, step: 1 }, [-450])).toBe(true);
  });
});

describe("untracedFigures", () => {
  it("lists the figures found in nothing the app handed over", () => {
    const values = valuesIn({
      months: [{ spent: 1234.56 }, { spent: 980 }],
      rate: 3.5,
    });
    expect(
      untracedFigures(
        "Mars : 1 234,56 €, avril : 980 €, au taux de 3,5 %, soit 2 500 € en tout.",
        values,
        "fr",
      ),
    ).toEqual(["2 500 €"]);
  });

  it("counts what the person wrote as given", () => {
    const values = numbersIn("Et si je mets 200 € de plus par mois ?", "fr");
    expect(untracedFigures("Avec 200 € de plus…", values, "fr")).toEqual([]);
  });

  it("lists each figure once, its spaces made one kind", () => {
    expect(untracedFigures("9 999 € puis 9 999 €", [], "fr")).toEqual([
      "9 999 €",
    ]);
    expect(figureKey("1 234 €")).toBe("1 234 €");
  });
});

describe("valuesIn", () => {
  it("collects every finite number, however deep", () => {
    expect(
      valuesIn({ a: 1, b: [2, { c: 3 }], d: "4", e: null, f: Number.NaN }),
    ).toEqual([1, 2, 3]);
  });
});
