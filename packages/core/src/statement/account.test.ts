import { describe, expect, it } from "vitest";

import { statementLineSchema } from "../validations/statements";
import { accountTail, statementKey, withDirection } from "./account";
import { BANK_IDS } from "./banks";
import { exportGuide } from "./guides";
import { readStatementText } from "./read";
import { readMappedTable } from "./table";

describe("an account known again", () => {
  it("by its IBAN, or else its number, as one string", () => {
    expect(
      statementKey({
        iban: "FR76 3000 4000 0312 3456 7890 143",
        number: null,
        name: null,
      }),
    ).toBe("FR7630004000031234567890143");
    expect(
      statementKey({ iban: null, number: "0123456A020", name: null }),
    ).toBe("0123456A020");
    expect(statementKey({ iban: null, number: "12", name: null })).toBeNull();
    expect(statementKey(null)).toBeNull();
  });

  it("shows only its last four", () => {
    expect(accountTail("FR7630004000031234567890143")).toBe("••0143");
    expect(accountTail(null)).toBeNull();
  });
});

describe("amounts written without their sign", () => {
  it("are turned the way the person says, and given their ids again", () => {
    const statement = readStatementText(
      [
        "Date;Libellé;Montant",
        "02/10/2026;CB MONOP;23,45",
        "03/10/2026;FREE MOBILE;19,99",
      ].join("\n"),
    );
    const block = statement.blocks[0]!;
    expect(block.signUnknown).toBe(true);
    const spent = withDirection(block, "out");
    expect(spent.signUnknown).toBe(false);
    expect(
      spent.lines.every((line) => line.creditDebitIndicator === "DBIT"),
    ).toBe(true);
    expect(spent.lines[0]!.id).not.toBe(block.lines[0]!.id);
  });
});

describe("a table read under the columns the person named", () => {
  it("reads what it could not read alone", () => {
    const rows = [
      ["Quand", "Quoi", "Sortie", "Entrée"],
      ["02/10/2026", "CB MONOP", "23,45", ""],
      ["01/10/2026", "VIR SALAIRE", "", "2500,00"],
    ];
    const reading = readMappedTable(rows, {
      header: true,
      date: 0,
      label: 1,
      amount: null,
      debit: 2,
      credit: 3,
    });
    expect(
      reading.blocks[0]!.lines.map(
        (line) =>
          `${line.creditDebitIndicator} ${line.amount} ${line.remittanceInformation}`,
      ),
    ).toEqual(["DBIT 23.45 CB MONOP", "CRDT 2500.00 VIR SALAIRE"]);
  });
});

describe("export guides", () => {
  it("give every bank a site, and its own steps where they are written down", () => {
    for (const bank of BANK_IDS) {
      const guide = exportGuide(bank, "fr");
      expect(guide.site).toMatch(/^https:\/\//);
      expect(guide.steps.length).toBeGreaterThanOrEqual(2);
    }
    expect(exportGuide("boursobank", "fr").steps[0]).toContain(
      "Exporter en format CSV",
    );
    expect(exportGuide("credit-agricole", "en").steps[0]).toContain("website");
    expect(exportGuide(null, "fr").site).toBeNull();
  });
});

describe("what is sent to the server", () => {
  it("is every line the engine reads, as the server checks it", () => {
    const statement = readStatementText(
      [
        "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
        "CARD_PAYMENT,Current,2026-10-01 12:00:00,2026-10-02 08:00:00,Monop,-23.45,0.00,EUR,COMPLETED,476.55",
        "TOPUP,Current,2026-10-01 09:00:00,2026-10-01 09:00:01,Top-Up,500.00,0.00,EUR,COMPLETED,500.00",
      ].join("\n"),
    );
    for (const line of statement.blocks[0]!.lines) {
      expect(statementLineSchema.safeParse(line).success).toBe(true);
    }
  });
});
