import { describe, expect, it } from "vitest";
import { buildMilestones } from "../future-plan";
import { addMonths, monthsBetween } from "./month";
import {
  historicalReturn,
  lossOdds,
  replayPlan,
  sustainableWithdrawal,
  type ReplayAccount,
  type SeriesReader,
} from "./replay";
import type { HistorySeries, HistorySeriesId } from "./series";

/* -------------------------------------------- hand-checkable histories */

const END = "2002-12";

/** A series from `start` to `END`, each month's return from `at`. */
function series(
  id: HistorySeriesId,
  start: string,
  at: (index: number) => number,
): HistorySeries {
  const length = monthsBetween(start, END) + 1;
  return {
    id,
    start,
    end: END,
    returns: Array.from({ length }, (_, index) => at(index)),
    reconstructedUntil: null,
  };
}

/** A reader over 2000–2002 where everything returns nothing but `given`. */
function reader(
  given: Partial<Record<HistorySeriesId, HistorySeries>>,
): SeriesReader {
  return (id) => given[id] ?? series(id, "2000-01", () => 0);
}

function account(over: Partial<ReplayAccount> = {}): ReplayAccount {
  return { id: "pea", value: 1000, monthly: 0, mix: { world: 1 }, ...over };
}

describe("replayPlan", () => {
  it("replays every start the horizon leaves room for", () => {
    const result = replayPlan({
      accounts: [account()],
      months: 12,
      read: reader({ world: series("world", "2000-01", () => 0.01) }),
    });
    expect(result.starts).toBe(36 - 12 + 1);
    expect(result.firstStart).toBe("2000-01");
    expect(result.lastStart).toBe("2002-01");
    expect(result.end.p50).toBeCloseTo(1000 * 1.01 ** 12, 6);
    expect(result.end.p10).toBeCloseTo(result.end.p90, 6);
    expect(result.band.p50).toHaveLength(12);
  });

  it("counts in today's euros", () => {
    const result = replayPlan({
      accounts: [account()],
      months: 12,
      read: reader({
        world: series("world", "2000-01", () => 0.01),
        "cpi-fr": series("cpi-fr", "2000-01", () => 0.01),
      }),
    });
    expect(result.end.p50).toBeCloseTo(1000, 6);
    expect(result.nominalMedian.at(-1)).toBeCloseTo(1000 * 1.01 ** 12, 6);
  });

  it("takes each payment at the month's end, and stops at the ceiling", () => {
    const paid = replayPlan({
      accounts: [account({ monthly: 100 })],
      months: 12,
      read: reader({}),
    });
    expect(paid.end.p50).toBeCloseTo(2200, 6);
    // A full livret refuses the rest, which stays where it was: counted.
    const full = replayPlan({
      accounts: [account({ monthly: 100, ceiling: 1100 })],
      months: 12,
      read: reader({}),
    });
    expect(full.accounts[0]!.median).toBeCloseTo(1100, 6);
    expect(full.end.p50).toBeCloseTo(2200, 6);
  });

  it("sends what a full account refuses to the account named", () => {
    const result = replayPlan({
      accounts: [
        account({ id: "current", value: 0, mix: {} }),
        account({ id: "livret_a", monthly: 100, ceiling: 1100 }),
      ],
      months: 12,
      overflowTo: "current",
      read: reader({}),
    });
    expect(result.accounts).toEqual([
      { id: "current", median: 1100 },
      { id: "livret_a", median: 1100 },
    ]);
  });

  it("follows the first months' schedule, then the monthly payment", () => {
    const result = replayPlan({
      accounts: [account({ monthly: 10, schedule: [500, 0] })],
      months: 4,
      read: reader({}),
    });
    expect(result.end.p50).toBeCloseTo(1000 + 500 + 0 + 10 + 10, 6);
  });

  it("moves every start by the reader's shift, less the fees", () => {
    const result = replayPlan({
      accounts: [account({ shift: 0.12, fees: 0.02 })],
      months: 12,
      read: reader({}),
    });
    expect(result.end.p50).toBeCloseTo(1000 * 1.1, 6);
  });

  it("keeps cash still in the euros of the day", () => {
    const result = replayPlan({
      accounts: [account({ mix: {} })],
      months: 12,
      read: reader({ "cpi-fr": series("cpi-fr", "2000-01", () => 0.01) }),
    });
    expect(result.end.p50).toBeCloseTo(1000 / 1.01 ** 12, 6);
  });

  it("dates the milestones on the median start, in the euros of the day", () => {
    // 1 000 € growing 1 % a month, prices 1 %: still in today's euros,
    // past 1 100 € on a statement in the tenth month.
    const result = replayPlan({
      accounts: [account()],
      months: 12,
      read: reader({
        world: series("world", "2000-01", () => 0.01),
        "cpi-fr": series("cpi-fr", "2000-01", () => 0.01),
      }),
    });
    const [next] = buildMilestones(1000, result.nominalMedian, [1100]);
    expect(next).toEqual({ amount: 1100, reached: false, monthsAway: 10 });
  });

  it("follows a contract's own rate", () => {
    const result = replayPlan({
      accounts: [account({ mix: {}, fixedRate: 0.02 })],
      months: 12,
      read: reader({}),
    });
    expect(result.end.p50).toBeCloseTo(1020, 6);
  });

  it("names the worst and the best start", () => {
    // One month halves everything; the starts whose year holds it end at half.
    const result = replayPlan({
      accounts: [account()],
      months: 12,
      read: reader({
        world: series("world", "2000-01", (index) => (index === 20 ? -0.5 : 0)),
      }),
    });
    expect(result.worst.value).toBeCloseTo(500, 6);
    expect(result.best.value).toBeCloseTo(1000, 6);
    expect(monthsBetween(result.worst.start, "2001-09")).toBeLessThan(12);
  });

  it("lets the Livret A stand in for the LEP before it opened", () => {
    const result = replayPlan({
      accounts: [account({ mix: { lep: 1 } })],
      months: 12,
      read: reader({
        lep: series("lep", "2001-01", () => 0.002),
        "livret-a": series("livret-a", "2000-01", () => 0.001),
      }),
    });
    expect(result.standIns).toEqual([{ key: "lep", as: "livret-a" }]);
    expect(result.worst.value).toBeCloseTo(1000 * 1.001 ** 12, 6);
    expect(result.best.value).toBeCloseTo(1000 * 1.002 ** 12, 6);
  });

  it("holds bitcoin still through a stretch its history does not cover", () => {
    const result = replayPlan({
      accounts: [account({ mix: { bitcoin: 1 } })],
      months: 12,
      read: reader({
        bitcoin: series("bitcoin", "2002-01", () => 0.1),
        "cpi-fr": series("cpi-fr", "2000-01", () => 0.01),
      }),
    });
    expect(result.standIns).toEqual([{ key: "bitcoin", as: "flat" }]);
    // Every start but the last runs through 2001: held at its value.
    expect(result.worst.value).toBeCloseTo(1000, 6);
    expect(result.best.value).toBeCloseTo((1000 * 1.1 ** 12) / 1.01 ** 12, 4);
  });
});

