import { describe, expect, it } from "vitest";

import {
  buildImportRows,
  detectDelimiter,
  guessColumnMapping,
  looksLikeHeaderRow,
  parseCsv,
  parseCsvAmount,
  parseCsvDate,
  summarizeImportRows,
  type ColumnMapping,
} from "./csv-import";

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
    const text = "date;libelle;montant\n01/09/2026;PARIS, FR;-12,50\n02/09/2026;X;-1,00";
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

describe("parseCsvDate", () => {
  it("reads an ISO date", () => {
    expect(parseCsvDate("2026-09-01")).toBe("2026-09-01");
  });

  it("reads a day-first slash date", () => {
    expect(parseCsvDate("01/09/2026")).toBe("2026-09-01");
  });

  it("reads a day-first dotted date", () => {
    expect(parseCsvDate("01.09.2026")).toBe("2026-09-01");
  });

  it("reads a two-digit year", () => {
    expect(parseCsvDate("01/09/26")).toBe("2026-09-01");
  });

  it("prefers day-first when both readings are possible", () => {
    // 03/09 is 3 September in every European export.
    expect(parseCsvDate("03/09/2026")).toBe("2026-09-03");
  });

  it("falls back to month-first when day-first is impossible", () => {
    expect(parseCsvDate("09/25/2026")).toBe("2026-09-25");
  });

  it("rejects a date that does not exist", () => {
    expect(parseCsvDate("31/02/2026")).toBeNull();
  });

  it("returns null for junk", () => {
    expect(parseCsvDate("")).toBeNull();
    expect(parseCsvDate("Date")).toBeNull();
  });
});

