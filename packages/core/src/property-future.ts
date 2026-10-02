/**
 * A property in the long view: what it could be worth in N years, what its
 * loans would still owe then, and the tax a sale would take — and, today,
 * where it stands beside the savings and investments.
 *
 * Kept apart from the long view's accounts (`future-plan.ts`) on purpose.
 * Nothing is paid into a home each month, and the home one lives in is no
 * income to draw on, so it is never in the monthly income the long view
 * gives at its withdrawal rate, nor in a milestone. It is shown beside them.
 */

import {
  cents,
  loanSchedule,
  monthlyOutlay,
  outstandingOn,
} from "./loan-schedule";
import {
  estimatedValue,
  loanTermsFromRow,
  type MarketContext,
  type PropertyPosition,
} from "./property";
import type { Property, PropertyLoan, PropertyUsage } from "./types/database";

/**
 * The tax on the gain from selling a home that is not the main one, 2026.
 *
 * Income tax at 19 % and social contributions at 17.2 % — the 2026 rise to
 * 18.6 % left property gains out (LFSS 2026, article 12) — each reduced by
 * an allowance for the years held, until nothing is due after 22 years for
 * the first and 30 for the second. The price paid is raised by the
 * acquisition fees, at least 7.5 % of it, and by the works, at least 15 % of
 * it once five years have passed. The surtax on gains above 50 000 € is not
 * counted. The main home is exempt.
 *
 * Checked October 2026 (impots.gouv.fr, service-public.fr, Finary on the
 * LFSS). Revisit each January with the finance laws.
 */
export const FRENCH_PROPERTY_GAINS_2026 = {
  incomeTax: 0.19,
  socialContributions: 0.172,
  acquisitionFeesFlat: 0.075,
  worksFlat: 0.15,
  worksFlatAfterYears: 5,
} as const;

/**
 * A home that keeps its value in today's euros, at the long view's own
 * default inflation. The user's figure, on the property, wins.
 */
export const DEFAULT_PROPERTY_GROWTH = 0.02;

/** The share of a gain each tax no longer takes, for the years held. */
export function holdingAllowance(yearsHeld: number): {
  incomeTax: number;
  social: number;
} {
  const years = Math.floor(yearsHeld);
  const incomeTax = years < 6 ? 0 : years <= 21 ? (years - 5) * 0.06 : 1;
  const social =
    years < 6
      ? 0
      : years <= 21
        ? (years - 5) * 0.0165
        : years === 22
          ? 0.28
          : Math.min(1, 0.28 + (years - 22) * 0.09);
  return {
    incomeTax: Math.min(1, incomeTax),
    social: Math.min(1, Number(social.toFixed(4))),
  };
}

/** What a sale would owe on its gain. Every figure the user's share of it. */
export function propertyGainTax(input: {
  usage: PropertyUsage;
  salePrice: number;
  purchasePrice: number;
  /** Notary and agency fees paid on purchase. */
  fees: number;
  works: number;
  yearsHeld: number;
}): number {
  if (input.usage === "main_home") {
    return 0;
  }
  const rules = FRENCH_PROPERTY_GAINS_2026;
  const fees = Math.max(
    input.fees,
    input.purchasePrice * rules.acquisitionFeesFlat,
  );
  const works =
    input.yearsHeld > rules.worksFlatAfterYears
      ? Math.max(input.works, input.purchasePrice * rules.worksFlat)
      : input.works;
  const gain = input.salePrice - (input.purchasePrice + fees + works);
  if (gain <= 0) {
    return 0;
  }
  const allowance = holdingAllowance(input.yearsHeld);
  return cents(
    gain * (1 - allowance.incomeTax) * rules.incomeTax +
      gain * (1 - allowance.social) * rules.socialContributions,
  );
}

function addYears(iso: string, years: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year! + years, month! - 1, day!));
  return date.toISOString().slice(0, 10);
}

/** Whole years from `from` to `to`, as a holding period counts them. */
function wholeYears(from: string, to: string): number {
  let years = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  if (to.slice(5) < from.slice(5)) {
    years -= 1;
  }
  return Math.max(0, years);
}

export interface PropertyYear {
  /** Years from now: 0 is today. */
  year: number;
  /** The user's part of what it would be worth. */
  value: number;
  /** The user's part of what the loans would still owe. */
  owed: number;
  /** What a sale that year would owe in tax, on the user's part. */
  tax: number;
  /** Value less what is owed and the tax: what selling would leave. */
  net: number;
}

/**
 * The property year by year to `years`: today's estimated value grown at
 * `growth` a year, less what its loans would owe then and the tax a sale
 * would take. An estimate, as the long view is: a home can lose value.
 */
export function projectProperty(
  property: Property,
  loans: readonly PropertyLoan[],
  market: MarketContext | null,
  { years, growth, today }: { years: number; growth: number; today: string },
): PropertyYear[] {
  const share = Number(property.ownership_share);
  const start = estimatedValue(property, market).value;
  const schedules = loans.map((loan) => {
    const terms = loanTermsFromRow(loan);
    return {
      terms,
      schedule: loanSchedule(terms),
      part: Number(loan.borrower_share),
    };
  });
  const purchasePrice = Number(property.purchase_price) * share;
  const fees =
    (Number(property.notary_fees) + Number(property.agency_fees)) * share;
  const works = Number(property.works) * share;

  return Array.from(
    { length: Math.max(0, Math.round(years)) + 1 },
    (_, year) => {
      const day = addYears(today, year);
      const value = cents(start * (1 + growth) ** year * share);
      const owed = cents(
        schedules.reduce(
          (total, { terms, schedule, part }) =>
            total + outstandingOn(terms, schedule, day) * part,
          0,
        ),
      );
      const tax = propertyGainTax({
        usage: property.usage,
        salePrice: value,
        purchasePrice,
        fees,
        works,
        yearsHeld: wholeYears(property.purchased_on, day),
      });
      return { year, value, owed, tax, net: cents(value - owed - tax) };
    },
  );
}

export interface NetWorth {
  /** Savings and investments, as the long view counts them today. */
  liquid: number;
  /** The user's part of what the properties are worth. */
  property: number;
  /** The user's part of what the loans still owe. */
  owed: number;
  /** All of it, less what is owed. */
  net: number;
}

/** Where everything stands today: savings, investments and properties. */
export function netWorth(
  liquid: number,
  positions: readonly PropertyPosition[],
): NetWorth {
  const property = cents(positions.reduce((total, p) => total + p.value, 0));
  const owed = cents(positions.reduce((total, p) => total + p.owed, 0));
  return { liquid, property, owed, net: cents(liquid + property - owed) };
}

export interface LoanEnding {
  label: string;
  /** The day of the last payment. */
  endsOn: string;
  /** What leaves the account each month until then, the user's share. */
  monthly: number;
}

/** The loans still running on `today`, soonest to end first. */
export function loanEndings(
  loans: readonly PropertyLoan[],
  today: string,
): LoanEnding[] {
  return loans
    .flatMap((loan): LoanEnding[] => {
      const terms = loanTermsFromRow(loan);
      const schedule = loanSchedule(terms);
      const last = schedule.at(-1);
      if (!last || last.on < today) {
        return [];
      }
      return [
        {
          label: loan.label,
          endsOn: last.on,
          monthly: cents(
            monthlyOutlay(terms, schedule) * Number(loan.borrower_share),
          ),
        },
      ];
    })
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}
