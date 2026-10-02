import { describe, expect, it } from "vitest";

import { guessColumnMapping, parseCsv } from "./csv-import";
import { buildLedgerCsv, csvTextCell } from "./ledger-csv";
import type { TransactionWithCategory } from "./types/database";

function tx(
  amount: number,
  name: string,
  note: string | null,
): TransactionWithCategory {
  return {
    id: name,
    user_id: "u",
    category_id: "c",
    recurring_template_id: null,
    amount,
    occurred_on: "2026-10-01",
    note,
    created_at: "",
    cash_on: null,
    deleted_at: null,
    categories: {
      name,
      type: "expense",
      icon: null,
      counts_toward_summary: true,
    },
  } as TransactionWithCategory;
}

describe("csvTextCell", () => {
  it("keeps a formula from running when the file is opened", () => {
    expect(csvTextCell('=HYPERLINK("x")', ",")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvTextCell("+33 6 12", ";")).toBe("'+33 6 12");
    expect(csvTextCell("-50", ",")).toBe("'-50");
    expect(csvTextCell("@SUM(A1)", ",")).toBe("'@SUM(A1)");
  });

  it("quotes what would break a line or a column", () => {
    expect(csvTextCell("a;b", ";")).toBe('"a;b"');
    expect(csvTextCell("a;b", ",")).toBe("a;b");
    expect(csvTextCell("line\r\nnext", ",")).toBe('"line\r\nnext"');
    expect(csvTextCell("Boulangerie", ";")).toBe("Boulangerie");
  });
});

describe("buildLedgerCsv", () => {
  it("writes French in the shape French Excel reads", () => {
    const csv = buildLedgerCsv([tx(12.5, "Courses", "pain; lait")], "fr");
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Date;Catégorie;Type;Montant (€);Note");
    expect(row).toBe('2026-10-01;Courses;Dépense;12,5;"pain; lait"');
  });

  it("writes commas and a decimal point otherwise", () => {
    const csv = buildLedgerCsv([tx(12.5, "Groceries", null)], "en");
    expect(csv.split("\r\n")[1]).toBe("2026-10-01,Groceries,Expense,12.5,");
  });

  it("reads back through the app's own import", () => {
    for (const locale of ["fr", "en"] as const) {
      const [headers] = parseCsv(
        buildLedgerCsv([tx(9, "Café", "noir")], locale),
      );
      const mapping = guessColumnMapping(headers!);
      expect(mapping.date).toBe(0);
      expect(mapping.amount).toBe(3);
      expect(mapping.description).toBe(4);
    }
  });
});
