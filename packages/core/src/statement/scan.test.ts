import { describe, expect, it } from "vitest";
import { statementFromScan } from "./scan";

const TODAY = "2026-10-13";

function answer(overrides: Record<string, unknown> = {}) {
  return {
    statement: true,
    bank: "BoursoBank",
    iban: "FR76 4061 8802 0000 0000 0000 123",
    accountNumber: null,
    currency: "EUR",
    periodFrom: "2026-09-01",
    periodTo: "2026-09-30",
    openingBalance: "1000.00",
    closingBalance: "3402.30",
    lines: [
      "2026-09-02|CARTE MONOPRIX PARIS|-12.30|987.70",
      "2026-09-05|VIR SEPA ACME SAS|2500.00|",
      "2026-09-10|PRLV SEPA EDF|-85,40|",
    ],
    ...overrides,
  };
}

describe("statementFromScan", () => {
  it("reads the lines, the account and the balances the lines join", () => {
    const statement = statementFromScan(answer(), { format: "image", today: TODAY });
    expect(statement.readByAi).toBe(true);
    expect(statement.format).toBe("image");
    expect(statement.bank).toBe("boursobank");
    const block = statement.blocks[0]!;
    expect(block.account?.iban).toBe("FR7640618802000000000000123");
    expect(
      block.lines.map((line) => [
        line.bookingDate,
        line.creditDebitIndicator,
        line.amount,
        line.remittanceInformation,
      ]),
    ).toEqual([
      ["2026-09-02", "DBIT", "12.30", "CARTE MONOPRIX PARIS"],
      ["2026-09-05", "CRDT", "2500.00", "VIR SEPA ACME SAS"],
      ["2026-09-10", "DBIT", "85.40", "PRLV SEPA EDF"],
    ]);
    expect(block.lines[0]!.balanceAfterTransaction).toBe("987.70");
    expect(block.check).toEqual({ ok: true, gap: "0.00" });
    expect(block.closing).toEqual({ date: "2026-09-30", amount: "3402.30" });
    expect(block.lines[0]!.id).toMatch(/^l[0-9a-f]{16}-0$/);
  });

  it("keeps no balance the lines do not join", () => {
    const statement = statementFromScan(answer({ closingBalance: "3000.00" }), {
      format: "pdf",
      today: TODAY,
    });
    const block = statement.blocks[0]!;
    expect(block.check?.ok).toBe(false);
    expect(block.closing).toBeNull();
  });

  it("counts a line it cannot believe, and keeps the rest", () => {
    const statement = statementFromScan(
      answer({
        lines: [
          "2026-09-02|MONOPRIX|-12.30|",
          "2026-13-02|MONOPRIX|-12.30|",
          "2031-09-02|FUTURE|-1.00|",
          "2026-09-03|NO AMOUNT|douze|",
          "not a line",
          "2026-09-04|A | BAR|-3.00|",
        ],
      }),
      { format: "image", today: TODAY },
    );
    expect(statement.skipped).toBe(4);
    expect(statement.blocks[0]!.lines.map((line) => line.remittanceInformation)).toEqual([
      "MONOPRIX",
      "A | BAR",
    ]);
  });

  it("says when the image is no statement", () => {
    expect(
      statementFromScan(answer({ statement: false, lines: [] }), {
        format: "image",
        today: TODAY,
      }).problem,
    ).toBe("unreadable");
    expect(statementFromScan("nonsense", { format: "image", today: TODAY }).problem).toBe(
      "unreadable",
    );
  });
});
