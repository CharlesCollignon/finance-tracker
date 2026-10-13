import { describe, expect, it } from "vitest";
import type { BankTransaction } from "../bank-feed";
import { confirmProvisional, type ProvisionalLine } from "./provisional";

function line(id: string, day: string, amount: string, out = true): BankTransaction {
  return {
    id,
    amount,
    currency: "EUR",
    creditDebitIndicator: out ? "DBIT" : "CRDT",
    bookingDate: day,
    valueDate: null,
    transactionDate: null,
    creditorName: null,
    creditorIban: null,
    debtorName: null,
    debtorIban: null,
    remittanceInformation: "CB MONOP",
    merchantCategoryCode: null,
  };
}

function early(id: string, day: string, amount: string, confirmedBy: string | null = null): ProvisionalLine {
  return { id, amount, direction: "out", day, confirmedBy };
}

describe("confirmProvisional", () => {
  it("lets a statement line confirm the alert of the same payment", () => {
    const result = confirmProvisional(
      [line("s1", "2026-10-13", "23.50"), line("s2", "2026-10-13", "8.00")],
      [early("a1", "2026-10-11", "23.50")],
    );
    expect(result.confirmed).toEqual([{ provisionalId: "a1", lineId: "s1" }]);
    expect(result.fresh.map((one) => one.id)).toEqual(["s2"]);
  });

  it("keeps two coffees two, each confirming one alert", () => {
    const result = confirmProvisional(
      [line("s1", "2026-10-12", "3.50"), line("s2", "2026-10-12", "3.50"), line("s3", "2026-10-12", "3.50")],
      [early("a1", "2026-10-12", "3.50"), early("a2", "2026-10-12", "3.50")],
    );
    expect(result.confirmed).toHaveLength(2);
    expect(result.fresh.map((one) => one.id)).toEqual(["s3"]);
  });

  it("does not take money in for money out, nor a week apart", () => {
    const result = confirmProvisional(
      [line("s1", "2026-10-12", "23.50", false), line("s2", "2026-10-20", "23.50")],
      [early("a1", "2026-10-12", "23.50")],
    );
    expect(result.confirmed).toEqual([]);
    expect(result.fresh).toHaveLength(2);
  });

  it("counts the statement imported again as confirmed already", () => {
    const result = confirmProvisional(
      [line("s1", "2026-10-13", "23.50")],
      [early("a1", "2026-10-11", "23.50", "s1")],
    );
    expect(result).toEqual({ fresh: [], confirmed: [], alreadyConfirmed: 1 });
  });

  it("pairs each line with the closest alert", () => {
    const result = confirmProvisional(
      [line("s1", "2026-10-14", "10.00")],
      [early("a1", "2026-10-10", "10.00"), early("a2", "2026-10-13", "10.00")],
    );
    expect(result.confirmed).toEqual([{ provisionalId: "a2", lineId: "s1" }]);
  });
});
