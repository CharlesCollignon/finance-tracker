/**
 * A property's figures: what it cost, what it is worth today and on whose
 * word, and what of it is the user's once their share and their loans are
 * counted.
 *
 * Every amount on a property is the whole property's, as on the deed. The
 * user's part of it is its ownership share, and their part of a loan its
 * borrower share, so two people who bought together type the same figures
 * and each sees their own. Net value is the user's part of the value less
 * their part of what the loans still owe.
 */

import { DEFAULT_CATEGORIES } from "./constants";
import type { Locale } from "./i18n/locale";
import {
  cents,
  loanSchedule,
  outstandingOn,
  type LoanPayment,
  type LoanTerms,
} from "./loan-schedule";
import type { Property, PropertyLoan } from "./types/database";

/** A loan row's terms, as the schedule reads them. */
export function loanTermsFromRow(row: PropertyLoan): LoanTerms {
  return {
    kind: row.kind,
    principal: Number(row.principal),
    annualRate: Number(row.annual_rate),
    months: row.months,
    firstPaymentOn: row.first_payment_on,
    insuranceMonthly: Number(row.insurance_monthly),
    insuranceRate:
      row.insurance_rate === null ? null : Number(row.insurance_rate),
    deferralMonths: row.deferral_months,
    deferralKind: row.deferral_kind,
    known:
      row.known_outstanding === null ||
      row.known_outstanding_on === null ||
      row.known_keeps === null
        ? null
        : {
            outstanding: Number(row.known_outstanding),
            on: row.known_outstanding_on,
            keeps: row.known_keeps,
          },
  };
}

/**
 * The default category a loan's payment is filed under, in the reader's
 * language: « Remboursement de prêt », found under either name when the
 * user already has it.
 */
export function loanPaymentCategoryName(locale: Locale): string {
  const category = DEFAULT_CATEGORIES.find(
    (candidate) => candidate.names.fr === "Remboursement de prêt",
  );
  return category ? category.names[locale] : "Remboursement de prêt";
}

/**
 * Notary fees as a share of the price: about 7–8 % for an existing home,
 * transfer duties included, and 2–3 % for a new one. A place to start in
 * the form, which the user replaces with the real figure from the deed.
 */
export const NOTARY_FEE_ESTIMATE = { existing: 0.075, new: 0.025 } as const;

export function notaryFeesEstimate(
  price: number,
  build: keyof typeof NOTARY_FEE_ESTIMATE,
): number {
  return Math.round(price * NOTARY_FEE_ESTIMATE[build]);
}

type PurchaseFigures = Pick<
  Property,
  "purchase_price" | "notary_fees" | "agency_fees" | "works"
>;

/** The price and everything paid to have it: the whole property's. */
export function acquisitionCost(property: PurchaseFigures): number {
  return cents(
    Number(property.purchase_price) +
      Number(property.notary_fees) +
      Number(property.agency_fees) +
      Number(property.works),
  );
}

/**
 * Where an estimated value comes from: the user's own figure, or what was
 * paid. The market reading and the price index come before the purchase
 * price once there are any (docs/plans/REAL_ESTATE_PLAN.md, Phase 4).
 */
export type ValueSource =
  { kind: "own"; on: string } | { kind: "purchase"; on: string };

export interface EstimatedValue {
  /** The whole property's. */
  value: number;
  source: ValueSource;
}

export function estimatedValue(
  property: Pick<
    Property,
    "purchase_price" | "purchased_on" | "value_pinned" | "value_pinned_on"
  >,
): EstimatedValue {
  if (property.value_pinned !== null && property.value_pinned_on !== null) {
    return {
      value: Number(property.value_pinned),
      source: { kind: "own", on: property.value_pinned_on },
    };
  }
  return {
    value: Number(property.purchase_price),
    source: { kind: "purchase", on: property.purchased_on },
  };
}

export interface PropertyPosition {
  estimate: EstimatedValue;
  /** The user's part of the estimated value. */
  value: number;
  /** The user's part of what the loans still owe. */
  owed: number;
  /** Their part of the value less their part of what is owed. */
  netValue: number;
  /** The user's part of the acquisition cost. */
  cost: number;
  /** Their part of the value less their part of what it cost. */
  unrealisedGain: number;
  /**
   * The user's part of what the payments have paid the loans down by: what
   * they added to the net value. Nothing while interest is still being
   * added to what is owed.
   */
  principalRepaid: number;
}

/** Where a property stands on `day`, for the user. */
export function propertyPosition(
  property: Property,
  loans: readonly PropertyLoan[],
  day: string,
): PropertyPosition {
  const share = Number(property.ownership_share);
  const estimate = estimatedValue(property);
  const value = cents(estimate.value * share);

  let owed = 0;
  let principalRepaid = 0;
  for (const loan of loans) {
    const terms = loanTermsFromRow(loan);
    const outstanding = outstandingOn(terms, loanSchedule(terms), day);
    const part = Number(loan.borrower_share);
    owed += outstanding * part;
    principalRepaid += Math.max(0, terms.principal - outstanding) * part;
  }
  owed = cents(owed);

  const cost = cents(acquisitionCost(property) * share);
  return {
    estimate,
    value,
    owed,
    netValue: cents(value - owed),
    cost,
    unrealisedGain: cents(value - cost),
    principalRepaid: cents(principalRepaid),
  };
}

export interface PaymentShare {
  principal: number;
  interest: number;
  insurance: number;
  /** All three: what the user pays for the loan that month. */
  total: number;
}

/**
 * The user's part of one payment, split the way the property shows it:
 * « 1 050 € = 612 € de capital · 378 € d'intérêts · 60 € d'assurance ».
 */
export function paymentShare(
  payment: LoanPayment,
  borrowerShare: number,
): PaymentShare {
  const principal = cents(payment.principal * borrowerShare);
  const interest = cents(payment.interest * borrowerShare);
  const insurance = cents(payment.insurance * borrowerShare);
  return {
    principal,
    interest,
    insurance,
    total: cents(principal + interest + insurance),
  };
}
