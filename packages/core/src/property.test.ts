import { describe, expect, it } from "vitest";
import { loanSchedule } from "./loan-schedule";
import {
  acquisitionCost,
  estimatedValue,
  loanPaymentCategoryName,
  loanTermsFromRow,
  notaryFeesEstimate,
  paymentShare,
  propertyPosition,
  quarterLabel,
  valueSourceLine,
} from "./property";
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
    latitude: 45.759099,
    longitude: 4.841934,
    address_label: null,
    living_area: 52,
    rooms: 2,
    ownership_share: 1,
    purchased_on: "2025-01-01",
    purchase_price: 250_000,
    notary_fees: 18_000,
    agency_fees: 0,
    works: 2_000,
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
    fees: 1_500,
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

describe("loanTermsFromRow", () => {
  it("reads a row's terms, numbers as numbers", () => {
    const terms = loanTermsFromRow(
      loan({ principal: "200000.00" as unknown as number }),
    );

    expect(terms).toMatchObject({
      kind: "amortising",
      principal: 200_000,
      annualRate: 0.035,
      months: 240,
      firstPaymentOn: "2025-01-05",
      insuranceMonthly: 45,
      insuranceRate: null,
      known: null,
    });
  });

  it("reads the bank's figure only when it is whole", () => {
    expect(
      loanTermsFromRow(
        loan({
          known_outstanding: 150_000,
          known_outstanding_on: "2029-12-10",
          known_keeps: "term",
        }),
      ).known,
    ).toEqual({ outstanding: 150_000, on: "2029-12-10", keeps: "term" });
  });
});

describe("acquisitionCost", () => {
  it("is the price and everything paid to have it", () => {
    expect(acquisitionCost(property({ agency_fees: 7_500 }))).toBe(277_500);
  });
});

describe("loanPaymentCategoryName", () => {
  it("is the default loan category, in the reader's language", () => {
    expect(loanPaymentCategoryName("fr")).toBe("Remboursement de prêt");
    expect(loanPaymentCategoryName("en")).toBe("Loan repayment");
  });
});

describe("notaryFeesEstimate", () => {
  it("starts from 7.5 % of the price for an existing home, 2.5 % for a new one", () => {
    expect(notaryFeesEstimate(250_000, "existing")).toBe(18_750);
    expect(notaryFeesEstimate(250_000, "new")).toBe(6_250);
  });
});

describe("estimatedValue", () => {
  it("is the user's own figure when they gave one", () => {
    expect(
      estimatedValue(
        property({ value_pinned: 265_000, value_pinned_on: "2026-09-01" }),
      ),
    ).toEqual({
      value: 265_000,
      low: null,
      high: null,
      source: { kind: "own", on: "2026-09-01" },
    });
  });

  it("is the purchase price otherwise, dated by the purchase", () => {
    expect(estimatedValue(property())).toEqual({
      value: 250_000,
      low: null,
      high: null,
      source: { kind: "purchase", on: "2025-01-01" },
    });
  });

  const READING = {
    scope: "radius" as const,
    medianM2: 4_524,
    q1M2: 3_809,
    q3M2: 5_324,
    sales: 394,
    periodFrom: "2023-01-04",
    periodTo: "2025-12-30",
    quarter: "2026-Q2",
  };
  const CARRY = {
    series: "010567011",
    from: "2025-Q1",
    to: "2026-Q2",
    factor: 0.98,
  };

  it("is the market's reading times the area, to the thousand, with its spread", () => {
    expect(
      estimatedValue(property(), { reading: READING, purchaseCarry: CARRY }),
    ).toEqual({
      value: 235_000,
      low: 198_000,
      high: 277_000,
      source: {
        kind: "market",
        scope: "radius",
        sales: 394,
        periodFrom: "2023-01-04",
        periodTo: "2025-12-30",
        quarter: "2026-Q2",
      },
    });
  });

  it("still yields to the user's own figure", () => {
    expect(
      estimatedValue(
        property({ value_pinned: 265_000, value_pinned_on: "2026-09-01" }),
        { reading: READING, purchaseCarry: CARRY },
      ).source.kind,
    ).toBe("own");
  });

  it("is the purchase price carried by the index without a reading", () => {
    expect(
      estimatedValue(property(), { reading: null, purchaseCarry: CARRY }),
    ).toEqual({
      value: 245_000,
      low: null,
      high: null,
      source: { kind: "indexed", from: "2025-Q1", to: "2026-Q2" },
    });
  });

  it("has no market for premises, or a home without its area", () => {
    const market = { reading: READING, purchaseCarry: null };
    expect(
      estimatedValue(property({ kind: "other" }), market).source.kind,
    ).toBe("purchase");
    expect(
      estimatedValue(property({ living_area: null }), market).source.kind,
    ).toBe("purchase");
  });

  it("is the purchase price when the index has not moved since", () => {
    expect(
      estimatedValue(property(), {
        reading: null,
        purchaseCarry: { ...CARRY, from: "2026-Q2", factor: 1 },
      }).source.kind,
    ).toBe("purchase");
  });
});

