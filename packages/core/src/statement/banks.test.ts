import { describe, expect, it } from "vitest";

import {
  BANK_IDS,
  BANK_NAMES,
  bankFromCode,
  bankFromHeader,
  bankFromIban,
  bankFromText,
  isBankId,
} from "./banks";

describe("banks", () => {
  it("names every bank", () => {
    expect(Object.keys(BANK_NAMES).sort()).toEqual([...BANK_IDS].sort());
    expect(isBankId("boursobank")).toBe(true);
    expect(isBankId("credit-lyonnais")).toBe(false);
  });

  it("knows a bank by a code that is its alone", () => {
    expect(bankFromCode("30004")).toBe("bnp-paribas");
    expect(bankFromIban("FR76 4061 8802 0000 0012 3456 789")).toBe(
      "boursobank",
    );
    expect(bankFromIban("FR7630003012340001234567890")).toBe(
      "societe-generale",
    );
    // A regional bank's code, shared by no one but saying nothing alone.
    expect(bankFromIban("FR7618206000001234567890123")).toBeNull();
    expect(bankFromIban("DE89370400440532013000")).toBeNull();
  });

  it("knows a bank by columns only it writes", () => {
    expect(
      bankFromHeader(["dateOp", "dateVal", "label", "supplierFound", "amount"]),
    ).toBe("boursobank");
    expect(bankFromHeader(["Date", "Libellé", "Montant"])).toBeNull();
  });

  it("knows a bank by its name, when only one is named", () => {
    expect(bankFromText("Relevé Crédit Agricole Ile-de-France")).toBe(
      "credit-agricole",
    );
    expect(
      bankFromText("Virement Crédit Agricole vers Société Générale"),
    ).toBeNull();
  });
});
