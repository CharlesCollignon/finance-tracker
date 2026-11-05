import { describe, expect, it } from "vitest";

import { purchaseDayInText, purchaseDayOf } from "./purchase-day";

const line = (
  remittanceInformation: string,
  transactionDate: string | null = null,
) => ({
  remittanceInformation,
  transactionDate,
});

describe("purchaseDayInText", () => {
  it("reads the day ending a Crédit Agricole card line", () => {
    expect(
      purchaseDayInText(
        "PAIEMENT PAR CARTE X7322 SYMPA LILLE          30/10",
        "2026-11-03",
      ),
    ).toBe("2026-10-30");
  });

  it("takes the year before when the month is later than the booking's", () => {
    expect(
      purchaseDayInText("PAIEMENT PAR CARTE X7322 FNAC 30/12", "2027-01-02"),
    ).toBe("2026-12-30");
  });

  it("reads a refund the same way", () => {
    expect(
      purchaseDayInText("AVOIR CARTE X0767 Google One     13/07", "2026-07-16"),
    ).toBe("2026-07-13");
  });

  it("leaves alone a line that is not a card's", () => {
    expect(
      purchaseDayInText("VIREMENT EMIS LOYER 01/11", "2026-11-03"),
    ).toBeNull();
  });

  it("refuses a day that does not exist", () => {
    expect(
      purchaseDayInText("PAIEMENT PAR CARTE X7322 SHOP 31/02", "2026-03-02"),
    ).toBeNull();
  });
});

describe("purchaseDayOf", () => {
  it("prefers the bank's own transaction date", () => {
    expect(
      purchaseDayOf(line("CARTE X1 SHOP 01/01", "2026-10-29"), "2026-11-02"),
    ).toBe("2026-10-29");
  });

  it("is null when it is the booking day", () => {
    expect(
      purchaseDayOf(line("PAIEMENT PAR CARTE X7322 SHOP 04/11"), "2026-11-04"),
    ).toBeNull();
  });

  it("is null when the text's date is too far back to be this line's", () => {
    expect(
      purchaseDayOf(line("PAIEMENT PAR CARTE X7322 SHOP 01/06"), "2026-11-04"),
    ).toBeNull();
  });

  it("is null when the date is after the booking", () => {
    expect(
      purchaseDayOf(line("PAIEMENT PAR CARTE X7322 SHOP 06/11"), "2026-11-04"),
    ).toBeNull();
  });
});
