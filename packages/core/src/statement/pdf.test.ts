import { describe, expect, it } from "vitest";
import { readPdfPages, type PdfPage, type PdfText } from "./pdf";

/**
 * Statements laid out as banks lay theirs: each row a list of cells at a
 * place on the page — `[x, text]` from the left, or `[x, text, "right"]`
 * ending at x, as amounts are set. Widths are Helvetica's, near enough.
 */
type Placed = [number, string] | [number, string, "right"];

function page(rows: Placed[][], { top = 80, step = 14, size = 9 } = {}): PdfPage {
  const texts: PdfText[] = [];
  rows.forEach((row, index) => {
    for (const [x, text, align] of row) {
      const width = text.length * size * 0.5;
      texts.push({
        x: align === "right" ? x - width : x,
        y: top + index * step,
        width,
        height: size,
        text,
      });
    }
  });
  return { texts };
}

const TODAY = "2026-10-13";

describe("readPdfPages", () => {
  it("reads a BoursoBank-like statement, columns and balances", () => {
    const statement = readPdfPages(
      [
        page([
          [[40, "BoursoBank"]],
          [[40, "Relevé de compte du 01/09/2026 au 30/09/2026"]],
          [[40, "IBAN : FR76 4061 8802 0000 0000 0000 123"]],
          [],
          [
            [40, "Date opération"],
            [120, "Libellé"],
            [330, "Valeur"],
            [430, "Débit", "right"],
            [520, "Crédit", "right"],
          ],
          [[40, "SOLDE AU : 31/08/2026"], [520, "1 000,00", "right"]],
          [
            [40, "02/09/2026"],
            [120, "CARTE 01/09/26 MONOPRIX PARIS"],
            [330, "02/09/2026"],
            [430, "12,30", "right"],
          ],
          [
            [40, "05/09/2026"],
            [120, "VIR SEPA RECU / DE: ACME SAS"],
            [330, "05/09/2026"],
            [520, "2 500,00", "right"],
          ],
          [[120, "MOTIF: SALAIRE SEPTEMBRE"]],
          [
            [40, "10/09/2026"],
            [120, "PRLV SEPA EDF"],
            [330, "11/09/2026"],
            [430, "85,40", "right"],
          ],
          [[40, "Nouveau solde en EUR :"], [520, "3 402,30", "right"]],
        ]),
      ],
      { today: TODAY },
    );

    expect(statement.problem).toBeNull();
    expect(statement.format).toBe("pdf");
    expect(statement.bank).toBe("boursobank");
    expect(statement.blocks).toHaveLength(1);
    const block = statement.blocks[0]!;
    expect(block.account?.iban).toBe("FR7640618802000000000000123");
    expect(block.from).toBe("2026-09-01");
    expect(block.to).toBe("2026-09-30");
    expect(
      block.lines.map((line) => [
        line.bookingDate,
        line.creditDebitIndicator,
        line.amount,
        line.remittanceInformation,
      ]),
    ).toEqual([
      ["2026-09-02", "DBIT", "12.30", "CARTE 01/09/26 MONOPRIX PARIS"],
      [
        "2026-09-05",
        "CRDT",
        "2500.00",
        "VIR SEPA RECU / DE: ACME SAS MOTIF: SALAIRE SEPTEMBRE",
      ],
      ["2026-09-10", "DBIT", "85.40", "PRLV SEPA EDF"],
    ]);
    expect(block.lines[2]!.valueDate).toBe("2026-09-11");
    expect(block.check).toEqual({ ok: true, gap: "0.00" });
    expect(block.opening).toEqual({ date: "2026-08-31", amount: "1000.00" });
    expect(block.closing?.amount).toBe("3402.30");
    expect(block.signUnknown).toBe(false);
  });

  it("reads a header over two rows, days without their year, and the totals", () => {
    const statement = readPdfPages(
      [
        page([
          [[40, "Crédit Agricole"]],
          [[40, "Relevé de vos comptes du 01.09.2026 au 30.09.2026"]],
          [
            [40, "Date"],
            [90, "Date"],
            [140, "Nature des"],
          ],
          [
            [40, "opé."],
            [90, "valeur"],
            [140, "opérations"],
            [430, "Débit", "right"],
            [520, "Crédit", "right"],
          ],
          [
            [40, "Ancien solde créditeur au 31.08.2026"],
            [520, "1 000,00", "right"],
          ],
          [
            [40, "02.09"],
            [90, "02.09"],
            [140, "CARTE X1234 01/09 MONOPRIX"],
            [430, "12,30", "right"],
          ],
          [
            [40, "05.09"],
            [90, "05.09"],
            [140, "VIREMENT EN VOTRE FAVEUR"],
            [520, "2 500,00", "right"],
          ],
          [[140, "ACME SAS SALAIRE"]],
          [
            [40, "28.09"],
            [90, "28.09"],
            [140, "PRELEVEMENT EDF"],
            [430, "100,00", "right"],
          ],
          [
            [40, "Total des opérations"],
            [430, "112,30", "right"],
            [520, "2 500,00", "right"],
          ],
          [
            [40, "Nouveau solde créditeur au 30.09.2026"],
            [520, "3 387,70", "right"],
          ],
        ]),
      ],
      { today: TODAY },
    );

    expect(statement.bank).toBe("credit-agricole");
    const block = statement.blocks[0]!;
    expect(block.lines.map((line) => line.bookingDate)).toEqual([
      "2026-09-02",
      "2026-09-05",
      "2026-09-28",
    ]);
    expect(block.lines[1]!.remittanceInformation).toBe(
      "VIREMENT EN VOTRE FAVEUR ACME SAS SALAIRE",
    );
    expect(block.check?.ok).toBe(true);
    expect(block.closing).toEqual({ date: "2026-09-30", amount: "3387.70" });
  });

  it("reads a statement over two pages, its header again on each", () => {
    const header: Placed[] = [
      [40, "Date"],
      [90, "Nature des opérations"],
      [330, "Valeur"],
      [430, "Débit", "right"],
      [520, "Crédit", "right"],
    ];
    const statement = readPdfPages(
      [
        page([
          [[40, "BNP PARIBAS"]],
          [[40, "RELEVE DE COMPTE CHEQUES du 1er septembre 2026 au 30 septembre 2026"]],
          header,
          [[40, "SOLDE CREDITEUR AU 31.08.2026"], [520, "500,00", "right"]],
          [
            [40, "03.09"],
            [90, "FACTURE CARTE DU 020926 BOULANGERIE"],
            [330, "03.09"],
            [430, "4,20", "right"],
          ],
          [
            [40, "15.09"],
            [90, "VIR SEPA RECU /DE CAF"],
            [330, "15.09"],
            [520, "180,00", "right"],
          ],
          [[40, "TOTAL A REPORTER"], [430, "4,20", "right"], [520, "180,00", "right"]],
          [[250, "Page 1 / 2"]],
        ]),
        page([
          header,
          [[40, "REPORT"], [430, "4,20", "right"], [520, "180,00", "right"]],
          [
            [40, "29.09"],
            [90, "PRLV SEPA FREE MOBILE"],
            [330, "29.09"],
            [430, "19,99", "right"],
          ],
          [
            [40, "TOTAL DES OPERATIONS"],
            [430, "24,19", "right"],
            [520, "180,00", "right"],
          ],
          [[40, "SOLDE CREDITEUR AU 30.09.2026"], [520, "655,81", "right"]],
          [[250, "Page 2 / 2"]],
        ]),
      ],
      { today: TODAY },
    );

    expect(statement.bank).toBe("bnp-paribas");
    const block = statement.blocks[0]!;
    expect(block.from).toBe("2026-09-01");
    expect(block.lines).toHaveLength(3);
    expect(block.lines[0]!.valueDate).toBe("2026-09-03");
    expect(block.lines[2]!.remittanceInformation).toBe("PRLV SEPA FREE MOBILE");
    expect(block.check).toEqual({ ok: true, gap: "0.00" });
    expect(statement.skipped).toBe(0);
  });

  it("reads a balance column, money out and in under their own names", () => {
    const statement = readPdfPages(
      [
        page([
          [[40, "Revolut Bank UAB"]],
          [
            [40, "Date"],
            [120, "Description"],
            [400, "Argent sortant", "right"],
            [470, "Argent entrant", "right"],
            [540, "Solde", "right"],
          ],
          [
            [40, "2 sept. 2026"],
            [120, "Monoprix"],
            [400, "12,30 €", "right"],
            [540, "987,70 €", "right"],
          ],
          [
            [40, "4 sept. 2026"],
            [120, "Virement de Jean"],
            [470, "50,00 €", "right"],
            [540, "1 037,70 €", "right"],
          ],
        ]),
      ],
      { today: TODAY },
    );

    expect(statement.bank).toBe("revolut");
    const lines = statement.blocks[0]!.lines;
    expect(lines.map((line) => [line.bookingDate, line.creditDebitIndicator, line.amount])).toEqual([
      ["2026-09-02", "DBIT", "12.30"],
      ["2026-09-04", "CRDT", "50.00"],
    ]);
    expect(lines[1]!.balanceAfterTransaction).toBe("1037.70");
  });

  it("reads an overdrawn account's balance as below zero", () => {
    const statement = readPdfPages(
      [
        page([
          [
            [40, "Date"],
            [120, "Libellé"],
            [430, "Débit", "right"],
            [520, "Crédit", "right"],
          ],
          [[40, "SOLDE DEBITEUR AU 31/08/2026"], [430, "50,00", "right"]],
          [[40, "03/09/2026"], [120, "VIREMENT RECU"], [520, "100,00", "right"]],
          [[40, "SOLDE CREDITEUR AU 30/09/2026"], [520, "50,00", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    const block = statement.blocks[0]!;
    expect(block.opening?.amount).toBe("-50.00");
    expect(block.check?.ok).toBe(true);
  });

  it("says when the lines do not meet the balances, and keeps neither", () => {
    const statement = readPdfPages(
      [
        page([
          [
            [40, "Date"],
            [120, "Libellé"],
            [430, "Débit", "right"],
            [520, "Crédit", "right"],
          ],
          [[40, "Solde au 31/08/2026"], [520, "1 000,00", "right"]],
          [[40, "03/09/2026"], [120, "CARTE MONOPRIX"], [430, "12,30", "right"]],
          [[40, "Solde au 30/09/2026"], [520, "950,00", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    const block = statement.blocks[0]!;
    expect(block.check).toEqual({ ok: false, gap: "-37.70" });
    expect(block.opening).toBeNull();
    expect(block.closing).toBeNull();
  });

  it("gives a December day on a January statement last year's year", () => {
    const statement = readPdfPages(
      [
        page([
          [[40, "Relevé du 15/12/2025 au 14/01/2026"]],
          [
            [40, "Date"],
            [120, "Libellé"],
            [430, "Débit", "right"],
            [520, "Crédit", "right"],
          ],
          [[40, "20/12"], [120, "CADEAUX"], [430, "60,00", "right"]],
          [[40, "05/01"], [120, "SALAIRE"], [520, "2 000,00", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    expect(statement.blocks[0]!.lines.map((line) => line.bookingDate)).toEqual([
      "2025-12-20",
      "2026-01-05",
    ]);
  });

  it("reads a single amount column by its signs", () => {
    const statement = readPdfPages(
      [
        page([
          [
            [40, "Date"],
            [120, "Opération"],
            [520, "Montant", "right"],
          ],
          [[40, "02/09/2026"], [120, "MONOPRIX"], [520, "-12,30", "right"]],
          [[40, "05/09/2026"], [120, "SALAIRE"], [520, "+2 500,00", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    const block = statement.blocks[0]!;
    expect(block.signUnknown).toBe(false);
    expect(block.lines.map((line) => line.creditDebitIndicator)).toEqual([
      "DBIT",
      "CRDT",
    ]);
  });

  it("asks which way when a single amount column carries no sign", () => {
    const statement = readPdfPages(
      [
        page([
          [
            [40, "Date"],
            [120, "Opération"],
            [520, "Montant", "right"],
          ],
          [[40, "02/09/2026"], [120, "MONOPRIX"], [520, "12,30", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    expect(statement.blocks[0]!.signUnknown).toBe(true);
  });

  it("takes a last salary's « solde de tout compte » for a line", () => {
    const statement = readPdfPages(
      [
        page([
          [
            [40, "Date"],
            [120, "Libellé"],
            [430, "Débit", "right"],
            [520, "Crédit", "right"],
          ],
          [
            [40, "15/09/2026"],
            [120, "VIR SEPA SOLDE DE TOUT COMPTE ACME"],
            [520, "1 234,56", "right"],
          ],
        ]),
      ],
      { today: TODAY },
    );
    expect(statement.blocks[0]!.lines).toHaveLength(1);
  });

  it("parts the lines of two accounts", () => {
    const header: Placed[] = [
      [40, "Date"],
      [120, "Libellé"],
      [430, "Débit", "right"],
      [520, "Crédit", "right"],
    ];
    const statement = readPdfPages(
      [
        page([
          [[40, "Compte chèque n° 12345678901"]],
          header,
          [[40, "02/09/2026"], [120, "MONOPRIX"], [430, "12,30", "right"]],
          [],
          [[40, "Compte Livret A n° 98765432100"]],
          header,
          [[40, "30/09/2026"], [120, "INTERETS"], [520, "3,10", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    expect(
      statement.blocks.map((block) => [block.account?.number, block.lines.length]),
    ).toEqual([
      ["12345678901", 1],
      ["98765432100", 1],
    ]);
  });

  it("reads rows with no named columns: a date first, a signed amount last", () => {
    const statement = readPdfPages(
      [
        page([
          [[40, "Vos opérations"]],
          [[40, "02/09/2026"], [120, "Monoprix"], [520, "-12,30 €", "right"]],
          [[40, "05/09/2026"], [120, "Salaire ACME"], [520, "+2 500,00 €", "right"]],
        ]),
      ],
      { today: TODAY },
    );
    const block = statement.blocks[0]!;
    expect(block.signUnknown).toBe(false);
    expect(block.lines.map((line) => [line.creditDebitIndicator, line.amount])).toEqual([
      ["DBIT", "12.30"],
      ["CRDT", "2500.00"],
    ]);
  });

  it("says a PDF with no text is a scan", () => {
    const statement = readPdfPages([{ texts: [] }, { texts: [] }], {
      today: TODAY,
    });
    expect(statement.problem).toBe("scanned");
    expect(statement.blocks).toEqual([]);
  });

  it("says a PDF whose text holds no statement is unreadable", () => {
    const statement = readPdfPages([page([[[40, "Conditions générales"]]])], {
      today: TODAY,
    });
    expect(statement.problem).toBe("unreadable");
  });
});
