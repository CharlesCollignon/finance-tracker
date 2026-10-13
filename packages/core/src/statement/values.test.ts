import { describe, expect, it } from "vitest";

import { withLineIds } from "./line-ids";
import { makeLine } from "./table";
import {
  dateOrderOf,
  excelSerialDate,
  strictAmount,
  strictDate,
} from "./values";

describe("strictAmount", () => {
  it("reads the amounts banks write", () => {
    expect(strictAmount("-1 234,56 €")).toBe(-1234.56);
    expect(strictAmount("1 234,56")).toBe(1234.56);
    expect(strictAmount("1.234,56")).toBe(1234.56);
    expect(strictAmount("-12.50")).toBe(-12.5);
    expect(strictAmount("(12,50)")).toBe(-12.5);
    expect(strictAmount("12,50-")).toBe(-12.5);
    expect(strictAmount("+45")).toBe(45);
    expect(strictAmount("EUR 9.99")).toBe(9.99);
  });

  it("is not fooled by words with digits", () => {
    expect(strictAmount("CARTE X1234")).toBeNull();
    expect(strictAmount("12/10")).toBeNull();
    expect(strictAmount("PRLV SEPA 123")).toBeNull();
    expect(strictAmount("")).toBeNull();
  });
});

describe("strictDate", () => {
  it("reads every way a date is written", () => {
    expect(strictDate("12/10/2026")).toBe("2026-10-12");
    expect(strictDate("12-10-26")).toBe("2026-10-12");
    expect(strictDate("2026-10-12")).toBe("2026-10-12");
    expect(strictDate("2026-10-12 10:23:45")).toBe("2026-10-12");
    expect(strictDate("2026-10-12T10:23:45Z")).toBe("2026-10-12");
    expect(strictDate("20261012")).toBe("2026-10-12");
    expect(strictDate("12 oct. 2026")).toBe("2026-10-12");
    expect(strictDate("1er octobre 2026")).toBe("2026-10-01");
    expect(strictDate("lundi 12 octobre 2026")).toBe("2026-10-12");
    expect(strictDate("12 août 2026")).toBe("2026-08-12");
    expect(strictDate("Oct 12, 2026")).toBe("2026-10-12");
  });

  it("is only a date when the cell is only a date", () => {
    expect(strictDate("12/10 CB MONOP")).toBeNull();
    expect(strictDate("31/02/2026")).toBeNull();
    expect(strictDate("12/10")).toBeNull();
  });

  it("follows the column's order", () => {
    expect(strictDate("05/06/2026")).toBe("2026-06-05");
    expect(strictDate("05/06/2026", "mdy")).toBe("2026-05-06");
    expect(dateOrderOf(["10/25/2026", "05/06/2026"])).toBe("mdy");
    expect(dateOrderOf(["25/10/2026", "05/06/2026"])).toBe("dmy");
    expect(dateOrderOf(["05/06/2026"])).toBe("dmy");
  });

  it("turns a spreadsheet's day number into a date", () => {
    expect(excelSerialDate(46307)).toBe("2026-10-12");
    expect(excelSerialDate(12)).toBeNull();
  });
});

describe("line ids", () => {
  const coffee = (date: string, label = "CB CAFE DE LA GARE") =>
    makeLine({ date, amount: -2.4, label, currency: "EUR" })!;

  it("keeps two real coffees two, and the same download the same", () => {
    const first = withLineIds([coffee("2026-10-12"), coffee("2026-10-12")]);
    expect(first[0]!.id).not.toBe(first[1]!.id);
    const again = withLineIds([coffee("2026-10-12"), coffee("2026-10-12")]);
    expect(again.map((line) => line.id)).toEqual(first.map((line) => line.id));
  });

  it("gives an overlapping export's shared days the same ids", () => {
    const september = withLineIds([coffee("2026-09-30"), coffee("2026-10-01")]);
    const october = withLineIds([coffee("2026-10-01"), coffee("2026-10-02")]);
    expect(october[0]!.id).toBe(september[1]!.id);
    expect(october[1]!.id).not.toBe(september[0]!.id);
  });

  it("tells apart what differs in sign, amount, day or words", () => {
    const [a, b, c, d] = withLineIds([
      coffee("2026-10-12"),
      makeLine({
        date: "2026-10-12",
        amount: 2.4,
        label: "CB CAFE DE LA GARE",
        currency: "EUR",
      })!,
      coffee("2026-10-13"),
      coffee("2026-10-12", "CB CAFE DU PORT"),
    ]);
    expect(new Set([a!.id, b!.id, c!.id, d!.id]).size).toBe(4);
  });

  it("reads the same words alike, whatever their spacing and accents", () => {
    const [plain] = withLineIds([coffee("2026-10-12", "CB  Café de la gare")]);
    const [shouted] = withLineIds([coffee("2026-10-12", "CB CAFE DE LA GARE")]);
    expect(plain!.id).toBe(shouted!.id);
  });
});
