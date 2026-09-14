import { describe, expect, it } from "vitest";

import {
  applyMonthlyRates,
  buildPriceSeries,
  downsample,
  emptyPriceSeries,
  percentChange,
  sliceSeriesByRange,
  type DatedPrice,
} from "./instrument-price-series";

const TODAY = "2026-09-14";

/**
 * The price line on a position row.
 *
 * Its whole job is a shape and a percentage, which sounds too small to test
 * until you notice how many ways the percentage can be quietly wrong: a range
 * that reaches further back than the fund has existed, a series thinned in a
 * way that moves its ends, or an exchange rate from today applied to a close
 * from four years ago.
 */

function daily(from: string, closes: number[]): DatedPrice[] {
  const start = new Date(`${from}T00:00:00Z`);
  return closes.map((close, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), close };
  });
}

describe("sliceSeriesByRange", () => {
  const points: DatedPrice[] = [
    { date: "2019-01-15", close: 50 },
    { date: "2024-09-20", close: 80 },
    { date: "2026-08-20", close: 100 },
    { date: "2026-09-10", close: 110 },
  ];

  it("keeps everything for ALL", () => {
    expect(sliceSeriesByRange(points, "ALL", TODAY)).toHaveLength(4);
  });

  it("keeps only the trailing month for 1M", () => {
    expect(sliceSeriesByRange(points, "1M", TODAY).map((p) => p.date)).toEqual([
      "2026-08-20",
      "2026-09-10",
    ]);
  });

  it("keeps five years for 5Y", () => {
    expect(sliceSeriesByRange(points, "5Y", TODAY).map((p) => p.date)).toEqual([
      "2024-09-20",
      "2026-08-20",
      "2026-09-10",
    ]);
  });

  it("clamps the cutoff to a day the month has", () => {
    // One month before 31 March is 28 February, not 3 March.
    const march: DatedPrice[] = [
      { date: "2026-03-01", close: 10 },
      { date: "2026-03-31", close: 12 },
    ];
    expect(sliceSeriesByRange(march, "1M", "2026-03-31")).toHaveLength(2);
  });

  it("returns an empty slice when the series predates the range", () => {
    const old: DatedPrice[] = [{ date: "2020-01-02", close: 10 }];
    expect(sliceSeriesByRange(old, "1Y", TODAY)).toEqual([]);
  });
});

describe("downsample", () => {
  it("leaves a short series alone", () => {
    const points = daily("2026-09-01", [1, 2, 3]);
    expect(downsample(points, 60)).toHaveLength(3);
  });

  it("thins to the cap", () => {
    const points = daily("2020-01-01", Array.from({ length: 500 }, (_, i) => i));
    expect(downsample(points, 60)).toHaveLength(60);
  });

  it("keeps both ends untouched", () => {
    const points = daily("2020-01-01", Array.from({ length: 500 }, (_, i) => i));
    const thinned = downsample(points, 60);
    expect(thinned[0]).toEqual(points[0]);
    expect(thinned[thinned.length - 1]).toEqual(points[points.length - 1]);
  });
});

describe("percentChange", () => {
  it("measures between the ends", () => {
    expect(percentChange(daily("2026-09-01", [100, 40, 110]))).toBe(10);
  });

  it("is negative when the price fell", () => {
    expect(percentChange(daily("2026-09-01", [200, 150]))).toBe(-25);
  });

  it("is zero for a flat run", () => {
    expect(percentChange(daily("2026-09-01", [100, 100, 100]))).toBe(0);
  });

  it("has no answer for fewer than two points", () => {
    expect(percentChange(daily("2026-09-01", [100]))).toBeNull();
    expect(percentChange([])).toBeNull();
  });

  it("has no answer when the first close is not positive", () => {
    expect(
      percentChange([
        { date: "2026-09-01", close: 0 },
        { date: "2026-09-02", close: 10 },
      ]),
    ).toBeNull();
  });
});

