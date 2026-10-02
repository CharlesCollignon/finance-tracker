import { describe, expect, it } from "vitest";
import { translator } from "./i18n/t";
import { propertyPosition } from "./property";
import { equityHalfOn, equityMoment } from "./property-moments";
import { loanProgress, ownership } from "./property-progress";
import { equityMomentNotification } from "./push-messages";
import type { Property, PropertyLoan } from "./types/database";

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-1",
    user_id: "user-1",
    name: "Appartement Lyon 3e",
    kind: "apartment",
    usage: "main_home",
    citycode: "69383",
    postcode: "69003",
    latitude: null,
    longitude: null,
    address_label: null,
    living_area: 52,
    rooms: 2,
    ownership_share: 1,
    purchased_on: "2025-01-01",
    purchase_price: 250_000,
    notary_fees: 18_000,
    agency_fees: 0,
    works: 0,
    value_pinned: null,
    value_pinned_on: null,
    yearly_growth: null,
    energy_class: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function loan(overrides: Partial<PropertyLoan> = {}): PropertyLoan {
  return {
    id: "loan-1",
    user_id: "user-1",
    property_id: "prop-1",
    label: "Prêt principal",
    kind: "amortising",
    principal: 200_000,
    annual_rate: 0.035,
    months: 240,
    first_payment_on: "2025-01-05",
    insurance_monthly: 0,
    insurance_rate: null,
    deferral_months: 0,
    deferral_kind: "none",
    fees: 0,
    borrower_share: 1,
    known_outstanding: null,
    known_outstanding_on: null,
    known_keeps: null,
    recurring_template_id: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ownership", () => {
  it("is the value less what is owed, over the value", () => {
    const position = propertyPosition(property(), [loan()], "2024-12-31");
    expect(ownership(position)).toEqual({
      yours: 50_000,
      owed: 200_000,
      share: 0.2,
    });
  });

  it("is all of it without a loan, and none of it when the loan owes more", () => {
    expect(
      ownership(propertyPosition(property(), [], "2026-10-03")).share,
    ).toBe(1);
    const under = ownership(
      propertyPosition(
        property({ value_pinned: 150_000, value_pinned_on: "2026-01-01" }),
        [loan()],
        "2024-12-31",
      ),
    );
    expect(under).toMatchObject({ yours: 0, share: 0 });
  });
});

describe("loanProgress", () => {
  it("says how much is repaid, the marks passed and what is left", () => {
    const progress = loanProgress(
      loan({
        known_outstanding: 90_000,
        known_outstanding_on: "2026-09-20",
        known_keeps: "payment",
      }),
      "2026-10-03",
    );
    expect(progress.repaid).toBeCloseTo(0.55, 5);
    expect(progress.passed).toEqual([0.25, 0.5]);
    expect(progress.paymentsLeft).toBeGreaterThan(0);
    expect(progress.endsOn).not.toBeNull();
  });

  it("counts nothing repaid on an in fine loan before its end", () => {
    const progress = loanProgress(loan({ kind: "in_fine" }), "2030-01-01");
    expect(progress.repaid).toBe(0);
    expect(progress.passed).toEqual([]);
  });

  it("is complete once the last payment is made", () => {
    const progress = loanProgress(loan({ months: 12 }), "2026-01-10");
    expect(progress).toMatchObject({
      repaid: 1,
      passed: [0.25, 0.5, 0.75],
      paymentsLeft: 0,
    });
  });
});

describe("equityHalfOn", () => {
  // Worth its purchase price: 250 000, half of it 125 000.
  const home = property();

  it("is the payment after which what is owed is half the value or less", () => {
    const day = equityHalfOn(home, [loan()], null)!;
    const owedBefore = propertyPosition(home, [loan()], day.replace(/-05$/, "-04")).owed;
    const owedAfter = propertyPosition(home, [loan()], day).owed;
    expect(owedBefore).toBeGreaterThan(125_000);
    expect(owedAfter).toBeLessThanOrEqual(125_000);
  });

  it("is never when half was the user's from the purchase", () => {
    expect(equityHalfOn(home, [loan({ principal: 100_000 })], null)).toBeNull();
    expect(equityHalfOn(home, [], null)).toBeNull();
  });

  it("is a moment for a month after the day", () => {
    const day = equityHalfOn(home, [loan()], null)!;
    expect(equityMoment(home, [loan()], null, day)).toEqual({ on: day });
    expect(equityMoment(home, [loan()], null, "2025-06-01")).toBeNull();
  });
});

describe("equityMomentNotification", () => {
  it("is keyed by the property, once", () => {
    const notification = equityMomentNotification({
      t: translator("fr"),
      locale: "fr",
      property: { id: "prop-1", name: "Appartement Lyon 3e" },
      value: 238_000,
    });
    expect(notification).toMatchObject({
      kind: "property",
      key: "property:equity-half:prop-1",
      title: "Appartement Lyon 3e\u00A0: la moitié est à vous",
      url: "/property/prop-1",
    });
  });
});
