import { describe, expect, it } from "vitest";
import { translator } from "./i18n/t";
import { loanSchedule } from "./loan-schedule";
import { loanTermsFromRow } from "./property";
import {
  halfRepaidOn,
  halfYearOf,
  isNewRelease,
  lastPaymentOn,
  loanMoment,
} from "./property-moments";
import {
  loanMomentNotification,
  marketMomentNotification,
} from "./push-messages";
import type { PropertyLoan } from "./types/database";

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
    insurance_separate: false,
    insurance_template_id: null,
    recurring_template_id: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("halfRepaidOn", () => {
  it("is the payment after which half or less is still owed", () => {
    const day = halfRepaidOn(loan());
    const schedule = loanSchedule(loanTermsFromRow(loan()));
    const index = schedule.findIndex((row) => row.on === day);
    expect(schedule[index]!.outstanding).toBeLessThanOrEqual(100_000);
    expect(schedule[index - 1]!.outstanding).toBeGreaterThan(100_000);
  });

  it("is the bank's figure when an early repayment crossed it", () => {
    expect(
      halfRepaidOn(
        loan({
          known_outstanding: 90_000,
          known_outstanding_on: "2026-03-20",
          known_keeps: "payment",
        }),
      ),
    ).toBe("2026-03-20");
  });

  it("is never for an in fine loan, which repays nothing until the end", () => {
    expect(halfRepaidOn(loan({ kind: "in_fine" }))).toBeNull();
  });
});

describe("lastPaymentOn", () => {
  it("is the schedule's last payment, or the day the bank said nothing was owed", () => {
    expect(lastPaymentOn(loan({ months: 12 }))).toBe("2025-12-05");
    expect(
      lastPaymentOn(
        loan({
          known_outstanding: 0,
          known_outstanding_on: "2026-06-15",
          known_keeps: "term",
        }),
      ),
    ).toBe("2026-06-15");
  });
});

describe("loanMoment", () => {
  it("is news for a month after the day, and not before or after", () => {
    const short = loan({ months: 12 });
    expect(loanMoment(short, "2025-12-04")).toBeNull();
    expect(loanMoment(short, "2025-12-05")).toEqual({
      kind: "last",
      on: "2025-12-05",
    });
    expect(loanMoment(short, "2026-01-04")).toEqual({
      kind: "last",
      on: "2025-12-05",
    });
    expect(loanMoment(short, "2026-01-05")).toBeNull();
  });

  it("says half repaid in the month it happened", () => {
    const day = halfRepaidOn(loan())!;
    expect(loanMoment(loan(), day)).toEqual({ kind: "half", on: day });
  });

  it("says the last payment, not half, when an early repayment made both", () => {
    expect(
      loanMoment(
        loan({
          known_outstanding: 0,
          known_outstanding_on: "2026-06-15",
          known_keeps: "term",
        }),
        "2026-06-20",
      ),
    ).toEqual({ kind: "last", on: "2026-06-15" });
  });
});

describe("isNewRelease", () => {
  it("is a reading whose sales reach a later half-year", () => {
    expect(halfYearOf("2026-06-30")).toBe("2026-H1");
    expect(halfYearOf("2026-07-01")).toBe("2026-H2");
    expect(isNewRelease("2025-12-30", "2026-06-28")).toBe(true);
    expect(isNewRelease("2025-12-30", "2025-12-31")).toBe(false);
  });

  it("is not news for a home read for the first time", () => {
    expect(isNewRelease(null, "2026-06-28")).toBe(false);
  });
});

describe("loanMomentNotification", () => {
  const voice = { t: translator("fr"), locale: "fr" as const };

  it("keys half repaid by the loan, and opens the property", () => {
    const notification = loanMomentNotification({
      ...voice,
      moment: { kind: "half", on: "2034-02-05" },
      loan: { id: "loan-1", label: "Prêt principal" },
      property: { id: "prop-1", name: "Appartement Lyon 3e" },
      owed: 99_500,
      monthly: 1160,
      endsOn: "2044-12-05",
    });
    expect(notification).toMatchObject({
      kind: "property",
      key: "property:half:loan-1",
      url: "/property/prop-1",
    });
    expect(notification.title).toBe(
      "Prêt principal : la moitié est remboursée",
    );
    expect(notification.body).toContain("Appartement Lyon 3e");
  });

  it("says what the last payment frees each month", () => {
    const notification = loanMomentNotification({
      ...voice,
      moment: { kind: "last", on: "2034-12-05" },
      loan: { id: "loan-2", label: "PTZ" },
      property: { id: "prop-1", name: "Appartement Lyon 3e" },
      owed: 0,
      monthly: 333.33,
      endsOn: "2034-12-05",
    });
    expect(notification.key).toBe("property:last:loan-2");
    expect(notification.body).toContain("5 décembre 2034");
  });
});

describe("marketMomentNotification", () => {
  it("is keyed by the half-year, so a home hears it twice a year at most", () => {
    const notification = marketMomentNotification({
      t: translator("en"),
      locale: "en",
      property: { id: "prop-1", name: "Studio Grenoble" },
      halfYear: "2026-H1",
      before: 72_000,
      after: 74_000,
    });
    expect(notification.key).toBe("property:market:prop-1:2026-H1");
    expect(notification.body).toContain("72,000");
  });
});