describe("applyMonthlyRates", () => {
  const points: DatedPrice[] = [
    { date: "2026-07-10", close: 100 },
    { date: "2026-08-10", close: 100 },
    { date: "2026-09-10", close: 100 },
  ];

  it("uses the rate that held in each point's month", () => {
    const converted = applyMonthlyRates(
      points,
      { "2026-07": 0.9, "2026-08": 0.8, "2026-09": 0.85 },
      0.5,
    );
    expect(converted.map((p) => p.close)).toEqual([90, 80, 85]);
  });

  it("carries the nearest earlier rate over a gap", () => {
    const converted = applyMonthlyRates(
      points,
      { "2026-07": 0.9, "2026-09": 0.85 },
      0.5,
    );
    expect(converted.map((p) => p.close)).toEqual([90, 90, 85]);
  });

  it("falls back for points older than every rate on hand", () => {
    const converted = applyMonthlyRates(points, { "2026-09": 0.85 }, 0.5);
    expect(converted.map((p) => p.close)).toEqual([50, 50, 85]);
  });

  it("uses the fallback throughout when no rates are available", () => {
    const converted = applyMonthlyRates(points, {}, 0.5);
    expect(converted.map((p) => p.close)).toEqual([50, 50, 50]);
  });

  it("keeps four decimals, so a tight range does not quantise", () => {
    const converted = applyMonthlyRates(
      [{ date: "2026-09-10", close: 0.4321 }],
      { "2026-09": 0.8567 },
      1,
    );
    expect(converted[0]!.close).toBe(0.3702);
  });
});

describe("buildPriceSeries", () => {
  /** A year of days and a lifetime of months, as Yahoo hands them over. */
  const history = {
    // 360 days ending on TODAY, so the trailing windows are actually populated.
    daily: daily(
      "2025-09-20",
      Array.from({ length: 360 }, (_, i) => 90 + i * 0.05),
    ),
    monthly: [
      { date: "2019-06-01", close: 50 },
      { date: "2021-06-01", close: 65 },
      { date: "2024-06-01", close: 80 },
      { date: "2026-09-01", close: 110 },
    ],
  };

  it("draws the near ranges from days and the far ones from months", () => {
    const series = buildPriceSeries(history, TODAY);

    // A month of daily closes is a shape, not two points.
    expect(series["1M"].values.length).toBeGreaterThan(20);
    expect(series["1Y"].values.length).toBeGreaterThan(20);

    expect(series.ALL.values).toEqual([50, 65, 80, 110]);
    expect(series.ALL.changePct).toBe(120);
    // 2021-06 falls outside a five-year window ending 2026-09-14.
    expect(series["5Y"].values).toEqual([80, 110]);
  });

  it("falls back to months when a listing gives no daily closes", () => {
    const series = buildPriceSeries(
      { daily: [], monthly: history.monthly },
      TODAY,
    );

    expect(series["1Y"].values).toEqual([110]);
    expect(series.ALL.values).toEqual([50, 65, 80, 110]);
  });

  it("reports no change for a range the instrument is younger than", () => {
    // Listed eight months ago, asked for five years.
    const young = {
      daily: daily("2026-01-05", [10, 11, 12]),
      monthly: [
        { date: "2026-01-01", close: 10 },
        { date: "2026-09-01", close: 12 },
      ],
    };
    const series = buildPriceSeries(young, TODAY);

    expect(series["1M"].values).toEqual([]);
    expect(series["1M"].changePct).toBeNull();
    expect(series["5Y"].values).toEqual([10, 12]);
    expect(series["5Y"].changePct).toBe(20);
  });

  it("gives an empty series for a symbol that could not be read", () => {
    expect(buildPriceSeries({ daily: [], monthly: [] }, TODAY)).toEqual(
      emptyPriceSeries(),
    );
  });

  it("holds every range to the cap", () => {
    const dense = {
      daily: daily("2020-01-01", Array.from({ length: 400 }, (_, i) => 10 + i)),
      monthly: daily(
        "2010-01-01",
        Array.from({ length: 4000 }, (_, i) => 10 + i),
      ),
    };
    const series = buildPriceSeries(dense, "2020-12-13");

    for (const range of ["1M", "1Y", "5Y", "ALL"] as const) {
      expect(series[range].values.length).toBeLessThanOrEqual(60);
    }
  });
});
