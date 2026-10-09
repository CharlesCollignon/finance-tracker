import { describe, expect, it } from "vitest";

import type { Envelope } from "./future-plan";
import type { ProjectionPoint } from "./projection";
import {
  buildYearAhead,
  defaultExtraTarget,
  niceTicks,
  parseYearAheadSettings,
  resampleSeries,
  resolveExtraTarget,
  stackBands,
  YEAR_AHEAD_DEFAULT_SETTINGS,
} from "./year-ahead";

/**
 * A steady month: 3 000 in, 1 500 of charges, 300 unseen, 700 set aside —
 * so 500 stays on the current account each month.
 */
function steadyPoints(months: number, opening = 2_000): ProjectionPoint[] {
  return Array.from({ length: months }, (_, index) => ({
    monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
    label: `month ${index + 1}`,
    year: 2026,
    month: index + 1,
    income: 3_000,
    expense: 1_500,
    setAside: 700,
    deployed: 0,
    unrecorded: 300,
    onHand: opening + 500 * (index + 1),
    kept: opening + 1_200 * (index + 1),
  }));
}

function envelope(
  id: Envelope["id"],
  initial: number,
  monthly: number,
  annualReturn = 0,
): Envelope {
  return { id, initial, monthly, annualReturn, taxOnGains: 0 };
}

describe("buildYearAhead", () => {
  it("draws the current account and each account, and sums them", () => {
    const result = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 2_000,
      envelopes: [
        envelope("livret_a", 10_000, 400),
        envelope("pea", 5_000, 300),
      ],
      horizon: 12,
    });

    expect(result.months).toBe(12);
    expect(result.bands.map((band) => band.id)).toEqual([
      "current",
      "livret_a",
      "pea",
    ]);
    const [current, livret, pea] = result.bands;
    expect(current!.values[0]).toBe(2_000);
    expect(current!.values[12]).toBe(8_000);
    expect(livret!.values[0]).toBe(10_000);
    expect(livret!.values[12]).toBe(14_800);
    expect(pea!.values[12]).toBe(8_600);
    expect(result.total[0]).toBe(17_000);
    expect(result.total[12]).toBe(31_400);
    // Nothing played with: the baseline is the figure.
    expect(result.baseline).toEqual(result.total);
  });

  it("explains the month: in, out, and where the rest goes", () => {
    const { flow } = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 2_000,
      envelopes: [
        envelope("livret_a", 10_000, 400),
        envelope("pea", 5_000, 300),
      ],
      horizon: 12,
    });

    expect(flow.income).toBe(3_000);
    expect(flow.committed).toBe(1_500);
    expect(flow.everyday).toBe(300);
    expect(flow.into).toEqual([
      { id: "livret_a", monthly: 400 },
      { id: "pea", monthly: 300 },
    ]);
    expect(flow.current).toBe(500);
  });

  it("names what is set aside with no account as elsewhere", () => {
    // 700 leaves the current account, the accounts' own payments say 600.
    const result = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 0,
      envelopes: [envelope("pea", 0, 600)],
      horizon: 12,
    });

    expect(result.flow.into).toEqual([
      { id: "pea", monthly: 600 },
      { id: "elsewhere", monthly: 100 },
    ]);
    const elsewhere = result.bands.find((band) => band.id === "elsewhere");
    expect(elsewhere?.values[12]).toBe(1_200);
  });

  it("puts the extra into the account picked, compounding there", () => {
    const base = {
      points: steadyPoints(12),
      onHandToday: 0,
      envelopes: [envelope("livret_a", 0, 400, 0.03)],
      horizon: 12,
    };
    const without = buildYearAhead(base);
    const withExtra = buildYearAhead({
      ...base,
      extra: { monthly: 100, to: "livret_a" },
    });

    const livret = withExtra.bands.find((band) => band.id === "livret_a")!;
    const plain = without.bands.find((band) => band.id === "livret_a")!;
    // More than the 1 200 paid in: it earns interest too.
    expect(livret.values[12]! - plain.values[12]!).toBeGreaterThan(1_200);
    expect(livret.baseline).toEqual(plain.values);
    expect(withExtra.baseline).toEqual(without.total);
    expect(withExtra.flow.extra).toBe(1_200);
  });

  it("can put the extra on the current account instead", () => {
    const result = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 0,
      envelopes: [],
      horizon: 12,
      extra: { monthly: 50, to: "current" },
    });

    expect(result.total[12]! - result.baseline[12]!).toBe(600);
  });

  it("lands events on the current account from their month", () => {
    const result = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 0,
      envelopes: [],
      horizon: 12,
      events: [
        { id: "a", kind: "raise", amount: 100, month: 4 },
        { id: "b", kind: "bonus", amount: 1_000, month: 6 },
        { id: "c", kind: "expense", amount: 2_500, month: 8 },
        // After the window: nothing yet.
        { id: "d", kind: "expense", amount: 9_999, month: 30 },
      ],
    });

    const gap = (step: number) => result.total[step]! - result.baseline[step]!;
    expect(gap(3)).toBe(0);
    expect(gap(4)).toBe(100);
    expect(gap(6)).toBe(1_300);
    expect(gap(8)).toBe(-1_000);
    // Nine months of raise, the bonus, the expense.
    expect(gap(12)).toBe(900 + 1_000 - 2_500);
    expect(result.flow.events).toBe(-600);
  });

  it("keeps on the current account what a full livret turns away", () => {
    // 22 800 on a Livret A capped at 22 950: one payment of 150, then none.
    const result = buildYearAhead({
      points: steadyPoints(3),
      onHandToday: 0,
      envelopes: [envelope("livret_a", 22_800, 700)],
      horizon: 3,
    });

    const [current, livret] = result.bands;
    expect(livret!.values).toEqual([22_800, 22_950, 22_950, 22_950]);
    // The projection had taken 700 a month off; 550, then 700, come back.
    expect(current!.values[1]).toBe(2_500 + 550);
    expect(current!.values[3]).toBe(3_500 + 550 + 700 + 700);
  });

  it("waits for the wallets before naming anything elsewhere", () => {
    const result = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 0,
      envelopes: [envelope("livret_a", 0, 300)],
      horizon: 12,
      complete: false,
    });

    expect(result.flow.into).toEqual([{ id: "livret_a", monthly: 300 }]);
    expect(result.bands.map((band) => band.id)).toEqual([
      "current",
      "livret_a",
    ]);
  });

  it("leaves a hidden account out of the figure but keeps it listed", () => {
    const result = buildYearAhead({
      points: steadyPoints(12),
      onHandToday: 2_000,
      envelopes: [envelope("livret_a", 10_000, 700)],
      horizon: 12,
      hidden: ["current"],
    });

    expect(result.bands[0]).toMatchObject({ id: "current", hidden: true });
    expect(result.total[12]).toBe(18_400);
  });

  it("starts the current account at zero without a bank", () => {
    const result = buildYearAhead({
      points: steadyPoints(6, 0),
      onHandToday: null,
      envelopes: [],
      horizon: 12,
    });

    // The projection is only six months long: so is the card.
    expect(result.months).toBe(6);
    expect(result.bands[0]!.values).toEqual([
      0, 500, 1_000, 1_500, 2_000, 2_500, 3_000,
    ]);
  });
});

