import { describe, expect, it } from "vitest";
import { followsMovements, ownTransferIbans } from "./bank-accounts";

describe("followsMovements", () => {
  it("brings in a current account's movements, and nothing else's", () => {
    expect(followsMovements("spending")).toBe(true);
    expect(followsMovements("savings")).toBe(false);
    expect(followsMovements("ignored")).toBe(false);
    expect(followsMovements(null)).toBe(false);
  });
});

describe("ownTransferIbans", () => {
  it("holds the current accounts' IBANs only", () => {
    const ibans = ownTransferIbans([
      { iban: "FR76 1111 2222", role: "spending" },
      { iban: "fr7633334444", role: "spending" },
      { iban: "FR76 5555 6666", role: "savings" },
      { iban: "FR76 7777 8888", role: "ignored" },
      { iban: "FR76 9999 0000", role: null },
      { iban: null, role: "spending" },
      { iban: " ", role: "spending" },
    ]);
    expect([...ibans].sort()).toEqual(["FR7611112222", "FR7633334444"]);
  });
});
