import { describe, expect, it } from "vitest";

import { buildMonthFacts, type BuildMonthFactsInput } from "./month-facts";
import {
  decideMonthReadWrite,
  describeReadFreshness,
  explainWriteRefusal,
  MONTH_READ_COOLDOWN_SECONDS,
  MONTH_READ_WRITES_PER_MONTH,
  writesRemaining,
  type MonthReadTally,
  type WriteRefusal,
} from "./month-read-budget";
import type { MonthlySummary } from "./types/database";

const NOW = "2026-04-02T12:00:00.000Z";
const LONG_AGO = "2026-04-01T08:00:00.000Z";

function summary(partial: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    income: 3200,
    expenses: 1650,
    savings: 200,
    investments: 0,
    investmentDeployments: 0,
    remaining: 1550,
    budgetView: "current",
    expenseBreakdown: [],
    savingsBreakdown: [],
    investmentBreakdown: [],
    investmentDeploymentBreakdown: [],
    ...partial,
  };
}

function pack(partial: Partial<BuildMonthFactsInput> = {}) {
  return buildMonthFacts({
    year: 2026,
    month: 3,
    state: "closed",
    summary: summary(),
    comparison: null,
    close: null,
    pulse: null,
    closeSummary: null,
    unrecordedCap: null,
    budgets: [],
    goals: [],
    investedValue: null,
    inboxPending: 0,
    chargesUnconfirmed: 0,
    ...partial,
  });
}

function tally(partial: Partial<MonthReadTally> = {}): MonthReadTally {
  return {
    writes: 0,
    refused: 0,
    lastWrittenAt: null,
    pendingSince: null,
    ...partial,
  };
}

describe("decideMonthReadWrite", () => {
  it("allows the first write of a month", () => {
    expect(
      decideMonthReadWrite({
        tally: null,
        facts: pack(),
        now: NOW,
        tracked: true,
      }),
    ).toEqual({ write: true });
  });

  it("refuses a thin month before checking anything else", () => {
    // The worst output this feature could produce is a confident read of an
    // empty month, and refusing costs nothing.
    expect(
      decideMonthReadWrite({
        tally: null,
        facts: pack({
          summary: summary({
            income: 0,
            expenses: 0,
            savings: 0,
            remaining: 0,
          }),
        }),
        now: NOW,
        tracked: true,
      }),
    ).toEqual({ write: false, reason: "nothing-to-say" });
  });

  it("refuses when the tally cannot be kept", () => {
    // A call that cannot be counted is a call that is not capped.
    expect(
      decideMonthReadWrite({
        tally: null,
        facts: pack(),
        now: NOW,
        tracked: false,
      }),
    ).toEqual({ write: false, reason: "untracked" });
  });

  it("spends the allowance and then stops", () => {
    expect(
      decideMonthReadWrite({
        tally: tally({ writes: MONTH_READ_WRITES_PER_MONTH }),
        facts: pack(),
        now: NOW,
        tracked: true,
      }),
    ).toEqual({
      write: false,
      reason: "allowance-spent",
      used: MONTH_READ_WRITES_PER_MONTH,
      allowance: MONTH_READ_WRITES_PER_MONTH,
    });
  });

  it("allows the last one", () => {
    expect(
      decideMonthReadWrite({
        tally: tally({ writes: MONTH_READ_WRITES_PER_MONTH - 1 }),
        facts: pack(),
        now: NOW,
        tracked: true,
      }),
    ).toEqual({ write: true });
  });

  describe("the cooldown", () => {
    it("refuses a second press within it", () => {
      const decision = decideMonthReadWrite({
        tally: tally({ writes: 1, lastWrittenAt: "2026-04-02T11:59:30.000Z" }),
        facts: pack(),
        now: NOW,
        tracked: true,
      });

      expect(decision).toEqual({
        write: false,
        reason: "cooling-down",
        retryAfterSeconds: MONTH_READ_COOLDOWN_SECONDS - 30,
      });
    });

    it("allows one once it has run", () => {
      expect(
        decideMonthReadWrite({
          tally: tally({ writes: 1, lastWrittenAt: LONG_AGO }),
          facts: pack(),
          now: NOW,
          tracked: true,
        }),
      ).toEqual({ write: true });
    });

    it("treats a clock that went backwards as just now", () => {
      const decision = decideMonthReadWrite({
        tally: tally({ writes: 1, lastWrittenAt: "2026-04-02T12:05:00.000Z" }),
        facts: pack(),
        now: NOW,
        tracked: true,
      });

      expect(decision).toMatchObject({
        write: false,
        reason: "cooling-down",
        retryAfterSeconds: MONTH_READ_COOLDOWN_SECONDS,
      });
    });
  });

  describe("a call already in flight", () => {
    it("refuses while one is outstanding", () => {
      expect(
        decideMonthReadWrite({
          tally: tally({
            writes: 1,
            lastWrittenAt: LONG_AGO,
            pendingSince: "2026-04-02T11:59:50.000Z",
          }),
          facts: pack(),
          now: NOW,
          tracked: true,
        }),
      ).toEqual({ write: false, reason: "in-flight" });
    });

    it("ignores one old enough to have been abandoned", () => {
      // A process that died mid-call must not lock the month forever.
      expect(
        decideMonthReadWrite({
          tally: tally({
            writes: 1,
            lastWrittenAt: LONG_AGO,
            pendingSince: "2026-04-02T11:50:00.000Z",
          }),
          facts: pack(),
          now: NOW,
          tracked: true,
        }),
      ).toEqual({ write: true });
    });
  });
});

