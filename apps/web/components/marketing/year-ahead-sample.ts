import { formatMonthLabel } from "@finance/core/constants";
import type { Envelope } from "@finance/core/future-plan";
import type { Locale } from "@finance/core/i18n/locale";
import type { ProjectionPoint } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_INFLATION,
  YEAR_AHEAD_MAX_MONTHS,
  type YearAhead,
  type YearAheadAccountId,
} from "@finance/core/year-ahead";

/**
 * The landing sample's « Dans un an », worked out by the app's own rule
 * (`buildYearAhead`), for the Plan mock and the Plan page's demo.
 *
 * Apart from `landing-sample.ts`, which keeps no runtime edge to core so a
 * test runner can load it bare; the figures are that file's sample person:
 * the 3 200 € salary, 959 € of charges, an everyday's spending, the
 * « Emergency fund » into a Livret A, the PEA DCA, and the CTO and crypto
 * from Placements, at the long view's returns.
 */

/** The sample person's accounts, as the Plan reads them. */
export const SAMPLE_ENVELOPES: Envelope[] = [
  {
    id: "livret_a",
    initial: 2900,
    monthly: 150,
    annualReturn: 0.017,
    taxOnGains: 0,
  },
  {
    id: "pea",
    initial: 6800,
    monthly: 200,
    annualReturn: 0.07,
    taxOnGains: 0.186,
    // An MSCI World ETF's 0.2 % or so, and a little for the broker.
    fees: 0.0025,
  },
  {
    id: "cto",
    initial: 4200,
    monthly: 0,
    annualReturn: 0.07,
    taxOnGains: 0.314,
    fees: 0.003,
  },
  {
    id: "crypto",
    initial: 1480,
    monthly: 0,
    annualReturn: 0.05,
    taxOnGains: 0.314,
  },
];

/** What the current account holds on the 19th: Le point's balance. */
const ON_HAND = 2410;
const INCOME = 3200;
const COMMITTED = 959;
/** The Livret A's 150 € and the PEA's 200 €, leaving the current account. */
const SET_ASIDE = 350;
const EVERYDAY = 1500;

/** Five years of the sample's months, from April 2026. */
function samplePoints(locale: Locale): ProjectionPoint[] {
  return Array.from({ length: YEAR_AHEAD_MAX_MONTHS }, (_, index) => {
    const year = 2026 + Math.floor((3 + index) / 12);
    const month = ((3 + index) % 12) + 1;
    const left = (INCOME - COMMITTED - SET_ASIDE - EVERYDAY) * (index + 1);
    return {
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      label: formatMonthLabel(year, month, locale),
      year,
      month,
      income: INCOME,
      expense: COMMITTED,
      setAside: SET_ASIDE,
      deployed: 0,
      unrecorded: EVERYDAY,
      onHand: ON_HAND + left,
      kept: ON_HAND + left + SET_ASIDE * (index + 1),
    };
  });
}

/**
 * The sample's year ahead over `horizon` months, with an extra if one is
 * played — as the app draws it: prices rising, fees off, in today's euros
 * when asked.
 */
export function sampleYearAhead(
  locale: Locale,
  horizon = 12,
  extra?: { monthly: number; to: YearAheadAccountId },
  realTerms = false,
): { ahead: YearAhead; points: ProjectionPoint[] } {
  const points = samplePoints(locale);
  return {
    points,
    ahead: buildYearAhead({
      points,
      onHandToday: ON_HAND,
      envelopes: SAMPLE_ENVELOPES,
      horizon,
      extra,
      inflation: YEAR_AHEAD_INFLATION,
      realTerms,
    }),
  };
}
