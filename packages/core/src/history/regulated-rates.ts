/**
 * The Livret A's rate, every change since 1969.
 *
 * Written by hand: the rate is a public decision (an arrêté, and since 2008
 * the Banque de France's proposal taken up by the minister), so the history
 * is a short list of dated facts rather than a series to download. Read from
 * the Banque de France's series « Taux du Livret A » (Webstat, MIR1) and
 * checked line by line against a second compilation of the same arrêtés.
 *
 * A change takes effect on the 1st or the 16th: interest runs by quinzaine,
 * so a month changed on the 16th earns half a month at each rate.
 */

import { addMonths, monthsBetween, type HistoryMonth } from "./month";

/** `[first day in force, yearly rate]`, oldest first. */
export const LIVRET_A_RATES: readonly (readonly [string, number])[] = [
  ["1969-06-01", 0.04],
  ["1970-07-01", 0.0425],
  ["1974-01-01", 0.06],
  ["1974-07-01", 0.065],
  ["1975-01-01", 0.075],
  ["1976-01-01", 0.065],
  ["1980-04-01", 0.075],
  ["1981-10-16", 0.085],
  ["1983-08-01", 0.075],
  ["1984-08-16", 0.065],
  ["1985-07-01", 0.06],
  ["1986-05-16", 0.045],
  ["1996-03-01", 0.035],
  ["1998-06-16", 0.03],
  ["1999-08-01", 0.0225],
  ["2000-07-01", 0.03],
  ["2003-08-01", 0.0225],
  ["2005-08-01", 0.02],
  ["2006-02-01", 0.0225],
  ["2006-08-01", 0.0275],
  ["2007-08-01", 0.03],
  ["2008-02-01", 0.035],
  ["2008-08-01", 0.04],
  ["2009-02-01", 0.025],
  ["2009-05-01", 0.0175],
  ["2009-08-01", 0.0125],
  ["2010-08-01", 0.0175],
  ["2011-02-01", 0.02],
  ["2011-08-01", 0.0225],
  ["2013-02-01", 0.0175],
  ["2013-08-01", 0.0125],
  ["2014-08-01", 0.01],
  ["2015-08-01", 0.0075],
  ["2020-02-01", 0.005],
  ["2022-02-01", 0.01],
  ["2022-08-01", 0.02],
  ["2023-02-01", 0.03],
  ["2025-02-01", 0.024],
  ["2025-08-01", 0.017],
  ["2026-02-01", 0.015],
  ["2026-08-01", 0.017],
];

/** The yearly rate in force on a given day, `YYYY-MM-DD`. */
export function livretARateOn(day: string): number {
  let rate = LIVRET_A_RATES[0][1];
  for (const [from, value] of LIVRET_A_RATES) {
    if (from > day) {
      break;
    }
    rate = value;
  }
  return rate;
}

/**
 * A month's return on the Livret A: half a month at the rate of the 1st and
 * half at the rate of the 16th, each compounded so that a whole year at one
 * rate returns exactly that rate, as the yearly crediting does.
 */
export function livretAMonthlyReturns(
  from: HistoryMonth,
  to: HistoryMonth,
): number[] {
  const count = monthsBetween(from, to) + 1;
  return Array.from({ length: count }, (_, index) => {
    const month = addMonths(from, index);
    const first = livretARateOn(`${month}-01`);
    const second = livretARateOn(`${month}-16`);
    return (
      Math.sqrt((1 + first) ** (1 / 12) * (1 + second) ** (1 / 12)) - 1
    );
  });
}
