import { formatMonthShortYear } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { Key } from "@finance/core/i18n/t";
import type { PropertyKind, PropertyUsage } from "@finance/core/types/database";

/** What a property is called by kind, in the reader's language. */
export const PROPERTY_KIND_KEYS: Record<PropertyKind, Key> = {
  apartment: "property.kindApartment",
  house: "property.kindHouse",
  other: "property.kindOther",
};

/**
 * « oct. 2046 »: a purchase, an estimate or a last payment is placed by its
 * month and year, and a day without its year reads as this one.
 */
export function monthAndYear(isoDate: string, locale: Locale): string {
  return formatMonthShortYear(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)),
    locale,
  );
}

export const PROPERTY_USAGE_KEYS: Record<PropertyUsage, Key> = {
  main_home: "property.usageMainHome",
  second_home: "property.usageSecondHome",
  rental_bare: "property.usageRentalBare",
  rental_furnished: "property.usageRentalFurnished",
};
