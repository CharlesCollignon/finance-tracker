import { describe, expect, it } from "vitest";

import {
  cardNumberOf,
  debitDateFor,
  isCardLine,
  isCardSettlement,
  settledCycle,
} from "./cards";

describe("cardNumberOf", () => {
  it("reads the card numbers banks print", () => {
    expect(cardNumberOf("PAIEMENT PAR CARTE X7322 SYMPA LILLE 30/10")).toBe(
      "7322",
    );
    expect(cardNumberOf("CB CARREFOUR 12/10 CARTE 4974XXXXXXXX1234")).toBe(
      "1234",
    );
    expect(cardNumberOf("PAIEMENT CB*5678 FNAC")).toBe("5678");
    expect(cardNumberOf("FACTURE CARTE DU 300924 CARTE ****4321")).toBe("4321");
  });

  it("names no card on a line that is not a card's", () => {
    expect(cardNumberOf("VIREMENT X1234 LOYER")).toBeNull();
    expect(cardNumberOf("PAIEMENT PAR CARTE SANS NUMERO")).toBeNull();
  });
});

describe("isCardSettlement", () => {
  it("knows the month's combined debit by the words banks use", () => {
    for (const line of [
      "FACTURE CARTE DU 300924 CARTE 4974XXXXXXXX1234",
      "RELEVE DIFFERE CARTE X1234",
      "RELEVE CB 09/2024",
      "PRLV CARTE DIFFEREE",
      "DEBIT DIFFERE CARTE",
      "CARTE X1234 DEPENSES DU 01/09 AU 30/09",
      "ARRETE CARTE AU 28/09",
      "TOTAL OPERATIONS CARTE",
      "Relevé différé carte",
    ]) {
      expect(isCardSettlement(line), line).toBe(true);
    }
  });

  it("is not a card payment", () => {
    expect(isCardSettlement("PAIEMENT PAR CARTE X7322 SYMPA LILLE 30/10")).toBe(
      false,
    );
    expect(isCardSettlement("AVOIR CARTE X0767 Google One 13/07")).toBe(false);
    expect(isCardLine("PAIEMENT PAR CARTE X7322")).toBe(true);
  });
});

describe("debitDateFor", () => {
  it("debits this month when the day is still to come", () => {
    expect(debitDateFor("2026-10-12", 31)).toBe("2026-10-31");
    expect(debitDateFor("2026-02-12", 31)).toBe("2026-02-28");
  });

  it("debits next month once the day has come", () => {
    expect(debitDateFor("2026-10-31", 31)).toBe("2026-11-30");
    expect(debitDateFor("2026-10-06", 5)).toBe("2026-11-05");
    expect(debitDateFor("2026-12-20", 5)).toBe("2027-01-05");
  });
});

describe("settledCycle", () => {
  const cycles = [
    { key: "1234", debitOn: "2026-09-30", total: 612.4 },
    { key: "9999", debitOn: "2026-09-30", total: 88 },
  ];

  it("finds the cycle a combined debit pays for", () => {
    expect(
      settledCycle(
        { amount: 612.4, bookedOn: "2026-10-01", key: "1234" },
        cycles,
      ),
    ).toEqual(cycles[0]);
  });

  it("allows a small gap, the card's fee or a late payment", () => {
    expect(
      settledCycle({ amount: 615, bookedOn: "2026-09-30", key: null }, cycles),
    ).toEqual(cycles[0]);
  });

  it("keeps it an expense when nothing it could pay for is known", () => {
    expect(
      settledCycle(
        { amount: 700, bookedOn: "2026-09-30", key: "1234" },
        cycles,
      ),
    ).toBeNull();
    expect(
      settledCycle(
        { amount: 612.4, bookedOn: "2026-10-20", key: "1234" },
        cycles,
      ),
    ).toBeNull();
    expect(
      settledCycle({ amount: 88, bookedOn: "2026-09-30", key: "1234" }, cycles),
    ).toBeNull();
  });
});
