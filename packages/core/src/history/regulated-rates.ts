/**
 * The regulated savings accounts' rates, every change since 1969.
 *
 * Written by hand: a regulated rate is a public decision (an arrêté, and
 * since 2008 the Banque de France's proposal taken up by the minister), so
 * the history is a short list of dated facts rather than a series to
 * download. Read from the Banque de France's MIR1 series as two independent
 * compilations give them, line by line; where they differed, the line that
 * follows the rule in force at the time was kept.
 *
 * The LDDS has no table of its own. Its rate has been the Livret A's since
 * 2003 (Banque de France), and the Codevi's, before, was the Livret A's at
 * every date found: 7,5 % when it opened in October 1983, 4,5 % from 1986
 * to 1996.
 *
 * A change takes effect on the 1st or the 16th: interest runs by quinzaine,
 * so a month changed on the 16th earns half a month at each rate.
 */

import { addMonths, monthsBetween, type HistoryMonth } from "./month";

/** `[first day in force, yearly rate]`, oldest first. */
type RateChanges = readonly (readonly [string, number])[];

export const LIVRET_A_RATES: RateChanges = [
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

/**
 * The LEP, opened in June 1982. One compilation skips August 2014; the
 * other's 1,5 % there is the Livret A's 1 % plus the half point the rule
 * then added, as every neighbouring line is.
 */
export const LEP_RATES: RateChanges = [
  ["1982-06-01", 0.085],
  ["1984-08-16", 0.075],
  ["1985-07-01", 0.07],
  ["1986-05-16", 0.055],
  ["1996-03-01", 0.0475],
  ["1999-08-01", 0.04],
  ["2000-07-01", 0.0425],
  ["2004-08-01", 0.0325],
  ["2005-08-01", 0.03],
  ["2006-02-01", 0.0325],
  ["2006-08-01", 0.0375],
  ["2007-08-01", 0.04],
  ["2008-02-01", 0.0425],
  ["2008-08-01", 0.045],
  ["2009-02-01", 0.03],
  ["2009-05-01", 0.0225],
  ["2009-08-01", 0.0175],
  ["2010-08-01", 0.0225],
  ["2011-02-01", 0.025],
  ["2011-08-01", 0.0275],
  ["2013-02-01", 0.0225],
  ["2013-08-01", 0.0175],
  ["2014-08-01", 0.015],
  ["2015-08-01", 0.0125],
  ["2020-02-01", 0.01],
  ["2022-02-01", 0.022],
  ["2022-08-01", 0.046],
  ["2023-02-01", 0.061],
  ["2023-08-01", 0.06],
  ["2024-02-01", 0.05],
  ["2024-08-01", 0.04],
  ["2025-02-01", 0.035],
  ["2025-08-01", 0.027],
  ["2026-02-01", 0.025],
];

/** The yearly rate in force on a given day, `YYYY-MM-DD`. */
export function rateOn(rates: RateChanges, day: string): number {
  let rate = rates[0][1];
  for (const [from, value] of rates) {
    if (from > day) {
      break;
    }
    rate = value;
  }
  return rate;
}

/**
 * Each month's return: half a month at the rate of the 1st and half at the
 * rate of the 16th, each compounded so that a whole year at one rate returns
 * exactly that rate, as the yearly crediting does.
 */
export function regulatedMonthlyReturns(
  rates: RateChanges,
  from: HistoryMonth,
  to: HistoryMonth,
): number[] {
  const count = monthsBetween(from, to) + 1;
  return Array.from({ length: count }, (_, index) => {
    const month = addMonths(from, index);
    const first = rateOn(rates, `${month}-01`);
    const second = rateOn(rates, `${month}-16`);
    return Math.sqrt((1 + first) ** (1 / 12) * (1 + second) ** (1 / 12)) - 1;
  });
}
