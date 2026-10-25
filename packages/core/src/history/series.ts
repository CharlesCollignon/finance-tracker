/**
 * What markets, prices and savings accounts actually did, month by month
 * since January 1970: the history the Plan replays a reader's own accounts
 * on (docs/plans/PLAN_REDESIGN_PLAN.md).
 *
 * Kept in git, as `etf-shortlist.ts` is, rather than fetched at runtime:
 * a figure here shows up in a diff with a person's name on it, nothing can
 * poison it, and it costs nothing to read on either app. The numbers come
 * from `scripts/history-refresh.mjs`, run once a year; the regulated
 * accounts' rates are written by hand in `./regulated-rates`, because they
 * are a short list of public decisions rather than a series.
 *
 * Every series is a run of monthly returns in euros — francs before 1999,
 * at the 6,55957 they were converted at — so that a month of shares, a month
 * of bonds and a month of the Livret A can be added up, and set against a
 * month of prices.
 */

import { GENERATED } from "./data.generated";
import { monthsBetween, type HistoryMonth } from "./month";
import {
  LEP_RATES,
  LIVRET_A_RATES,
  regulatedMonthlyReturns,
} from "./regulated-rates";

export type HistorySeriesId =
  /** French consumer prices (INSEE), the deflator for everything else. */
  | "cpi-fr"
  /** Developed-market shares, dividends reinvested. */
  | "world"
  /** United States shares, the whole market, dividends reinvested. */
  | "us"
  /** European shares, dividends reinvested. */
  | "europe"
  /** A ten-year French government bond held at constant maturity. */
  | "bonds-fr"
  /** The average fonds euros, net of management fees, before social levies. */
  | "fonds-euros"
  /** Bitcoin in euros, from November 2014. */
  | "bitcoin"
  /** The Livret A — and the LDDS, which has the same rate. */
  | "livret-a"
  /** The LEP, from June 1982. */
  | "lep";

type HandWritten = "livret-a" | "lep";

export const HISTORY_SERIES_IDS: readonly HistorySeriesId[] = [
  "cpi-fr",
  "world",
  "us",
  "europe",
  "bonds-fr",
  "fonds-euros",
  "bitcoin",
  "livret-a",
  "lep",
];

/** The first month any series can start at. */
export const HISTORY_START: HistoryMonth = "1970-01";

/** The last month of every series: the last full year the refresh read. */
export const HISTORY_END: HistoryMonth = GENERATED.end;

export interface HistorySeries {
  id: HistorySeriesId;
  /** The first month with a return. */
  start: HistoryMonth;
  /** Always `HISTORY_END`: the series move together to the same month. */
  end: HistoryMonth;
  /** One return per month from `start` to `end`, as a fraction: 0.01 is 1 %. */
  returns: readonly number[];
  /**
   * Through this month the series is a reconstruction rather than the
   * source's own figures (see `HISTORY_SOURCES`); null when it never is.
   */
  reconstructedUntil: HistoryMonth | null;
}

/** The shape `scripts/history-refresh.mjs` writes. */
export interface GeneratedHistory {
  /** The last month every series reaches. */
  end: HistoryMonth;
  /** The day the refresh ran, `YYYY-MM-DD`. */
  refreshed: string;
  /**
   * The yearly dividend yield added to the OECD's price-only share indices
   * outside the United States, before each country's own figures begin in
   * 1986: matched so that, over the years both exist, the prices return
   * what the countries' own figures do.
   */
  dividends: { exUs: number; europe: number };
  series: Record<
    Exclude<HistorySeriesId, HandWritten>,
    {
      start: HistoryMonth;
      reconstructedUntil: HistoryMonth | null;
      /** Monthly returns in hundred-thousandths, one row per calendar year. */
      e5: readonly (readonly number[])[];
    }
  >;
}

/** The regulated accounts, and the month each opened. */
const HAND_WRITTEN: Record<
  HandWritten,
  { rates: typeof LIVRET_A_RATES; start: HistoryMonth }
> = {
  "livret-a": { rates: LIVRET_A_RATES, start: HISTORY_START },
  lep: { rates: LEP_RATES, start: "1982-06" },
};

const cache = new Map<HistorySeriesId, HistorySeries>();

/** One series, decoded once and kept. */
export function historySeries(id: HistorySeriesId): HistorySeries {
  const known = cache.get(id);
  if (known) {
    return known;
  }
  const series: HistorySeries =
    id === "livret-a" || id === "lep"
      ? {
          id,
          start: HAND_WRITTEN[id].start,
          end: HISTORY_END,
          returns: regulatedMonthlyReturns(
            HAND_WRITTEN[id].rates,
            HAND_WRITTEN[id].start,
            HISTORY_END,
          ),
          reconstructedUntil: null,
        }
      : {
          id,
          start: GENERATED.series[id].start,
          end: HISTORY_END,
          returns: GENERATED.series[id].e5.flat().map((value) => value / 1e5),
          reconstructedUntil: GENERATED.series[id].reconstructedUntil,
        };
  cache.set(id, series);
  return series;
}

/** The series' return in `month`, or null outside it. */
export function returnIn(
  series: HistorySeries,
  month: HistoryMonth,
): number | null {
  const index = monthsBetween(series.start, month);
  return index >= 0 && index < series.returns.length
    ? series.returns[index]
    : null;
}