describe("buildYearAhead, as finances really go", () => {
  const base = {
    points: steadyPoints(24),
    onHandToday: 2_000,
    envelopes: [
      envelope("livret_a", 10_000, 300, 0.017),
      { ...envelope("pea", 8_000, 200, 0.07), taxOnGains: 0.186 },
    ],
    horizon: 24,
  };

  it("takes the fees off the return, and says what they cost", () => {
    const without = buildYearAhead(base);
    const withFees = buildYearAhead({ ...base, fees: { pea: 0.005 } });
    const pea = (ahead: typeof without) =>
      ahead.bands.find((band) => band.id === "pea")!.values[24]!;

    expect(pea(withFees)).toBeLessThan(pea(without));
    expect(withFees.flow.fees).toBeCloseTo(pea(without) - pea(withFees), 0);
    expect(without.flow.fees).toBe(0);
  });

  it("lets the salary and the charges rise with prices", () => {
    const flat = buildYearAhead(base);
    const rising = buildYearAhead({ ...base, inflation: 0.02 });
    const current = (ahead: typeof flat) => ahead.bands[0]!.values[24]!;

    // 1 200 a month kept from salary over charges, growing with prices.
    expect(current(rising)).toBeGreaterThan(current(flat));
    expect(current(rising) - current(flat)).toBeLessThan(1_200 * 24 * 0.05);
  });

  it("can say it all in today's euros", () => {
    const nominal = buildYearAhead({ ...base, inflation: 0.02 });
    const real = buildYearAhead({ ...base, inflation: 0.02, realTerms: true });

    expect(real.total[0]).toBe(nominal.total[0]);
    expect(real.total[24]).toBeCloseTo(nominal.total[24]! / 1.02 ** 2, 0);
    expect(real.afterTax.total).toBeCloseTo(
      nominal.afterTax.total / 1.02 ** 2,
      0,
    );
  });

  it("draws a range around what moves with the markets, the same every time", () => {
    const ahead = buildYearAhead(base);
    const again = buildYearAhead(base);

    expect(ahead.range).not.toBeNull();
    expect(ahead.range).toEqual(again.range);
    expect(ahead.range!.low[0]).toBe(ahead.total[0]);
    expect(ahead.range!.high[0]).toBe(ahead.total[0]);
    expect(ahead.range!.low[24]).toBeLessThan(ahead.total[24]!);
    expect(ahead.range!.high[24]).toBeGreaterThan(ahead.total[24]!);
    // A PEA of 8 000 to 13 000 or so swings by hundreds to a few thousand
    // over two years, not by the whole account.
    const spread = ahead.range!.high[24]! - ahead.range!.low[24]!;
    expect(spread).toBeGreaterThan(1_000);
    expect(spread).toBeLessThan(10_000);
  });

  it("draws no range when nothing visible moves with the markets", () => {
    expect(buildYearAhead({ ...base, hidden: ["pea"] }).range).toBeNull();
  });

  it("says what everything would be worth after tax, were it sold", () => {
    const ahead = buildYearAhead(base);
    const pea = ahead.bands.find((band) => band.id === "pea")!.values[24]!;
    const gains = pea - 8_000 - 200 * 24;

    expect(ahead.afterTax.byAccount.pea).toBeCloseTo(pea - gains * 0.186, 0);
    // The Livret A is tax-free, the current account has no gains.
    expect(ahead.afterTax.byAccount.livret_a).toBe(
      ahead.bands.find((band) => band.id === "livret_a")!.values[24],
    );
    expect(ahead.afterTax.total).toBeLessThan(ahead.total[24]!);
  });
});

