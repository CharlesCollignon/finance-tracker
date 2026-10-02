import { describe, expect, it } from "vitest";
import { loanSchema, propertySchema } from "./property";

const PROPERTY = {
  name: "  Appartement Lyon 3e ",
  kind: "apartment",
  livingArea: "52",
  ownershipShare: "50",
  purchasedOn: "2025-01-01",
  purchasePrice: "250 000",
  notaryFees: "18 000",
  agencyFees: "",
  works: "",
};

const LOAN = {
  propertyId: "8f14e45f-ceea-467a-9575-0b1f3e2c4a1d",
  label: "Prêt principal",
  principal: "200 000",
  annualRate: "3,5",
  months: "240",
  firstPaymentOn: "2025-01-05",
  insuranceMonthly: "45",
  insuranceRate: "",
  fees: "1 500",
  borrowerShare: "",
};

function messages(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.success
    ? []
    : result.error!.issues.map((issue) => issue.message);
}

describe("propertySchema", () => {
  it("reads a property as the form types it", () => {
    const result = propertySchema.parse(PROPERTY);

    expect(result).toMatchObject({
      name: "Appartement Lyon 3e",
      kind: "apartment",
      usage: "main_home",
      livingArea: 52,
      ownershipShare: 0.5,
      purchasePrice: 250_000,
      notaryFees: 18_000,
      agencyFees: 0,
      works: 0,
      citycode: null,
      latitude: null,
      addressLabel: null,
    });
  });

  it("holds all of a property when no share is typed", () => {
    expect(
      propertySchema.parse({ ...PROPERTY, ownershipShare: "" }).ownershipShare,
    ).toBe(1);
  });

  it("asks a home for its area, and not premises", () => {
    expect(
      messages(propertySchema.safeParse({ ...PROPERTY, livingArea: "" })),
    ).toEqual(["errors.areaRequired"]);
    expect(
      propertySchema.safeParse({ ...PROPERTY, kind: "other", livingArea: "" })
        .success,
    ).toBe(true);
  });

  it("refuses a share of nothing or more than all of it", () => {
    expect(
      messages(propertySchema.safeParse({ ...PROPERTY, ownershipShare: "0" })),
    ).toEqual(["errors.shareRange"]);
    expect(
      messages(
        propertySchema.safeParse({ ...PROPERTY, ownershipShare: "120" }),
      ),
    ).toEqual(["errors.shareRange"]);
  });

  it("asks for a price", () => {
    expect(
      messages(propertySchema.safeParse({ ...PROPERTY, purchasePrice: "" })),
    ).toEqual(["errors.amountPositive"]);
    expect(
      messages(
        propertySchema.safeParse({ ...PROPERTY, purchasePrice: "beaucoup" }),
      ),
    ).toEqual(["errors.positiveNumber"]);
  });

  it("keeps where it is, as the geocoder gave it", () => {
    const result = propertySchema.parse({
      ...PROPERTY,
      citycode: "69383",
      postcode: "69003",
      latitude: 45.759099,
      longitude: 4.841934,
      addressLabel: "12 Rue de la Part-Dieu 69003 Lyon",
    });

    expect(result).toMatchObject({ citycode: "69383", latitude: 45.759099 });
    expect(
      propertySchema.safeParse({ ...PROPERTY, citycode: "2A004" }).success,
    ).toBe(true);
    expect(
      propertySchema.safeParse({ ...PROPERTY, citycode: "Lyon" }).success,
    ).toBe(false);
    expect(
      propertySchema.safeParse({ ...PROPERTY, latitude: 45.7 }).success,
    ).toBe(false);
  });
});

describe("loanSchema", () => {
  it("reads a loan as the form types it", () => {
    expect(loanSchema.parse(LOAN)).toMatchObject({
      label: "Prêt principal",
      kind: "amortising",
      principal: 200_000,
      annualRate: 0.035,
      months: 240,
      insuranceMonthly: 45,
      insuranceRate: null,
      deferralKind: "none",
      deferralMonths: 0,
      fees: 1_500,
      borrowerShare: 1,
    });
  });

  it("reads a rate's three decimals as decimals, not thousands", () => {
    expect(
      loanSchema.parse({ ...LOAN, annualRate: "1,125" }).annualRate,
    ).toBeCloseTo(0.01125, 10);
    expect(loanSchema.parse({ ...LOAN, annualRate: "0 %" }).annualRate).toBe(0);
  });

  it("refuses a rate past 20 % and a length past 600 months", () => {
    expect(
      messages(loanSchema.safeParse({ ...LOAN, annualRate: "35" })),
    ).toEqual(["errors.rateRange"]);
    expect(messages(loanSchema.safeParse({ ...LOAN, months: "0" }))).toEqual([
      "errors.monthsRange",
    ]);
  });

  it("takes insurance as an amount or a rate, not both", () => {
    expect(
      loanSchema.parse({
        ...LOAN,
        insuranceMonthly: "",
        insuranceRate: "0,36",
      }),
    ).toMatchObject({ insuranceMonthly: 0, insuranceRate: 0.0036 });
    expect(
      messages(loanSchema.safeParse({ ...LOAN, insuranceRate: "0,36" })),
    ).toEqual(["errors.insuranceOneWay"]);
    expect(
      messages(
        loanSchema.safeParse({
          ...LOAN,
          insuranceMonthly: "",
          insuranceRate: "8",
        }),
      ),
    ).toEqual(["errors.insuranceRateRange"]);
  });

  it("forgets the months of a deferral that is not one", () => {
    expect(
      loanSchema.parse({ ...LOAN, deferralMonths: "12" }).deferralMonths,
    ).toBe(0);
  });

  it("asks a deferral how long it lasts, and to leave a payment", () => {
    expect(
      messages(loanSchema.safeParse({ ...LOAN, deferralKind: "partial" })),
    ).toEqual(["errors.deferralMonthsRequired"]);
    expect(
      messages(
        loanSchema.safeParse({
          ...LOAN,
          deferralKind: "total",
          deferralMonths: "240",
        }),
      ),
    ).toEqual(["errors.deferralTooLong"]);
    expect(
      loanSchema.parse({
        ...LOAN,
        months: "252",
        deferralKind: "partial",
        deferralMonths: "12",
      }),
    ).toMatchObject({ deferralKind: "partial", deferralMonths: 12 });
  });

  it("gives an in fine loan no deferral", () => {
    expect(
      messages(
        loanSchema.safeParse({
          ...LOAN,
          kind: "in_fine",
          deferralKind: "partial",
          deferralMonths: "6",
        }),
      ),
    ).toEqual(["errors.inFineNoDeferral"]);
  });
});
