import { describe, expect, it } from "vitest";

import { detectDelimiter, parseCsv, parseCsvAmount } from "./csv-import";

describe("detectDelimiter", () => {
  it("finds a comma", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("finds the semicolon a French export uses", () => {
    expect(detectDelimiter("date;libelle;montant\n01/09/2026;X;-12,50")).toBe(
      ";",
    );
  });

  it("finds a tab", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("prefers the delimiter that splits every line the same way", () => {
    // Commas appear inside the description but semicolons separate fields.
    const text =
      "date;libelle;montant\n01/09/2026;PARIS, FR;-12,50\n02/09/2026;X;-1,00";
    expect(detectDelimiter(text)).toBe(";");
  });

  it("falls back to a comma for a single-column file", () => {
    expect(detectDelimiter("justonecolumn\nvalue")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("splits a simple file", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a delimiter that sits inside quotes", () => {
    expect(parseCsv('a,b\n"PARIS, FR",2')).toEqual([
      ["a", "b"],
      ["PARIS, FR", "2"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([["a"], ['He said "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a newline that sits inside quotes", () => {
    expect(parseCsv('a\n"line one\nline two"')).toEqual([
      ["a"],
      ["line one\nline two"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a byte-order mark from the first header", () => {
    expect(parseCsv("﻿date,amount\n01/09/2026,1")[0]).toEqual([
      "date",
      "amount",
    ]);
  });
});

describe("parseCsvAmount", () => {
  it("reads a plain decimal", () => {
    expect(parseCsvAmount("12.34")).toBe(12.34);
  });

  it("reads a French decimal comma", () => {
    expect(parseCsvAmount("12,34")).toBe(12.34);
  });

  it("reads French grouping with a comma decimal", () => {
    expect(parseCsvAmount("1 234,56")).toBe(1234.56);
  });

  it("reads a narrow no-break space as grouping", () => {
    expect(parseCsvAmount("1 234,56")).toBe(1234.56);
  });

  it("reads English grouping with a dot decimal", () => {
    expect(parseCsvAmount("1,234.56")).toBe(1234.56);
  });

  it("reads German-style grouping", () => {
    expect(parseCsvAmount("1.234,56")).toBe(1234.56);
  });

  it("keeps a negative sign", () => {
    expect(parseCsvAmount("-12,34")).toBe(-12.34);
  });

  it("reads parentheses as negative", () => {
    expect(parseCsvAmount("(12.34)")).toBe(-12.34);
  });

  it("ignores a currency symbol", () => {
    expect(parseCsvAmount("€ 12,34")).toBe(12.34);
    expect(parseCsvAmount("12.34 EUR")).toBe(12.34);
  });

  it("treats a lone three-digit group as thousands", () => {
    expect(parseCsvAmount("1.234")).toBe(1234);
    expect(parseCsvAmount("1,234")).toBe(1234);
  });

  it("treats repeated three-digit groups as thousands", () => {
    expect(parseCsvAmount("1,234,567")).toBe(1234567);
  });

  it("returns null for an empty or non-numeric cell", () => {
    expect(parseCsvAmount("")).toBeNull();
    expect(parseCsvAmount("   ")).toBeNull();
    expect(parseCsvAmount("n/a")).toBeNull();
  });
});
