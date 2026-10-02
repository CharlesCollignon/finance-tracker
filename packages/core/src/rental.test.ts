import { describe, expect, it } from "vitest";
import { loanSchedule, monthlyOutlay } from "./loan-schedule";
import { loanTermsFromRow } from "./property";
import {
  isLet,
  lettingRule,
  monthlyEquivalent,
  rentalFigures,
  rentPerM2,
  type PropertyTemplate,
} from "./rental";
import type { PropertyLoan } from "./types/database";

function loan(overrides: Partial<PropertyLoan> = {}): PropertyLoan {
  return {
    id: "loan-1",
    user_id: "user-1",
    property_id: "prop-1",
    label: "Prêt studio",
    kind: "amortising",
    principal: 80_000,
    annual_rate: 0.015,
    months: 180,
    first_payment_on: "2019-07-05",
    insurance_monthly: 12,
    insurance_rate: null,
    deferral_months: 0,
    deferral_kind: "none",
    fees: 0,
    borrower_share: 1,
    known_outstanding: null,
    known_outstanding_on: null,
    known_keeps: null,
    recurring_template_id: "tpl-loan",
    created_at: "2019-06-01T00:00:00.000Z",
    updated_at: "2019-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function template(overrides: Partial<PropertyTemplate>): PropertyTemplate {
  return {
    id: "tpl",
    amount: 0,
    recurrence: "monthly",
    active: true,
    endsOn: null,
    attached: true,
    categoryType: "expense",
    ...overrides,
  };
}

const TODAY = "2026-10-02";

describe("isLet", () => {
  it("is a home let unfurnished or furnished, not one lived in", () => {
    expect(isLet("rental_bare")).toBe(true);
    expect(isLet("rental_furnished")).toBe(true);
    expect(isLet("second_home")).toBe(false);
  });
});

describe("monthlyEquivalent", () => {
  it("spreads a yearly amount over twelve months, and a weekly one over the year", () => {
    expect(monthlyEquivalent(960, "yearly")).toBe(80);
    expect(monthlyEquivalent(120, "weekly")).toBe(520);
    expect(monthlyEquivalent(750, "monthly")).toBe(750);
  });
});

describe("rentalFigures", () => {
  const templates = [
    template({ id: "rent", amount: 750, categoryType: "income" }),
    template({ id: "tf", amount: 960, recurrence: "yearly" }),
    template({ id: "copro", amount: 60 }),
    // The loan's own payment: counted once, from the schedule.
    template({ id: "tpl-loan", amount: 508.59 }),
    // Ended, paused, or only on the loan: not this month's.
    template({ id: "old", amount: 300, endsOn: "2026-06-30" }),
    template({ id: "paused", amount: 40, active: false }),
    template({ id: "elsewhere", amount: 25, attached: false }),
    // Not an income or an expense of the property.
    template({ id: "saved", amount: 100, categoryType: "savings" }),
  ];

  it("counts the rent, the charges and the loan once each", () => {
    const figures = rentalFigures([loan()], templates, 114_500, TODAY);
    const terms = loanTermsFromRow(loan());
    const outlay = monthlyOutlay(terms, loanSchedule(terms));

    expect(figures.rent).toBe(750);
    expect(figures.charges).toBe(140);
    expect(figures.loans).toBe(outlay);
    expect(figures.cashFlow).toBe(Math.round((750 - 140 - outlay) * 100) / 100);
  });

  it("measures the yield against what the property cost, before and after its charges", () => {
    const figures = rentalFigures([loan()], templates, 114_500, TODAY);
    expect(figures.grossYield).toBeCloseTo(9000 / 114_500, 10);
    expect(figures.netYield).toBeCloseTo((610 * 12) / 114_500, 10);
  });

  it("counts a loan at the user's share, and not once it is repaid", () => {
    const half = rentalFigures(
      [loan({ borrower_share: 0.5 })],
      [],
      114_500,
      TODAY,
    );
    const terms = loanTermsFromRow(loan());
    expect(half.loans).toBe(
      Math.round(monthlyOutlay(terms, loanSchedule(terms)) * 0.5 * 100) / 100,
    );
    expect(
      rentalFigures([loan({ months: 60 })], [], 114_500, TODAY).loans,
    ).toBe(0);
  });

  it("gives no yield without a rent", () => {
    const figures = rentalFigures([], [template({ amount: 60 })], 114_500, TODAY);
    expect(figures).toMatchObject({
      rent: 0,
      cashFlow: -60,
      grossYield: null,
      netYield: null,
    });
  });
});

describe("rentPerM2", () => {
  it("divides the rent by the living area, when there are both", () => {
    expect(rentPerM2(750, 24)).toBe(31.25);
    expect(rentPerM2(750, null)).toBeNull();
    expect(rentPerM2(0, 24)).toBeNull();
  });
});

describe("lettingRule", () => {
  it("closes a G home on the mainland since 2025, its rent frozen", () => {
    expect(lettingRule("G", "69383", TODAY)).toEqual({
      status: { kind: "closed", since: "2025-01-01" },
      rentFrozen: true,
    });
  });

  it("dates the end for F and E, and none for D and better", () => {
    expect(lettingRule("F", "69383", TODAY)).toEqual({
      status: { kind: "closing", on: "2028-01-01" },
      rentFrozen: true,
    });
    expect(lettingRule("E", "38185", TODAY)).toEqual({
      status: { kind: "closing", on: "2034-01-01" },
      rentFrozen: false,
    });
    expect(lettingRule("C", "38185", TODAY)?.status).toEqual({ kind: "open" });
  });

  it("follows the overseas calendar, three years later and stopping at F", () => {
    expect(lettingRule("G", "97411", TODAY)).toEqual({
      status: { kind: "closing", on: "2028-01-01" },
      rentFrozen: false,
    });
    expect(lettingRule("E", "97209", TODAY)?.status).toEqual({ kind: "open" });
  });

  it("says nothing without a class, and nothing where the calendar does not apply", () => {
    expect(lettingRule(null, "69383", TODAY)).toEqual({
      status: { kind: "unknown" },
      rentFrozen: false,
    });
    expect(lettingRule("G", "97502", TODAY)).toBeNull();
    expect(lettingRule("G", null, TODAY)?.status.kind).toBe("closed");
  });
});
