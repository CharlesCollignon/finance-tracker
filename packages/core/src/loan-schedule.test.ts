import { describe, expect, it } from "vitest";
import {
  cents,
  loanSchedule,
  loanTotals,
  monthlyOutlay,
  nextPayment,
  outstandingOn,
  regularPayment,
  type LoanTerms,
} from "./loan-schedule";

/** 200 000 € at 3.5 % over twenty years: 1 159,92 € a month at any bank. */
const BASE: LoanTerms = {
  kind: "amortising",
  principal: 200_000,
  annualRate: 0.035,
  months: 240,
  firstPaymentOn: "2025-01-05",
  insuranceMonthly: 0,
  insuranceRate: null,
  deferralMonths: 0,
  deferralKind: "none",
  known: null,
};

function sum(values: number[]): number {
  return (
    Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
  );
}

describe("cents", () => {
  it("rounds half away from zero, whatever the float says", () => {
    expect(cents(291.665)).toBe(291.67);
    expect(cents(1.005)).toBe(1.01);
    expect(cents(-583.335)).toBe(-583.34);
    expect(cents(0.004)).toBe(0);
    expect(Object.is(cents(-0.004), 0)).toBe(true);
  });
});

describe("loanSchedule", () => {
  it("repays a constant-payment loan in as many payments as months", () => {
    const rows = loanSchedule(BASE);

    expect(rows).toHaveLength(240);
    expect(rows[0]).toMatchObject({
      index: 1,
      on: "2025-01-05",
      interest: 583.33,
      principal: 576.59,
      payment: 1159.92,
      outstanding: 199_423.41,
    });
    expect(rows.at(-1)).toMatchObject({ on: "2044-12-05", outstanding: 0 });
  });

  it("repays exactly the principal, the last payment taking the rounding", () => {
    const rows = loanSchedule(BASE);

    expect(sum(rows.map((row) => row.principal))).toBe(200_000);
    expect(rows.slice(0, -1).every((row) => row.payment === 1159.92)).toBe(
      true,
    );
    expect(Math.abs(rows.at(-1)!.payment - 1159.92)).toBeLessThan(1);
  });

  it("charges no interest at 0 %, as a PTZ does", () => {
    const rows = loanSchedule({ ...BASE, principal: 40_000, annualRate: 0 });

    expect(rows[0]!.payment).toBe(166.67);
    expect(rows.at(-1)!.payment).toBe(165.87);
    expect(sum(rows.map((row) => row.interest))).toBe(0);
  });

  it("writes no negative zero through a total deferral at 0 %", () => {
    const rows = loanSchedule({
      ...BASE,
      principal: 40_000,
      annualRate: 0,
      months: 246,
      deferralMonths: 6,
      deferralKind: "total",
    });

    expect(Object.is(rows[0]!.principal, 0)).toBe(true);
    expect(rows[6]!.payment).toBe(166.67);
  });

  it("pays only interest on an in fine loan, and the principal with the last", () => {
    const rows = loanSchedule({
      ...BASE,
      kind: "in_fine",
      principal: 100_000,
      annualRate: 0.04,
      months: 120,
    });

    expect(rows).toHaveLength(120);
    expect(rows.slice(0, -1).every((row) => row.principal === 0)).toBe(true);
    expect(rows[0]).toMatchObject({ payment: 333.33, outstanding: 100_000 });
    expect(rows.at(-1)).toMatchObject({ payment: 100_333.33, outstanding: 0 });
  });

  it("pays interest only through a partial deferral, then amortises the rest", () => {
    const rows = loanSchedule({
      ...BASE,
      months: 252,
      deferralMonths: 12,
      deferralKind: "partial",
    });

    expect(rows).toHaveLength(252);
    expect(rows.slice(0, 12).every((row) => row.payment === 583.33)).toBe(true);
    expect(rows[11]!.outstanding).toBe(200_000);
    expect(rows[12]!.payment).toBe(1159.92);
    expect(rows.at(-1)!.outstanding).toBe(0);
    expect(
      regularPayment(
        { ...BASE, months: 252, deferralMonths: 12, deferralKind: "partial" },
        rows,
      ),
    ).toMatchObject({ index: 13, on: "2026-01-05" });
  });

  it("adds the interest to what is owed through a total deferral", () => {
    const rows = loanSchedule({
      ...BASE,
      months: 246,
      deferralMonths: 6,
      deferralKind: "total",
    });

    expect(rows[0]).toMatchObject({
      payment: 0,
      interest: 583.33,
      principal: -583.33,
      outstanding: 200_583.33,
    });
    // Compounded month by month, each month rounded: 203 525,62 € unrounded.
    expect(Math.abs(rows[5]!.outstanding - 203_525.62)).toBeLessThan(0.05);
    expect(rows[6]!.payment).toBeGreaterThan(1159.92);
    expect(sum(rows.map((row) => row.principal))).toBe(200_000);
    expect(rows.at(-1)!.outstanding).toBe(0);
  });

  it("charges a fixed insurance every month", () => {
    const terms = { ...BASE, insuranceMonthly: 45 };
    const rows = loanSchedule(terms);

    expect(rows.every((row) => row.insurance === 45)).toBe(true);
    expect(monthlyOutlay(terms, rows)).toBe(1204.92);
  });

  it("charges insurance on what is still owed when it follows it down", () => {
    const rows = loanSchedule({ ...BASE, insuranceRate: 0.0036 });

    expect(rows[0]!.insurance).toBe(60);
    expect(rows[1]!.insurance).toBe(59.83);
    expect(rows.at(-1)!.insurance).toBeLessThan(1);
  });

  it("pays on the month's last day when the month is shorter", () => {
    const rows = loanSchedule({ ...BASE, firstPaymentOn: "2024-01-31" });

    expect(rows.slice(0, 4).map((row) => row.on)).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
      "2024-04-30",
    ]);
  });

  describe("from a figure the bank gave", () => {
    const original = loanSchedule(BASE);
    // Five years in, 20 000 € repaid early.
    const owed = Math.round((original[59]!.outstanding - 20_000) * 100) / 100;

    it("keeps the payment and ends sooner", () => {
      const rows = loanSchedule({
        ...BASE,
        known: { outstanding: owed, on: "2029-12-10", keeps: "payment" },
      });

      expect(rows.slice(0, 60)).toEqual(original.slice(0, 60));
      expect(rows[60]).toMatchObject({ on: "2030-01-05", payment: 1159.92 });
      expect(rows.length).toBeLessThan(240);
      expect(rows.at(-1)!.outstanding).toBe(0);
      expect(sum(rows.slice(60).map((row) => row.principal))).toBe(owed);
    });

    it("keeps the end and pays less", () => {
      const rows = loanSchedule({
        ...BASE,
        known: { outstanding: owed, on: "2029-12-10", keeps: "term" },
      });

      expect(rows).toHaveLength(240);
      expect(rows[60]!.payment).toBeLessThan(1159.92);
      expect(rows.at(-1)).toMatchObject({ on: "2044-12-05", outstanding: 0 });
    });

    it("stops at a loan repaid in full", () => {
      const rows = loanSchedule({
        ...BASE,
        known: { outstanding: 0, on: "2029-12-10", keeps: "payment" },
      });

      expect(rows).toHaveLength(60);
    });

    it("keeps the end when the payment would no longer cover the interest", () => {
      const rows = loanSchedule({
        ...BASE,
        known: { outstanding: 1_000_000, on: "2029-12-10", keeps: "payment" },
      });

      expect(rows).toHaveLength(240);
      expect(rows.at(-1)!.outstanding).toBe(0);
    });
  });
});

