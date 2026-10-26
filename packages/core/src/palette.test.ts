import { describe, expect, it } from "vitest";
import { buildPaletteItems, parseMonthQuery } from "./palette";

const source = {
  pages: [
    { href: "/bearing", label: "Le point" },
    { href: "/transactions", label: "Journal" },
    { href: "/merchants", label: "Par commerce" },
  ],
  categories: [
    { id: "c1", name: "Courses" },
    { id: "c2", name: "Café" },
  ],
  shops: [
    { key: "carrefour market", label: "Carrefour Market" },
    { key: "cafe joyeux", label: "Café Joyeux" },
  ],
  charges: [{ id: "r1", name: "Loyer" }],
};
const at = { today: "2026-10-26", locale: "fr" as const };

describe("parseMonthQuery", () => {
  it("reads a month in either language, with or without a year", () => {
    expect(parseMonthQuery("octobre", "2026-10-26")).toEqual({ year: 2026, month: 10 });
    expect(parseMonthQuery("Oct 2025", "2026-10-26")).toEqual({ year: 2025, month: 10 });
    expect(parseMonthQuery("sept", "2026-10-26")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthQuery("december", "2026-10-26")).toEqual({ year: 2025, month: 12 });
    expect(parseMonthQuery("2025-03", "2026-10-26")).toEqual({ year: 2025, month: 3 });
    expect(parseMonthQuery("03/2025", "2026-10-26")).toEqual({ year: 2025, month: 3 });
  });

  it("answers nothing for words that are no month", () => {
    expect(parseMonthQuery("carrefour", "2026-10-26")).toBeNull();
    expect(parseMonthQuery("ma", "2026-10-26")).toBeNull();
    expect(parseMonthQuery("13/2025", "2026-10-26")).toBeNull();
    expect(parseMonthQuery("", "2026-10-26")).toBeNull();
  });
});

describe("buildPaletteItems", () => {
  it("offers the add, a question and every page when nothing is typed", () => {
    const items = buildPaletteItems("", source, at);
    expect(items.map((item) => item.kind)).toEqual([
      "add",
      "addCharge",
      "ask",
      "page",
      "page",
      "page",
    ]);
  });

  it("turns an amount into an add with it", () => {
    const [first] = buildPaletteItems("12,30", source, at);
    expect(first).toEqual({ kind: "add", amount: 12.3 });
    expect(buildPaletteItems("loyer 12", source, at)[0]?.kind).not.toBe("add");
  });

  it("opens a month in the Journal and on Le point", () => {
    const items = buildPaletteItems("sept", source, at);
    expect(items.slice(0, 2)).toEqual([
      { kind: "month", year: 2026, month: 9, target: "ledger" },
      { kind: "month", year: 2026, month: 9, target: "bearing" },
    ]);
  });

  it("finds pages, categories, shops and charges by their words, without accents", () => {
    const items = buildPaletteItems("cafe", source, at);
    expect(items).toEqual([
      { kind: "category", id: "c2", name: "Café" },
      { kind: "shop", key: "cafe joyeux", label: "Café Joyeux" },
    ]);
    expect(buildPaletteItems("loy", source, at)).toEqual([
      { kind: "charge", id: "r1", name: "Loyer" },
    ]);
    expect(buildPaletteItems("commerce", source, at)[0]).toMatchObject({
      kind: "page",
      href: "/merchants",
    });
  });
});
