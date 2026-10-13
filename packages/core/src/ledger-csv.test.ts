import { describe, expect, it } from "vitest";

import { readStatementText } from "./statement/read";
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

  it("reads back through the app's own import, each way the money went", () => {
    for (const locale of ["fr", "en"] as const) {
      const statement = readStatementText(
        buildLedgerCsv(
          [
            tx(9, "Café", "noir"),
            {
              ...tx(2500, "Salaire", "octobre"),
              categories: {
                ...tx(0, "Salaire", null).categories,
                type: "income",
              },
            },
          ],
          locale,
        ),
      );
      const lines = statement.blocks[0]!.lines;
      expect(lines.map((line) => line.bookingDate)).toEqual([
        "2026-10-01",
        "2026-10-01",
      ]);
      expect(
        lines.map((line) => `${line.creditDebitIndicator} ${line.amount}`),
      ).toEqual(["DBIT 9.00", "CRDT 2500.00"]);
      expect(lines[0]!.remittanceInformation).toBe("noir");
      expect(statement.blocks[0]!.signUnknown).toBe(false);
    }
  });
});