describe("defaultExtraTarget", () => {
  it("prefers a savings account at hand, then any account", () => {
    expect(
      defaultExtraTarget([envelope("pel", 0, 0), envelope("ldds", 0, 0)]),
    ).toBe("ldds");
    expect(defaultExtraTarget([envelope("pea", 0, 0)])).toBe("pea");
    expect(defaultExtraTarget([])).toBe("current");
  });
});

describe("resolveExtraTarget", () => {
  it("keeps the account picked while it exists", () => {
    const envelopes = [envelope("livret_a", 0, 0), envelope("pea", 0, 0)];
    expect(resolveExtraTarget("pea", envelopes)).toBe("pea");
    expect(resolveExtraTarget("current", envelopes)).toBe("current");
    expect(resolveExtraTarget("cto", envelopes)).toBe("livret_a");
    expect(resolveExtraTarget(null, envelopes)).toBe("livret_a");
  });
});

describe("parseYearAheadSettings", () => {
  it("keeps what is valid and drops the rest", () => {
    expect(
      parseYearAheadSettings({
        horizon: 24,
        to: "pea",
        hidden: ["current", "nonsense", "current"],
        events: [
          { id: "a", kind: "bonus", amount: 500, month: 3.4 },
          { id: "b", kind: "lottery", amount: 1, month: 1 },
          { id: "c", kind: "expense", amount: -20, month: 99 },
        ],
      }),
    ).toEqual({
      horizon: 24,
      realTerms: false,
      to: "pea",
      hidden: ["current"],
      events: [
        { id: "a", kind: "bonus", amount: 500, month: 3 },
        { id: "c", kind: "expense", amount: 0, month: 60 },
      ],
    });
  });

  it("falls back to the defaults on anything else", () => {
    expect(parseYearAheadSettings(null)).toEqual(YEAR_AHEAD_DEFAULT_SETTINGS);
    expect(parseYearAheadSettings({ horizon: 7, to: "moon" })).toEqual(
      YEAR_AHEAD_DEFAULT_SETTINGS,
    );
  });
});

describe("resampleSeries", () => {
  it("draws straight lines between the points", () => {
    expect(resampleSeries([0, 10], 5)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(resampleSeries([0, 10, 0], 5)).toEqual([0, 5, 10, 5, 0]);
    expect(resampleSeries([4], 3)).toEqual([4, 4, 4]);
    expect(resampleSeries([], 3)).toEqual([]);
  });
});

describe("stackBands", () => {
  it("piles positives up from zero and negatives down from it", () => {
    const [current, livret] = stackBands([
      [-100, 50],
      [200, 200],
    ]);
    expect(current).toEqual({ lower: [-100, 0], upper: [0, 50] });
    expect(livret).toEqual({ lower: [0, 50], upper: [200, 250] });
  });
});

describe("niceTicks", () => {
  it("picks round amounts across the range", () => {
    expect(niceTicks(36_000, 86_000)).toEqual([40_000, 60_000, 80_000]);
    expect(niceTicks(1_000, 1_900)).toEqual([1_000, 1_500]);
    expect(niceTicks(5, 5)).toEqual([]);
  });
});