describe("lossOdds", () => {
  it("counts the windows that ended below their start", () => {
    const shrinking = lossOdds(
      { mix: { world: 1 } },
      1,
      reader({ world: series("world", "2000-01", () => -0.001) }),
    );
    expect(shrinking).toEqual({ years: 1, windows: 25, losses: 25 });
    const growing = lossOdds(
      { mix: { world: 1 } },
      1,
      reader({ world: series("world", "2000-01", () => 0.001) }),
    );
    expect(growing.losses).toBe(0);
  });

  it("starts where the mix's history does", () => {
    const odds = lossOdds(
      { mix: { bitcoin: 1 } },
      1,
      reader({ bitcoin: series("bitcoin", "2002-01", () => 0) }),
    );
    expect(odds.windows).toBe(1);
  });
});

describe("sustainableWithdrawal", () => {
  it("is a fifth a year over five years of nothing", () => {
    const longer = (id: HistorySeriesId) =>
      ({
        id,
        start: "1995-01",
        end: END,
        returns: Array(96).fill(0),
        reconstructedUntil: null,
      }) satisfies HistorySeries;
    const rate = sustainableWithdrawal([account()], 5, longer);
    expect(rate?.windows).toBe(96 - 60 + 1);
    expect(rate?.always).toBeCloseTo(0.2, 6);
    expect(rate?.median).toBeCloseTo(0.2, 6);
  });

  it("is null with nothing to take from", () => {
    expect(sustainableWithdrawal([account({ value: 0 })], 1, reader({}))).toBe(
      null,
    );
  });
});

describe("historicalReturn", () => {
  it("compounds the history, and takes prices out", () => {
    const back = historicalReturn(
      { mix: { world: 1 } },
      reader({
        world: series("world", "2000-01", () => 0.01),
        "cpi-fr": series("cpi-fr", "2000-01", () => 0.005),
      }),
    );
    expect(back.from).toBe("2000-01");
    expect(back.nominal).toBeCloseTo(1.01 ** 12 - 1, 10);
    expect(back.real).toBeCloseTo((1.01 / 1.005) ** 12 - 1, 10);
  });
});

/* ------------------------------------------------- on the real history */

// Not published figures: guards against a broken engine or refresh, wide
// enough for any honest history, narrow enough to catch a sign or a unit.
describe("on the real history", () => {
  it("spreads ten years of world shares", () => {
    const result = replayPlan({ accounts: [account()], months: 120 });
    expect(result.starts).toBe(672 - 120 + 1);
    expect(result.end.p10).toBeLessThan(result.end.p50);
    expect(result.end.p50).toBeLessThan(result.end.p90);
    expect(result.end.p50).toBeGreaterThan(1300);
    expect(result.end.p50).toBeLessThan(2600);
  });

  it("has lost to prices over a year about a third of the time", () => {
    const odds = lossOdds({ mix: { world: 1 } }, 1);
    expect(odds.losses / odds.windows).toBeGreaterThan(0.2);
    expect(odds.losses / odds.windows).toBeLessThan(0.45);
  });

  it("has always lasted thirty years at a few percent", () => {
    const rate = sustainableWithdrawal([account()], 30);
    expect(rate!.always).toBeGreaterThan(0.02);
    expect(rate!.always).toBeLessThan(0.06);
    expect(rate!.median).toBeGreaterThan(rate!.always);
  });
});
