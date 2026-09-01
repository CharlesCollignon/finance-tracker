import { describe, expect, it } from "vitest";

import { buildPortfolioReturn, formatAnnualRate, xirr } from "./xirr";

/** XIRR is iterative; compare to the precision a UI would ever show. */
function closeTo(value: number | null, expected: number) {
  expect(value).not.toBeNull();
  expect(value!).toBeCloseTo(expected, 4);
}

describe("xirr", () => {
  it("returns the exact rate for a single year-long holding", () => {
    closeTo(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 1100 },
      ]),
      // 365 days at 10%.
      0.1,
    );
  });

  it("reports a loss as a negative rate", () => {
    closeTo(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 900 },
      ]),
      -0.1,
    );
  });

  it("returns zero when value equals contributions", () => {
    closeTo(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 1000 },
      ]),
      0,
    );
  });

  it("annualises a holding shorter than a year", () => {
    // +10% over roughly half a year is about +21% annualised.
    const rate = xirr([
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-07-02", amount: 1100 },
    ]);
    expect(rate).toBeGreaterThan(0.2);
    expect(rate).toBeLessThan(0.22);
  });

  it("solves a monthly contribution schedule", () => {
    const flows = Array.from({ length: 12 }, (_, index) => ({
      date: `2025-${String(index + 1).padStart(2, "0")}-01`,
      amount: -100,
    }));
    // €1,200 in over the year, worth €1,260 at the end.
    const rate = xirr([...flows, { date: "2026-01-01", amount: 1260 }]);

    // Money was in for about half the year on average, so the annual rate is
    // roughly double the 5% headline gain.
    expect(rate).toBeGreaterThan(0.09);
    expect(rate).toBeLessThan(0.11);
  });

  it("distinguishes a lump sum from a drip for the same absolute gain", () => {
    const lump = xirr([
      { date: "2025-01-01", amount: -1200 },
      { date: "2026-01-01", amount: 1260 },
    ]);
    const drip = xirr([
      ...Array.from({ length: 12 }, (_, index) => ({
        date: `2025-${String(index + 1).padStart(2, "0")}-01`,
        amount: -100,
      })),
      { date: "2026-01-01", amount: 1260 },
    ]);

    expect(lump).not.toBeNull();
    expect(drip).not.toBeNull();
    // Identical €60 gain, but the drip had less money at risk for less time.
    expect(drip!).toBeGreaterThan(lump!);
  });

  it("handles a near-total loss", () => {
    const rate = xirr([
      { date: "2025-01-01", amount: -1000 },
      { date: "2026-01-01", amount: 1 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(-0.99);
  });

  it("handles a very large gain", () => {
    const rate = xirr([
      { date: "2025-01-01", amount: -100 },
      { date: "2026-01-01", amount: 10000 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(90);
  });

  it("returns null with fewer than two flows", () => {
    expect(xirr([{ date: "2026-01-01", amount: -100 }])).toBeNull();
    expect(xirr([])).toBeNull();
  });

  it("returns null when nothing ever came back", () => {
    expect(
      xirr([
        { date: "2025-01-01", amount: -100 },
        { date: "2025-06-01", amount: -100 },
      ]),
    ).toBeNull();
  });

  it("returns null when every flow lands on the same day", () => {
    expect(
      xirr([
        { date: "2026-01-01", amount: -100 },
        { date: "2026-01-01", amount: 110 },
      ]),
    ).toBeNull();
  });

  it("handles withdrawals part-way through", () => {
    const rate = xirr([
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 500 },
      { date: "2026-01-01", amount: 700 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0.1);
  });
});

describe("buildPortfolioReturn", () => {
  const contributions = [
    { date: "2025-01-01", amount: 100 },
    { date: "2025-07-01", amount: 100 },
  ];

  it("takes contributions as positive numbers", () => {
    const result = buildPortfolioReturn(contributions, 220, "2026-01-01");

    expect(result.invested).toBe(200);
    expect(result.currentValue).toBe(220);
    expect(result.absoluteGain).toBe(20);
    expect(result.rate).not.toBeNull();
    expect(result.unavailableReason).toBeNull();
  });

  it("counts the days held from the first contribution", () => {
    const result = buildPortfolioReturn(contributions, 220, "2026-01-01");
    expect(result.daysHeld).toBe(365);
  });

  it("says why there is no rate when nothing was contributed", () => {
    const result = buildPortfolioReturn([], 0, "2026-01-01");
    expect(result.rate).toBeNull();
    expect(result.unavailableReason).toBe("no-contributions");
  });

  it("refuses to annualise a holding only days old", () => {
    const result = buildPortfolioReturn(
      [{ date: "2026-01-01", amount: 100 }],
      110,
      "2026-01-10",
    );

    expect(result.rate).toBeNull();
    expect(result.unavailableReason).toBe("too-short");
    // The absolute figures are still worth showing.
    expect(result.absoluteGain).toBe(10);
  });

  it("ignores non-positive contribution rows", () => {
    const result = buildPortfolioReturn(
      [
        { date: "2025-01-01", amount: 100 },
        { date: "2025-02-01", amount: 0 },
      ],
      110,
      "2026-01-01",
    );

    expect(result.invested).toBe(100);
  });

  it("reports a loss without a rate when the position is worthless", () => {
    const result = buildPortfolioReturn(contributions, 0, "2026-01-01");
    expect(result.absoluteGain).toBe(-200);
    // No positive terminal flow means no solvable rate.
    expect(result.rate).toBeNull();
    expect(result.unavailableReason).toBe("not-solvable");
  });
});

describe("formatAnnualRate", () => {
  it("shows a gain with an explicit plus", () => {
    expect(formatAnnualRate(0.074)).toBe("+7.4% a year");
  });

  it("shows a loss with a minus", () => {
    expect(formatAnnualRate(-0.021)).toBe("-2.1% a year");
  });

  it("shows a flat return without a sign", () => {
    expect(formatAnnualRate(0)).toBe("0.0% a year");
  });

  it("returns null when there is no rate", () => {
    expect(formatAnnualRate(null)).toBeNull();
  });
});
