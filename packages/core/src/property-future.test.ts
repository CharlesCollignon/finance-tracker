import { describe, expect, it } from "vitest";
import { loanSchedule, outstandingOn } from "./loan-schedule";
import { loanTermsFromRow, propertyPosition } from "./property";
import {
  holdingAllowance,
  loanEndings,
  netWorth,
  projectProperty,
  propertyGainTax,
} from "./property-future";
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
    insurance_monthly: 45,
    insurance_rate: null,
    deferral_months: 0,
    deferral_kind: "none",
    fees: 0,
    borrower_share: 1,
    known_outstanding: null,
    known_outstanding_on: null,
    known_keeps: null,
    insurance_separate: false,
    insurance_template_id: null,
    recurring_template_id: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("holdingAllowance", () => {
  it("takes nothing off before the sixth year", () => {
    expect(holdingAllowance(5)).toEqual({ incomeTax: 0, social: 0 });
  });

  it("takes 6 % and 1.65 % a year off from the sixth", () => {
    expect(holdingAllowance(6)).toEqual({ incomeTax: 0.06, social: 0.0165 });
    expect(holdingAllowance(21)).toEqual({ incomeTax: 0.96, social: 0.264 });
  });

  it("frees the gain of income tax after 22 years and of contributions after 30", () => {
    expect(holdingAllowance(22)).toEqual({ incomeTax: 1, social: 0.28 });
    expect(holdingAllowance(25)).toEqual({ incomeTax: 1, social: 0.55 });
    expect(holdingAllowance(30)).toEqual({ incomeTax: 1, social: 1 });
    expect(holdingAllowance(40)).toEqual({ incomeTax: 1, social: 1 });
  });
});

describe("propertyGainTax", () => {
  const SECOND_HOME = {
    usage: "second_home" as const,
    salePrice: 300_000,
    purchasePrice: 200_000,
    fees: 15_000,
    works: 0,
    yearsHeld: 10,
  };

  it("takes nothing from the main home", () => {
    expect(propertyGainTax({ ...SECOND_HOME, usage: "main_home" })).toBe(0);
  });

  it("taxes a second home's gain after its fees, flat works and allowances", () => {
    // 300 000 − (200 000 + 15 000 fees + 30 000 works at 15 %) = 55 000.
    // 55 000 × (1 − 30 %) × 19 % + 55 000 × (1 − 8.25 %) × 17.2 %.
    expect(propertyGainTax(SECOND_HOME)).toBe(15_994.55);
  });

  it("counts fees at 7.5 % of the price at least, and no flat works before six years", () => {
    // 300 000 − (200 000 + 15 000) = 85 000, no allowance at four years.
    expect(propertyGainTax({ ...SECOND_HOME, fees: 2_000, yearsHeld: 4 })).toBe(
      Math.round((85_000 * 0.19 + 85_000 * 0.172) * 100) / 100,
    );
  });

  it("owes nothing on no gain", () => {
    expect(propertyGainTax({ ...SECOND_HOME, salePrice: 240_000 })).toBe(0);
  });
});

describe("projectProperty", () => {
  it("grows the value and lets the loan run down, year by year", () => {
    const years = projectProperty(property(), [loan()], null, {
      years: 2,
      growth: 0.02,
      today: "2026-10-02",
    });
    const terms = loanTermsFromRow(loan());
    const schedule = loanSchedule(terms);

    expect(years).toHaveLength(3);
    expect(years[0]).toMatchObject({
      year: 0,
      value: 250_000,
      owed: outstandingOn(terms, schedule, "2026-10-02"),
      tax: 0,
    });
    expect(years[2]!.value).toBe(260_100);
    expect(years[2]!.owed).toBe(outstandingOn(terms, schedule, "2028-10-02"));
    expect(years[2]!.net).toBe(
      Math.round((260_100 - years[2]!.owed) * 100) / 100,
    );
  });

  it("counts the user's share and a sale's tax on a home let out", () => {
    const years = projectProperty(
      property({
        usage: "rental_bare",
        ownership_share: 0.5,
        purchased_on: "2016-01-01",
      }),
      [],
      null,
      { years: 0, growth: 0.02, today: "2026-10-02" },
    );

    expect(years[0]).toMatchObject({ value: 125_000, owed: 0 });
    // Bought 2016, held ten years: 125 000 − (125 000 + 9 375 + 18 750) < 0.
    expect(years[0]!.tax).toBe(0);
  });
});

describe("netWorth", () => {
  it("adds the properties' value to the savings and investments, less what is owed", () => {
    const position = propertyPosition(
      property({ ownership_share: 0.5 }),
      [loan({ borrower_share: 0.5 })],
      "2024-12-31",
    );

    expect(netWorth(50_000, [position])).toEqual({
      liquid: 50_000,
      property: 125_000,
      owed: 100_000,
      net: 75_000,
    });
  });
});

describe("loanEndings", () => {
  it("says when each running loan ends, and what it costs a month until then", () => {
    expect(
      loanEndings(
        [
          loan(),
          loan({
            id: "loan-2",
            label: "PTZ",
            principal: 40_000,
            annual_rate: 0,
            months: 120,
            insurance_monthly: 0,
          }),
        ],
        "2026-10-02",
      ),
    ).toEqual([
      { label: "PTZ", endsOn: "2034-12-05", monthly: 333.33 },
      { label: "Prêt principal", endsOn: "2044-12-05", monthly: 1204.92 },
    ]);
  });

  it("leaves out a loan already repaid", () => {
    expect(loanEndings([loan({ months: 12 })], "2026-10-02")).toEqual([]);
  });
});