describe("outstandingOn", () => {
  const rows = loanSchedule(BASE);

  it("is the principal before the first payment", () => {
    expect(outstandingOn(BASE, rows, "2024-12-31")).toBe(200_000);
  });

  it("counts a payment from its own day", () => {
    expect(outstandingOn(BASE, rows, "2025-01-04")).toBe(200_000);
    expect(outstandingOn(BASE, rows, "2025-01-05")).toBe(199_423.41);
  });

  it("is the bank's figure from its day until the next payment", () => {
    const terms: LoanTerms = {
      ...BASE,
      known: { outstanding: 150_000, on: "2029-12-10", keeps: "payment" },
    };
    const anchored = loanSchedule(terms);

    expect(outstandingOn(terms, anchored, "2029-12-09")).toBe(
      rows[59]!.outstanding,
    );
    expect(outstandingOn(terms, anchored, "2029-12-10")).toBe(150_000);
    expect(outstandingOn(terms, anchored, "2030-01-04")).toBe(150_000);
    expect(outstandingOn(terms, anchored, "2030-01-05")).toBeLessThan(150_000);
  });

  it("is nothing once the loan is repaid", () => {
    expect(outstandingOn(BASE, rows, "2050-01-01")).toBe(0);
  });
});

describe("nextPayment", () => {
  const rows = loanSchedule(BASE);

  it("is the payment due today or the first after it", () => {
    expect(nextPayment(rows, "2025-01-05")?.index).toBe(1);
    expect(nextPayment(rows, "2025-01-06")?.index).toBe(2);
  });

  it("is null once the loan is repaid", () => {
    expect(nextPayment(rows, "2045-01-01")).toBeNull();
  });
});

describe("loanTotals", () => {
  it("adds interest, insurance and fees into what borrowing costs", () => {
    const rows = loanSchedule({ ...BASE, insuranceMonthly: 45 });
    const totals = loanTotals(rows, 1500);

    expect(Math.abs(totals.interest - (240 * 1159.92 - 200_000))).toBeLessThan(
      1,
    );
    expect(totals.insurance).toBe(240 * 45);
    expect(totals.cost).toBe(
      Math.round((totals.interest + totals.insurance + 1500) * 100) / 100,
    );
    expect(totals.endsOn).toBe("2044-12-05");
  });
});
