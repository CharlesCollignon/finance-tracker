import { describe, expect, it } from "vitest";
import { addMonths, monthsBetween } from "./month";
import {
  LEP_RATES,
  LIVRET_A_RATES,
  rateOn,
  regulatedMonthlyReturns,
} from "./regulated-rates";
import {
  HISTORY_END,
  HISTORY_SERIES_IDS,
  HISTORY_START,
  historySeries,
  returnIn,
  type HistorySeriesId,
} from "./series";
import { HISTORY_SOURCES } from "./sources";

/** Prices' yearly average against the year before's, as INSEE states it. */
function yearlyInflation(year: number): number {
  const series = historySeries("cpi-fr");
  let level = 1;
  const levels = series.returns.map((value) => (level *= 1 + value));
  const average = (of: number) => {
    const from = monthsBetween(series.start, `${of}-01`);
    return levels.slice(from, from + 12).reduce((sum, x) => sum + x, 0) / 12;
  };
  return average(year) / average(year - 1) - 1;
}

function calendarYear(id: HistorySeriesId, year: number): number {
  const series = historySeries(id);
  const from = monthsBetween(series.start, `${year}-01`);
  return (
    series.returns
      .slice(from, from + 12)
      .reduce((level, value) => level * (1 + value), 1) - 1
  );
}

describe("months", () => {
  it("counts and steps across years", () => {
    expect(monthsBetween("1970-01", "1970-01")).toBe(0);
    expect(monthsBetween("1999-12", "2000-01")).toBe(1);
    expect(monthsBetween("2000-01", "1999-12")).toBe(-1);
    expect(addMonths("1999-12", 1)).toBe("2000-01");
    expect(addMonths("2000-01", -13)).toBe("1998-12");
  });
});

describe("every series", () => {
  it.each(HISTORY_SERIES_IDS)("%s runs month by month to the end", (id) => {
    const series = historySeries(id);
    expect(series.end).toBe(HISTORY_END);
    expect(series.returns).toHaveLength(
      monthsBetween(series.start, HISTORY_END) + 1,
    );
    expect(series.returns.every(Number.isFinite)).toBe(true);
    expect(monthsBetween(HISTORY_START, series.start)).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("ends with a full year", () => {
    expect(HISTORY_END.endsWith("-12")).toBe(true);
  });

  it("is named by a source", () => {
    for (const id of HISTORY_SERIES_IDS) {
      expect(HISTORY_SOURCES.some((source) => source.series.includes(id))).toBe(
        true,
      );
    }
  });

  it("reads a month, and nothing outside the series", () => {
    const world = historySeries("world");
    expect(returnIn(world, world.start)).toBe(world.returns[0]);
    expect(returnIn(world, addMonths(world.start, -1))).toBeNull();
    expect(returnIn(world, addMonths(HISTORY_END, 1))).toBeNull();
  });
});

describe("French prices", () => {
  // INSEE's own yearly averages: « en moyenne annuelle ».
  it.each([
    [1974, 0.137],
    [2022, 0.052],
    [2023, 0.049],
    [2024, 0.02],
  ])("rose as INSEE says in %i", (year, published) => {
    expect(yearlyInflation(year)).toBeCloseTo(published, 3);
  });
});

describe("shares", () => {
  it("are the countries' own figures from 1986, rebuilt before", () => {
    expect(historySeries("world").reconstructedUntil).toBe("1985-12");
    expect(historySeries("europe").reconstructedUntil).toBe("1985-12");
    expect(historySeries("us").reconstructedUntil).toBeNull();
  });

  // Not a published figure: a guard against a broken refresh, wide enough
  // for any honest source and narrow enough to catch a sign or unit error.
  it("lost about a third in euros in 2008", () => {
    for (const id of ["world", "us", "europe"] as const) {
      expect(calendarYear(id, 2008)).toBeGreaterThan(-0.5);
      expect(calendarYear(id, 2008)).toBeLessThan(-0.25);
    }
  });

  it("fell in 2022 alongside bonds", () => {
    expect(calendarYear("world", 2022)).toBeLessThan(0);
    expect(calendarYear("bonds-fr", 2022)).toBeLessThan(-0.1);
  });
});

describe("the regulated accounts", () => {
  it("reads the rate in force on a day", () => {
    expect(rateOn(LIVRET_A_RATES, "1981-10-15")).toBe(0.075);
    expect(rateOn(LIVRET_A_RATES, "1981-10-16")).toBe(0.085);
    expect(rateOn(LIVRET_A_RATES, "2021-06-01")).toBe(0.005);
    expect(rateOn(LIVRET_A_RATES, "2026-09-01")).toBe(0.017);
    expect(rateOn(LEP_RATES, "2023-03-01")).toBe(0.061);
    expect(rateOn(LEP_RATES, "2026-03-01")).toBe(0.025);
  });

  // The rule since 2008 at the latest: the LEP pays the Livret A plus half
  // a point, unless inflation or the minister says more.
  it("pays at least half a point over the Livret A from 2008", () => {
    for (const [day] of [...LIVRET_A_RATES, ...LEP_RATES]) {
      if (day >= "2008-02-01") {
        expect(rateOn(LEP_RATES, day)).toBeGreaterThanOrEqual(
          rateOn(LIVRET_A_RATES, day) + 0.005 - 1e-12,
        );
      }
    }
  });

  it("returns a year's rate over a year at one rate", () => {
    const year = regulatedMonthlyReturns(LIVRET_A_RATES, "1982-01", "1982-12");
    const compounded = year.reduce((level, value) => level * (1 + value), 1);
    expect(compounded - 1).toBeCloseTo(0.085, 10);
  });

  it("splits a month changed on the 16th", () => {
    const [october] = regulatedMonthlyReturns(
      LIVRET_A_RATES,
      "1981-10",
      "1981-10",
    );
    const low = 1.075 ** (1 / 12) - 1;
    const high = 1.085 ** (1 / 12) - 1;
    expect(october).toBeGreaterThan(low);
    expect(october).toBeLessThan(high);
  });

  it("are the series the replay reads", () => {
    const livretA = historySeries("livret-a");
    expect(livretA.start).toBe(HISTORY_START);
    expect(returnIn(livretA, "2021-06")).toBeCloseTo(1.005 ** (1 / 12) - 1, 12);
    const lep = historySeries("lep");
    expect(lep.start).toBe("1982-06");
    expect(returnIn(lep, "1982-05")).toBeNull();
  });
});

describe("the fonds euros", () => {
  // The ACPR's yearly averages, net of management fees.
  it.each([
    [2019, 0.0146],
    [2022, 0.0191],
    [2025, 0.0263],
  ])("returned what the ACPR says in %i", (year, published) => {
    // Months are kept to the hundred-thousandth: a year lands within 0.01
    // point of the published two-decimal figure.
    expect(
      Math.abs(calendarYear("fonds-euros", year) - published),
    ).toBeLessThan(1e-4);
  });

  it("is the French ten-year yield before 2000", () => {
    expect(historySeries("fonds-euros").reconstructedUntil).toBe("1999-12");
  });
});

describe("bitcoin", () => {
  it("starts in November 2014, from October's close", () => {
    expect(historySeries("bitcoin").start).toBe("2014-11");
  });

  it("lost more than half in 2022", () => {
    expect(calendarYear("bitcoin", 2022)).toBeLessThan(-0.5);
  });
});
