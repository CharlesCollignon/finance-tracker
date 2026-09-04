import { describe, expect, it } from "vitest";

import {
  detectPayRhythm,
  groupByPayPeriod,
  payPeriodKey,
  unevenness,
} from "./pay-period";

/** A salary that mostly clears on the last day, sometimes slipping over. */
const STRADDLING = [
  "2025-10-31",
  "2025-12-01",
  "2025-12-31",
  "2026-02-01",
  "2026-02-28",
  "2026-03-31",
  "2026-05-01",
  "2026-05-31",
  "2026-06-30",
  "2026-07-31",
  "2026-08-31",
];

describe("detectPayRhythm", () => {
  it("finds the anchor at the month end even though the days wrap", () => {
    const rhythm = detectPayRhythm(STRADDLING);

    expect(rhythm).not.toBeNull();
    // An ordinary mean of days 31 and 1 lands mid-month, which is the one
    // place these payments never are.
    expect(rhythm!.anchor > 0.9 || rhythm!.anchor < 0.1).toBe(true);
    expect(rhythm!.concentration).toBeGreaterThan(0.9);
  });

  it("finds nothing in spending that happens all month long", () => {
    const groceries = [
      "2026-03-02",
      "2026-03-11",
      "2026-03-19",
      "2026-04-04",
      "2026-04-17",
      "2026-04-28",
      "2026-05-06",
      "2026-05-22",
    ];

    expect(detectPayRhythm(groceries)).toBeNull();
  });

  it("finds nothing in a weekly charge", () => {
    const weekly = [
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
      "2026-04-13",
    ];

    expect(detectPayRhythm(weekly)).toBeNull();
  });

  it("has nothing to say about three payments", () => {
    expect(
      detectPayRhythm(["2026-01-31", "2026-02-28", "2026-03-31"]),
    ).toBeNull();
  });
});

describe("payPeriodKey", () => {
  const lateMonth = { anchor: 0.97, concentration: 0.99 };

  it("leaves a payment on the anchor where it is", () => {
    expect(payPeriodKey("2026-08-31", lateMonth)).toBe("2026-08");
  });

  it("counts an early payment against the month before", () => {
    expect(payPeriodKey("2026-09-01", lateMonth)).toBe("2026-08");
  });

  it("crosses a year boundary", () => {
    expect(payPeriodKey("2026-01-01", lateMonth)).toBe("2025-12");
  });

  /**
   * Measuring from the anchor rather than a cut-off is what stops a whole
   * series sliding: a category genuinely paid on the 2nd keeps its months.
   */
  it("does not slide a category paid early in the month", () => {
    const earlyMonth = { anchor: 0.05, concentration: 0.99 };

    expect(payPeriodKey("2026-09-02", earlyMonth)).toBe("2026-09");
    expect(payPeriodKey("2026-08-31", earlyMonth)).toBe("2026-09");
  });
});

describe("unevenness", () => {
  it("counts empty periods and doubled ones", () => {
    expect(unevenness(["2026-01", "2026-01", "2026-03"])).toBe(2);
  });

  it("is zero for one payment per month", () => {
    expect(unevenness(["2026-01", "2026-02", "2026-03"])).toBe(0);
  });
});

describe("groupByPayPeriod", () => {
  it("regroups a straddling salary into one payment per period", () => {
    const grouping = groupByPayPeriod(STRADDLING);

    expect(grouping.shifted).toBe(true);
    expect(unevenness(STRADDLING.map(grouping.keyOf))).toBe(0);
  });

  it("leaves an already-regular salary alone", () => {
    const regular = [
      "2025-10-15",
      "2025-11-15",
      "2025-12-15",
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ];
    const grouping = groupByPayPeriod(regular);

    expect(grouping.shifted).toBe(false);
    expect(grouping.keyOf("2026-03-15")).toBe("2026-03");
  });

  /**
   * Regrouping is a second opinion about which month money belongs to. It has
   * to earn that by making the series regular, not merely by being possible.
   */
  it("leaves scattered spending on the calendar", () => {
    const grouping = groupByPayPeriod([
      "2026-03-02",
      "2026-03-11",
      "2026-03-19",
      "2026-04-04",
      "2026-04-17",
      "2026-04-28",
    ]);

    expect(grouping.shifted).toBe(false);
  });
});