describe("guessColumnMapping", () => {
  it("maps an English header row", () => {
    const mapping = guessColumnMapping(["Date", "Description", "Amount"]);
    expect(mapping).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("maps a French header row", () => {
    const mapping = guessColumnMapping([
      "Date operation",
      "Libelle",
      "Montant",
    ]);
    expect(mapping).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("maps accented French headers", () => {
    const mapping = guessColumnMapping(["Date", "Libellé", "Montant (€)"]);
    expect(mapping).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("maps split debit and credit columns", () => {
    const mapping = guessColumnMapping(["Date", "Libelle", "Debit", "Credit"]);
    expect(mapping.amount).toBeNull();
    expect(mapping).toMatchObject({ debit: 2, credit: 3 });
  });

  it("prefers a single amount column over split ones", () => {
    const mapping = guessColumnMapping([
      "Date",
      "Label",
      "Debit",
      "Credit",
      "Amount",
    ]);
    expect(mapping.amount).toBe(4);
    expect(mapping.debit).toBeNull();
    expect(mapping.credit).toBeNull();
  });

  it("falls back to the first two columns when nothing is recognised", () => {
    const mapping = guessColumnMapping(["col1", "col2", "col3"]);
    expect(mapping).toMatchObject({ date: 0, description: 1, amount: null });
  });
});

describe("looksLikeHeaderRow", () => {
  it("recognises labels", () => {
    expect(looksLikeHeaderRow(["Date", "Libelle", "Montant"])).toBe(true);
  });

  it("recognises a data row", () => {
    expect(looksLikeHeaderRow(["01/09/2026", "Franprix", "-12,50"])).toBe(false);
  });

  it("recognises a data row with no readable date", () => {
    expect(looksLikeHeaderRow(["x", "Franprix", "-12,50"])).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */

const MAPPING: ColumnMapping = {
  date: 0,
  description: 1,
  amount: 2,
  debit: null,
  credit: null,
};

describe("buildImportRows", () => {
  it("reads an expense as a positive amount with an expense type", () => {
    const [row] = buildImportRows(
      [["01/09/2026", "Franprix", "-12,50"]],
      { mapping: MAPPING },
    );

    expect(row).toMatchObject({
      occurredOn: "2026-09-01",
      description: "Franprix",
      amount: 12.5,
      type: "expense",
      status: "ready",
    });
  });

  it("reads a credit as income", () => {
    const [row] = buildImportRows([["01/09/2026", "Salaire", "2400,00"]], {
      mapping: MAPPING,
    });

    expect(row).toMatchObject({ type: "income", amount: 2400 });
  });

  it("honours a positive-is-expense export", () => {
    const [row] = buildImportRows([["01/09/2026", "Franprix", "12,50"]], {
      mapping: MAPPING,
      expenseSign: "positive",
    });

    expect(row.type).toBe("expense");
  });

  it("reads split debit and credit columns", () => {
    const rows = buildImportRows(
      [
        ["01/09/2026", "Franprix", "12,50", ""],
        ["02/09/2026", "Salaire", "", "2400,00"],
      ],
      {
        mapping: { date: 0, description: 1, amount: null, debit: 2, credit: 3 },
      },
    );

    expect(rows[0]).toMatchObject({ type: "expense", amount: 12.5 });
    expect(rows[1]).toMatchObject({ type: "income", amount: 2400 });
  });

  it("flags a row with no readable date", () => {
    const [row] = buildImportRows([["", "Franprix", "-12,50"]], {
      mapping: MAPPING,
    });

    expect(row).toMatchObject({ status: "invalid", problem: "No readable date" });
  });

  it("flags a row with no readable amount", () => {
    const [row] = buildImportRows([["01/09/2026", "Franprix", ""]], {
      mapping: MAPPING,
    });

    expect(row).toMatchObject({
      status: "invalid",
      problem: "No readable amount",
    });
  });

  it("reports the source line so the user can find the bad row", () => {
    const rows = buildImportRows(
      [
        ["01/09/2026", "A", "-1,00"],
        ["nope", "B", "-2,00"],
      ],
      { mapping: MAPPING },
    );

    expect(rows[1].line).toBe(2);
  });

  it("marks a row already in the ledger as a duplicate", () => {
    const [row] = buildImportRows([["01/09/2026", "Franprix", "-12,50"]], {
      mapping: MAPPING,
      existing: [
        { occurredOn: "2026-09-01", amount: 12.5, note: "CB FRANPRIX 01/09" },
      ],
    });

    expect(row.status).toBe("duplicate");
  });

  it("marks the second of two identical lines in the same file", () => {
    const rows = buildImportRows(
      [
        ["01/09/2026", "Franprix", "-12,50"],
        ["01/09/2026", "Franprix", "-12,50"],
      ],
      { mapping: MAPPING },
    );

    expect(rows[0].status).toBe("ready");
    expect(rows[1].status).toBe("duplicate");
  });

  it("keeps two same-day lines with different amounts", () => {
    const rows = buildImportRows(
      [
        ["01/09/2026", "Franprix", "-12,50"],
        ["01/09/2026", "Franprix", "-4,00"],
      ],
      { mapping: MAPPING },
    );

    expect(rows.every((row) => row.status === "ready")).toBe(true);
  });

  it("applies a guessed category", () => {
    const [row] = buildImportRows([["01/09/2026", "Franprix", "-12,50"]], {
      mapping: MAPPING,
      guessCategory: () => ({
        categoryId: "cat-1",
        categoryName: "Groceries",
        categoryType: "expense",
      }),
    });

    expect(row).toMatchObject({
      categoryId: "cat-1",
      categoryName: "Groceries",
    });
  });

  it("refuses a guessed category that disagrees on direction", () => {
    const [row] = buildImportRows([["01/09/2026", "Refund", "40,00"]], {
      mapping: MAPPING,
      guessCategory: () => ({
        categoryId: "cat-1",
        categoryName: "Groceries",
        categoryType: "expense",
      }),
    });

    expect(row.type).toBe("income");
    expect(row.categoryId).toBeNull();
  });

  it("survives a row with fewer cells than the mapping expects", () => {
    const [row] = buildImportRows([["01/09/2026"]], { mapping: MAPPING });
    expect(row.status).toBe("invalid");
  });
});

describe("summarizeImportRows", () => {
  it("counts each outcome", () => {
    const rows = buildImportRows(
      [
        ["01/09/2026", "Franprix", "-12,50"],
        ["01/09/2026", "Franprix", "-12,50"],
        ["bad", "X", "-1,00"],
      ],
      { mapping: MAPPING },
    );

    expect(summarizeImportRows(rows)).toEqual({
      ready: 1,
      duplicate: 1,
      invalid: 1,
      needsCategory: 1,
      total: 3,
    });
  });

  it("does not count a categorised row as needing one", () => {
    const rows = buildImportRows([["01/09/2026", "Franprix", "-12,50"]], {
      mapping: MAPPING,
      guessCategory: () => ({
        categoryId: "cat-1",
        categoryName: "Groceries",
        categoryType: "expense",
      }),
    });

    expect(summarizeImportRows(rows).needsCategory).toBe(0);
  });
});
