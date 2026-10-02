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

import { DEFAULT_CATEGORIES, formatMonthShortYear } from "./constants";
import { INTL_LOCALES, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import {
  cents,
  loanSchedule,
  outstandingOn,
  type LoanPayment,
  type LoanTerms,
} from "./loan-schedule";
import type { Carry } from "./price-index";
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

/** What a property's market is known to say, read by the caller. */
export interface MarketContext {
  /** The property's market reading (migration 050), when it has one. */
  reading: {
    scope: "radius" | "commune";
    medianM2: number;
    q1M2: number;
    q3M2: number;
    sales: number;
    periodFrom: string;
    periodTo: string;
    quarter: string;
  } | null;
  /** How the purchase price moves to the latest quarter, when the index can say. */
  purchaseCarry: Carry | null;
}

/**
 * Where an estimated value comes from, in the order `CONTEXT.md` gives:
 * the user's own figure, else the market reading times the area, else the
 * purchase price carried by the price index, else the purchase price.
 */
export type ValueSource =
  | { kind: "own"; on: string }
  | {
      kind: "market";
      scope: "radius" | "commune";
      sales: number;
      periodFrom: string;
      periodTo: string;
      quarter: string;
    }
  | { kind: "indexed"; from: string; to: string }
  | { kind: "purchase"; on: string };

export interface EstimatedValue {
  /** The whole property's. */
  value: number;
  /** The market's spread, when the value is the market's: Q1 and Q3. */
  low: number | null;
  high: number | null;
  source: ValueSource;
}

/** An estimate said to the thousand: nobody knows a home to the euro. */
function toThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

export function estimatedValue(
  property: Pick<
    Property,
    | "kind"
    | "living_area"
    | "purchase_price"
    | "purchased_on"
    | "value_pinned"
    | "value_pinned_on"
  >,
  market: MarketContext | null = null,
): EstimatedValue {
  if (property.value_pinned !== null && property.value_pinned_on !== null) {
    return {
      value: Number(property.value_pinned),
      low: null,
      high: null,
      source: { kind: "own", on: property.value_pinned_on },
    };
  }
  const area = property.living_area === null ? 0 : Number(property.living_area);
  const reading = market?.reading;
  if (reading && property.kind !== "other" && area > 0) {
    return {
      value: toThousand(reading.medianM2 * area),
      low: toThousand(reading.q1M2 * area),
      high: toThousand(reading.q3M2 * area),
      source: {
        kind: "market",
        scope: reading.scope,
        sales: reading.sales,
        periodFrom: reading.periodFrom,
        periodTo: reading.periodTo,
        quarter: reading.quarter,
      },
    };
  }
  const carry = market?.purchaseCarry;
  if (carry && carry.from !== carry.to) {
    return {
      value: toThousand(Number(property.purchase_price) * carry.factor),
      low: null,
      high: null,
      source: { kind: "indexed", from: carry.from, to: carry.to },
    };
  }
  return {
    value: Number(property.purchase_price),
    low: null,
    high: null,
    source: { kind: "purchase", on: property.purchased_on },
  };
}

/** « T2 2026 », « Q2 2026 »: a quarter as the reader says it. */
export function quarterLabel(quarter: string, locale: Locale): string {
  return translator(locale)("property.quarter", {
    quarter: quarter.slice(6),
    year: quarter.slice(0, 4),
  });
}

/**
 * Where an estimate comes from, in a sentence: the long form under the
 * value on a property's page, the short one on its card in the list.
 */
export function valueSourceLine(
  source: ValueSource,
  locale: Locale,
  form: "long" | "short" = "long",
): string {
  const t = translator(locale);
  const month = (iso: string) =>
    formatMonthShortYear(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)),
      locale,
    );
  switch (source.kind) {
    case "own":
      return t("property.sourceOwn", { date: month(source.on) });
    case "purchase":
      return t("property.sourcePurchase", { date: month(source.on) });
    case "indexed":
      return form === "short"
        ? t("property.sourceIndexedShort", {
            quarter: quarterLabel(source.to, locale),
          })
        : t("property.sourceIndexed", {
            from: quarterLabel(source.from, locale),
            to: quarterLabel(source.to, locale),
          });
    case "market":
      return form === "short"
        ? t("property.sourceMarketShort", {
            quarter: quarterLabel(source.quarter, locale),
          })
        : t(
            source.scope === "radius"
              ? "property.sourceMarketRadius"
              : "property.sourceMarketCommune",
            {
              count: new Intl.NumberFormat(INTL_LOCALES[locale]).format(
                source.sales,
              ),
              from: source.periodFrom.slice(0, 4),
              to: source.periodTo.slice(0, 4),
              quarter: quarterLabel(source.quarter, locale),
            },
          );
  }
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
  market: MarketContext | null = null,
): PropertyPosition {
  const share = Number(property.ownership_share);
  const estimate = estimatedValue(property, market);
  const value = cents(estimate.value * share);

  // Each loan's part rounded on its own, so what is owed and what was repaid
  // add up to the user's share of the principal to the cent.
  let owed = 0;
  let principalRepaid = 0;
  for (const loan of loans) {
    const terms = loanTermsFromRow(loan);
    const part = Number(loan.borrower_share);
    const owedPart = cents(
      outstandingOn(terms, loanSchedule(terms), day) * part,
    );
    owed = cents(owed + owedPart);
    principalRepaid = cents(
      principalRepaid + Math.max(0, cents(terms.principal * part) - owedPart),
    );
  }

  const cost = cents(acquisitionCost(property) * share);
  return {
    estimate,
    value,
    owed,
    netValue: cents(value - owed),
    cost,
    unrealisedGain: cents(value - cost),
    principalRepaid,
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