describe("propertyPosition", () => {
  it("counts the user's share of the value and of each loan", () => {
    const loans = [loan({ borrower_share: 0.5 })];
    const owedAfterThree = loanSchedule(loanTermsFromRow(loans[0]!))[2]!
      .outstanding;

    const position = propertyPosition(
      property({ ownership_share: 0.5 }),
      loans,
      "2025-03-10",
    );

    expect(position.value).toBe(125_000);
    expect(position.owed).toBe(Math.round(owedAfterThree * 50) / 100);
    expect(position.owed + position.principalRepaid).toBe(100_000);
    expect(position.netValue).toBe(
      Math.round((125_000 - position.owed) * 100) / 100,
    );
    expect(position.cost).toBe(135_000);
    expect(position.unrealisedGain).toBe(-10_000);
    expect(position.principalRepaid).toBe(
      Math.round((100_000 - position.owed) * 100) / 100,
    );
  });

  it("owes nothing on a property bought without a loan", () => {
    const position = propertyPosition(
      property({ value_pinned: 280_000, value_pinned_on: "2026-09-01" }),
      [],
      "2026-10-02",
    );

    expect(position).toMatchObject({
      value: 280_000,
      owed: 0,
      netValue: 280_000,
      unrealisedGain: 10_000,
      principalRepaid: 0,
    });
  });

  it("adds every loan behind the property", () => {
    const position = propertyPosition(
      property(),
      [
        loan(),
        loan({
          id: "loan-2",
          label: "PTZ",
          principal: 40_000,
          annual_rate: 0,
          insurance_monthly: 0,
        }),
      ],
      "2024-12-31",
    );

    expect(position.owed).toBe(240_000);
  });

  it("counts nothing repaid while a total deferral adds to what is owed", () => {
    const position = propertyPosition(
      property(),
      [loan({ months: 246, deferral_months: 6, deferral_kind: "total" })],
      "2025-03-10",
    );

    expect(position.owed).toBeGreaterThan(200_000);
    expect(position.principalRepaid).toBe(0);
  });
});

describe("paymentShare", () => {
  it("splits the user's part of a payment", () => {
    const first = loanSchedule(loanTermsFromRow(loan()))[0]!;

    expect(paymentShare(first, 0.5)).toEqual({
      principal: 288.3,
      interest: 291.67,
      insurance: 22.5,
      total: 602.47,
    });
  });

  it("is only the insurance in a total deferral", () => {
    const first = loanSchedule(
      loanTermsFromRow(
        loan({ months: 246, deferral_months: 6, deferral_kind: "total" }),
      ),
    )[0]!;

    expect(paymentShare(first, 1).total).toBe(45);
  });
});

describe("valueSourceLine", () => {
  it("says where each kind of estimate comes from", () => {
    expect(
      valueSourceLine(
        {
          kind: "market",
          scope: "commune",
          sales: 6615,
          periodFrom: "2023-01-03",
          periodTo: "2025-12-31",
          quarter: "2026-Q2",
        },
        "fr",
      ),
    ).toBe(
      "D'après 6\u202F615 ventes dans la commune, 2023–2025 (DVF), ramenées au T2 2026",
    );
    expect(
      valueSourceLine(
        { kind: "indexed", from: "2019-Q2", to: "2026-Q2" },
        "en",
      ),
    ).toBe(
      "Purchase price carried by the Notaires–INSEE index, Q2 2019 → Q2 2026",
    );
    expect(
      valueSourceLine(
        { kind: "indexed", from: "2019-Q2", to: "2026-Q2" },
        "fr",
        "short",
      ),
    ).toBe("Prix d'achat actualisé au T2 2026");
    expect(valueSourceLine({ kind: "purchase", on: "2019-06-14" }, "fr")).toBe(
      "Prix d'achat, juin 2019",
    );
  });

  it("writes a quarter the way the reader says it", () => {
    expect(quarterLabel("2026-Q2", "fr")).toBe("T2 2026");
    expect(quarterLabel("2026-Q2", "en")).toBe("Q2 2026");
  });
});
