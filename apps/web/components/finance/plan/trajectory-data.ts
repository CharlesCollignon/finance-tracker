import { formatMonthLabel } from "@finance/core/constants";
import type { MixKey, SeriesMix } from "@finance/core/history/replay";
import type { Locale } from "@finance/core/i18n/locale";
import {
  DEFAULT_PROPERTY_GROWTH,
  projectProperty,
} from "@finance/core/property-future";
import type { PropertyRead } from "@finance/data/properties";

/**
 * The few things the Plan's cards share that are not the replay itself:
 * how a historical month and a mix read, and the homes' line.
 */

/** Prices, for the homes alone: they have no market history to replay. */
const PROPERTY_INFLATION = 0.02;

/** « mars 2009 » from `2009-03`. */
export function historyMonthLabel(month: string, locale: Locale): string {
  const [year, number] = month.split("-").map(Number);
  return formatMonthLabel(year!, number!, locale);
}

/** A mix's sources, the largest first. */
export function mixKeys(mix: SeriesMix): MixKey[] {
  return (Object.entries(mix) as [MixKey, number][])
    .filter(([, weight]) => weight > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([key]) => key);
}

/**
 * The homes' net value, month by month from today to the horizon, in
 * today's euros: each grown at its own rate, less what its loans would
 * still owe and the tax a sale would take, as their own page reckons it.
 * Between year-ends the line runs straight.
 */
export function propertyLine(
  properties: readonly PropertyRead[],
  today: string,
  months: number,
): number[] {
  const years = Math.ceil(months / 12);
  const yearly = Array.from({ length: years + 1 }, () => 0);
  for (const read of properties) {
    const growth =
      read.property.yearly_growth === null
        ? DEFAULT_PROPERTY_GROWTH
        : Number(read.property.yearly_growth);
    projectProperty(read.property, read.loans, read.market, {
      years,
      growth,
      today,
    }).forEach((year) => {
      yearly[year.year]! += year.net / (1 + PROPERTY_INFLATION) ** year.year;
    });
  }
  return Array.from({ length: months + 1 }, (_, month) => {
    const year = Math.floor(month / 12);
    const into = (month % 12) / 12;
    const from = yearly[year]!;
    const to = yearly[Math.min(year + 1, years)]!;
    return from + (to - from) * into;
  });
}
