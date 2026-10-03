/**
 * A property let out: what comes in, what goes out, what is left each
 * month, the yield — and whether the law still lets it be let, by its DPE.
 *
 * The rent is the income templates attached to the property, its charges
 * the expense ones (taxe foncière, copropriété, insurance), and its loans
 * their schedule, not their template, so a loan's payment is counted once
 * whether or not the user keeps it among their recurring entries. Every
 * figure is the user's: templates are what reaches or leaves their own
 * account, and a loan is counted at their share of it.
 *
 * Facts only. The yield leaves out tax and borrowing, as French listings
 * quote it; nothing here says whether a rent is high or a yield good.
 */

import { cents, loanSchedule, monthlyOutlay } from "./loan-schedule";
import { loanTermsFromRow } from "./property";
import type { Recurrence } from "./recurrence";
import type {
  CategoryType,
  EnergyClass,
  PropertyLoan,
  PropertyUsage,
} from "./types/database";

/** Let unfurnished or furnished: what this module is about. */
export function isLet(usage: PropertyUsage): boolean {
  return usage === "rental_bare" || usage === "rental_furnished";
}

/** A template's amount as a month's worth: a year's divided by twelve. */
export function monthlyEquivalent(
  amount: number,
  recurrence: Recurrence,
): number {
  if (recurrence === "weekly") {
    return (amount * 52) / 12;
  }
  if (recurrence === "yearly") {
    return amount / 12;
  }
  return amount;
}

/** What a property's figures need of a recurring template. */
export interface PropertyTemplate {
  id: string;
  amount: number;
  recurrence: Recurrence;
  active: boolean;
  endsOn: string | null;
  /** On the property, not only paying one of its loans. */
  attached: boolean;
  categoryType: CategoryType;
}

export interface RentalFigures {
  /** Rent, and any other income attached to it, a month. */
  rent: number;
  /** Its own charges a month: everything attached but its loans. */
  charges: number;
  /** What its running loans take a month, payment and insurance. */
  loans: number;
  /** What is left a month once all of it is paid; negative when it costs. */
  cashFlow: number;
  /** A year's rent over what the property cost; null without either. */
  grossYield: number | null;
  /** A year's rent less its charges, over the same. */
  netYield: number | null;
}

/**
 * A let property's month. `cost` is the user's part of what it cost —
 * price, fees and works — which the yield is measured against.
 */
export function rentalFigures(
  loans: readonly PropertyLoan[],
  templates: readonly PropertyTemplate[],
  cost: number,
  today: string,
): RentalFigures {
  // A loan's own templates — its payment, and its insurance debited apart —
  // are the loan, counted below from its schedule.
  const paidThrough = new Set(
    loans.flatMap((loan) => [
      loan.recurring_template_id,
      loan.insurance_template_id,
    ]),
  );
  const running = templates.filter(
    (template) =>
      template.attached &&
      template.active &&
      (template.endsOn === null || template.endsOn >= today),
  );
  const sum = (type: CategoryType) =>
    running
      .filter(
        (template) =>
          template.categoryType === type && !paidThrough.has(template.id),
      )
      .reduce(
        (total, template) =>
          total + monthlyEquivalent(template.amount, template.recurrence),
        0,
      );

  const rent = cents(sum("income"));
  const charges = cents(sum("expense"));
  const loanOutlay = cents(
    loans.reduce((total, loan) => {
      const terms = loanTermsFromRow(loan);
      const schedule = loanSchedule(terms);
      const last = schedule.at(-1);
      return last && last.on >= today
        ? total + monthlyOutlay(terms, schedule) * Number(loan.borrower_share)
        : total;
    }, 0),
  );
  const measurable = rent > 0 && cost > 0;
  return {
    rent,
    charges,
    loans: loanOutlay,
    cashFlow: cents(rent - charges - loanOutlay),
    grossYield: measurable ? (rent * 12) / cost : null,
    netYield: measurable ? ((rent - charges) * 12) / cost : null,
  };
}

/** The rent a month over the living area, when there is one. */
export function rentPerM2(rent: number, livingArea: number | null): number | null {
  return livingArea && livingArea > 0 && rent > 0
    ? cents(rent / livingArea)
    : null;
}

/**
 * When a home of each class may no longer be let, 2026: from that day it
 * can be given no new lease, and none renewed or tacitly renewed (loi
 * Climat et Résilience, 2021, art. 160; a lease under way runs its term).
 * Overseas — Guadeloupe, Martinique, Guyane, La Réunion, Mayotte — the
 * calendar is three years later and stops at F. On the mainland, the rent
 * of an F or G home may not rise, at its yearly review, a renewal or a new
 * let, since 24 August 2022 (art. 159).
 *
 * Checked October 2026 (service-public.fr, ecologie.gouv.fr). The « Relance
 * du logement » bill, adopted by the Senate on 8 July 2026 and before the
 * Assembly since September, would let an F or G home be let again against a
 * works contract: revisit when it is law, and each January.
 */
export const FRENCH_LETTING_2026 = {
  mainland: { G: "2025-01-01", F: "2028-01-01", E: "2034-01-01" },
  overseas: { G: "2028-01-01", F: "2031-01-01" },
  rentFrozenSince: "2022-08-24",
} as const;

/** The overseas departments the calendar names, by INSEE code. */
const OVERSEAS = ["971", "972", "973", "974", "976"];

export type LettingStatus =
  /** No class recorded: nothing to say yet. */
  | { kind: "unknown" }
  /** No date for its class. */
  | { kind: "open" }
  /** It may be let until `on`. */
  | { kind: "closing"; on: string }
  /** It may no longer be let since `since`. */
  | { kind: "closed"; since: string };

export interface LettingRule {
  status: LettingStatus;
  /** Its rent may not be raised. */
  rentFrozen: boolean;
}

/**
 * What the calendar says of a home of this class, here, on `today`. Null in
 * the overseas collectivities the calendar does not name (Saint-Pierre-et-
 * Miquelon, Saint-Barthélemy, Saint-Martin). A home with no commune is read
 * as on the mainland, where nearly all of them are.
 */
export function lettingRule(
  energyClass: EnergyClass | null,
  citycode: string | null,
  today: string,
): LettingRule | null {
  const department = citycode?.startsWith("97") ? citycode.slice(0, 3) : null;
  if (department && !OVERSEAS.includes(department)) {
    return null;
  }
  const overseas = department !== null;
  if (energyClass === null) {
    return { status: { kind: "unknown" }, rentFrozen: false };
  }
  const dates: Partial<Record<EnergyClass, string>> = overseas
    ? FRENCH_LETTING_2026.overseas
    : FRENCH_LETTING_2026.mainland;
  const from = dates[energyClass];
  return {
    status: !from
      ? { kind: "open" }
      : from <= today
        ? { kind: "closed", since: from }
        : { kind: "closing", on: from },
    rentFrozen: !overseas && (energyClass === "F" || energyClass === "G"),
  };
}
