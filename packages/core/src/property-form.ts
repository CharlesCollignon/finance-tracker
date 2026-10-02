/**
 * What both apps' property forms do to what was typed before the schemas
 * see it: the same few readings, written once so a property added on the
 * phone and one added on the web are read alike.
 */

import { INTL_LOCALES, type Locale } from "./i18n/locale";

/** The fields the home answers for, then the purchase: one step each. */
export const HOME_FIELDS = [
  "name",
  "kind",
  "usage",
  "rooms",
  "energyClass",
  "livingArea",
  "ownershipShare",
  "citycode",
  "postcode",
  "latitude",
  "longitude",
] as const;

/** The classes a DPE gives, best first. */
export const ENERGY_CLASSES = ["A", "B", "C", "D", "E", "F", "G"] as const;

export const PURCHASE_FIELDS = [
  "purchasedOn",
  "purchasePrice",
  "notaryFees",
  "agencyFees",
  "works",
] as const;

/** A form's errors by field, as message keys: the first issue for each. */
export function errorsByField(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issue.message;
  }
  return errors;
}

/** A stored figure as a field shows it: « 52,5 », without grouping. */
export function fieldText(value: number, locale: Locale, digits = 2): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
}

/** Whole months from years as typed, « 20 » or « 12,5 »; "" when unreadable. */
export function monthsFromYears(years: string): number | "" {
  const parsed = Number(years.replace(",", ".").trim());
  return years.trim() && Number.isFinite(parsed) ? Math.round(parsed * 12) : "";
}

/**
 * The same day a month later, or the month's last day when it is shorter:
 * where a loan's first payment usually falls after the purchase.
 */
export function aMonthAfter(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month!, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day!, last));
  return target.toISOString().slice(0, 10);
}

/**
 * What a new property is called until the user names it: its kind and its
 * place — « Appartement Paris 11e », the arrondissement said the short way.
 */
export function defaultPropertyName(
  kindLabel: string,
  place: { city: string; district: string | null } | null,
): string {
  const where = place?.city
    ? (place.district ?? place.city).replace(/ Arrondissement$/, "")
    : "";
  return [kindLabel, where].filter(Boolean).join(" ");
}
