import { describe, expect, it } from "vitest";

import { guessColumnMapping } from "./csv-import";
import {
  decodeStatement,
  findHeaderRow,
  isOfx,
  parseOfx,
  readStatement,
} from "./statement-file";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("decodeStatement", () => {
  it("reads UTF-8, dropping a byte order mark", () => {
    // BOM, "Libellé" in UTF-8.
    expect(
      decodeStatement(
        bytes(0xef, 0xbb, 0xbf, 0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xc3, 0xa9),
      ),
    ).toBe("Libellé");
  });

  it("reads Windows-1252 where the bytes are not UTF-8", () => {
    // "Libellé ; 12 €" with é as 0xE9 and € as 0x80.
    expect(
      decodeStatement(
        bytes(
          0x4c,
          0x69,
          0x62,
          0x65,
          0x6c,
          0x6c,
          0xe9,
          0x3b,
          0x31,
          0x32,
          0x20,
          0x80,
        ),
      ),
    ).toBe("Libellé;12 €");
  });
});

describe("findHeaderRow", () => {
  it("finds the column names below the account's lines", () => {
    const rows = [
      ["Compte courant", "FR76 3000 6000 0112 3456 7890 189"],
      ["Solde au 08/10/2026", "1 234,56"],
      [""],
      ["Date", "Libellé", "Débit euros", "Crédit euros"],
      ["08/10/2026", "CB CARREFOUR", "12,30", ""],
    ];
    expect(findHeaderRow(rows)).toBe(3);
  });

  it("is null without one", () => {
    expect(
      findHeaderRow([["08/10/2026", "CB CARREFOUR", "-12,30"]]),
    ).toBeNull();
  });
});

describe("readStatement", () => {
  it("drops what a bank writes above the header, whatever it does to the delimiter count", () => {
    const text = [
      "Téléchargement du 08/10/2026",
      "Compte courant;FR76 3000 6000 0112 3456 7890 189",
      "Date;Libellé;Débit euros;Crédit euros;",
      "07/10/2026;CB CARREFOUR;12,30;;",
      "05/10/2026;VIR SALAIRE;;2 400,00;",
    ].join("\n");
    const { table, hasHeader, format } = readStatement(text);
    expect(format).toBe("csv");
    expect(hasHeader).toBe(true);
    expect(table[0]).toEqual([
      "Date",
      "Libellé",
      "Débit euros",
      "Crédit euros",
      "",
    ]);
    expect(table).toHaveLength(3);
    expect(guessColumnMapping(table[0]!)).toMatchObject({
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
    });
  });

  it("keeps a plain CSV as it was", () => {
    const text = "Date,Description,Amount\n2026-10-07,Coffee,-3.20\n";
    expect(readStatement(text)).toEqual({
      table: [
        ["Date", "Description", "Amount"],
        ["2026-10-07", "Coffee", "-3.20"],
      ],
      hasHeader: true,
      format: "csv",
    });
  });

  it("reads a file with no header as data", () => {
    const { table, hasHeader } = readStatement(
      "07/10/2026;CB CARREFOUR;-12,30\n",
    );
    expect(hasHeader).toBe(false);
    expect(table).toEqual([["07/10/2026", "CB CARREFOUR", "-12,30"]]);
  });
});

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261007
<TRNAMT>-12,30
<FITID>1
<NAME>CB CARREFOUR
<MEMO>CARTE 1234 07/10
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005120000[+1:CET]
<TRNAMT>2400.00
<FITID>2
<NAME>VIR SALAIRE
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261003</DTPOSTED><TRNAMT>-45.90</TRNAMT><FITID>a</FITID><NAME>PRLV SEPA EDF</NAME><MEMO>PRLV SEPA EDF</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("knows one from a CSV", () => {
    expect(isOfx(OFX_SGML)).toBe(true);
    expect(isOfx(OFX_XML)).toBe(true);
    expect(isOfx("Date;Libellé;Montant\n")).toBe(false);
  });

  it("reads the old SGML form, memo after the name", () => {
    expect(parseOfx(OFX_SGML)).toEqual([
      ["Date", "Libellé", "Montant"],
      ["2026-10-07", "CB CARREFOUR CARTE 1234 07/10", "-12,30"],
      ["2026-10-05", "VIR SALAIRE", "2400.00"],
    ]);
  });

  it("reads the XML form, and a memo that repeats the name once", () => {
    expect(parseOfx(OFX_XML)).toEqual([
      ["Date", "Libellé", "Montant"],
      ["2026-10-03", "PRLV SEPA EDF", "-45.90"],
    ]);
  });

  it("gives a table the mapping recognises on its own", () => {
    const { table, hasHeader, format } = readStatement(OFX_SGML);
    expect(format).toBe("ofx");
    expect(hasHeader).toBe(true);
    expect(guessColumnMapping(table[0]!)).toMatchObject({
      date: 0,
      description: 1,
      amount: 2,
    });
  });
});