describe("writesRemaining", () => {
  it("counts down and floors at zero", () => {
    expect(writesRemaining(null)).toBe(MONTH_READ_WRITES_PER_MONTH);
    expect(writesRemaining(tally({ writes: 2 }))).toBe(
      MONTH_READ_WRITES_PER_MONTH - 2,
    );
    expect(writesRemaining(tally({ writes: 99 }))).toBe(0);
  });
});

describe("explainWriteRefusal", () => {
  it("has words for every refusal", () => {
    // An exhaustive switch, so a new refusal cannot ship without a sentence.
    const refusals: WriteRefusal[] = [
      { reason: "allowance-spent", used: 5, allowance: 5 },
      { reason: "cooling-down", retryAfterSeconds: 30 },
      { reason: "in-flight" },
      { reason: "nothing-to-say" },
      { reason: "untracked" },
    ];

    for (const refusal of refusals) {
      expect(explainWriteRefusal(refusal, "March 2026")).toMatch(/\S/);
    }
  });

  it("names the month where the month is the point", () => {
    expect(
      explainWriteRefusal({ reason: "nothing-to-say" }, "March 2026"),
    ).toContain("March 2026");
  });
});

describe("describeReadFreshness", () => {
  const written = "2026-04-01T09:00:00.000Z";

  it("is current when nothing it rests on has moved", () => {
    const facts = pack();

    expect(
      describeReadFreshness({
        storedFacts: facts,
        currentFacts: facts,
        footing: ["income", "expenses"],
        writtenAt: written,
        now: NOW,
      }),
    ).toMatchObject({ standing: "current", moved: [] });
  });

  it("reports only the figures the read actually rests on", () => {
    // A figure nobody cited moving is not staleness.
    const freshness = describeReadFreshness({
      storedFacts: pack(),
      currentFacts: pack({ summary: summary({ expenses: 1900 }) }),
      footing: ["income"],
      writtenAt: written,
      now: NOW,
    });

    expect(freshness.standing).toBe("current");
    expect(freshness.moved).toEqual([]);
  });

  it("reports movement in a cited figure", () => {
    const freshness = describeReadFreshness({
      storedFacts: pack(),
      currentFacts: pack({ summary: summary({ expenses: 1900 }) }),
      footing: ["expenses"],
      writtenAt: written,
      now: NOW,
    });

    expect(freshness.standing).toBe("moved");
    expect(freshness.moved).toEqual([
      { id: "expenses", label: "Money out", was: 1650, now: 1900 },
    ]);
  });

  it("treats a sub-cent difference as rounding", () => {
    const freshness = describeReadFreshness({
      storedFacts: pack(),
      currentFacts: pack({ summary: summary({ expenses: 1650.004 }) }),
      footing: ["expenses"],
      writtenAt: written,
      now: NOW,
    });

    expect(freshness.standing).toBe("current");
  });

  it("never calls a month in progress stale, however much moved", () => {
    // Its figures change whenever anything is recorded, so a staleness badge
    // would be lit permanently — and a warning that is always on is one
    // nobody reads.
    const freshness = describeReadFreshness({
      storedFacts: pack({ state: "in-progress" }),
      currentFacts: pack({
        state: "in-progress",
        summary: summary({ expenses: 9000 }),
      }),
      footing: ["expenses"],
      writtenAt: written,
      now: NOW,
    });

    expect(freshness.standing).toBe("provisional");
    // The movement is still reported, for a screen that wants to say so.
    expect(freshness.moved).toHaveLength(1);
  });

  it("says how old the read is, in the app's existing words", () => {
    expect(
      describeReadFreshness({
        storedFacts: pack(),
        currentFacts: pack(),
        footing: [],
        writtenAt: "2026-04-02T11:40:00.000Z",
        now: NOW,
      }).writtenAge,
    ).toBe("20 min ago");
  });

  it("ignores a cited figure that has since disappeared", () => {
    // Rendering drops that claim; there is nothing to compare here.
    const freshness = describeReadFreshness({
      storedFacts: pack({ inboxPending: 3 }),
      currentFacts: pack(),
      footing: ["inbox-pending"],
      writtenAt: written,
      now: NOW,
    });

    expect(freshness.moved).toEqual([]);
  });
});
