import { describe, expect, it } from "vitest";

import type { RecordedCashFlows } from "./month-close";
import {
  buildMonthPulse,
  pulseExplanation,
  pulseHeadline,
  type MonthPulseInput,
} from "./month-pulse";

function flows(partial: Partial<RecordedCashFlows> = {}): RecordedCashFlows {
  return {
    income: 0,
    expenses: 0,
    savings: 0,
    transfers: 0,
    ...partial,
  };
}

function input(partial: Partial<MonthPulseInput> = {}): MonthPulseInput {
  return {
    onHand: 2000,
    committed: 0,
    arriving: 0,
    flows: flows(),
    openingBalance: null,
    cap: null,
    ...partial,
  };
}

describe("buildMonthPulse", () => {
  describe("what is free", () => {
    it("takes the committed outgoings off the balance", () => {
      const pulse = buildMonthPulse(input({ onHand: 2000, committed: 750 }));

      expect(pulse.free).toBe(1250);
      expect(pulse.standing).toBe("clear");
    });

    it("counts income still to arrive", () => {
      // Whether payday lands before the big debit is half the reason to look.
      const pulse = buildMonthPulse(
        input({ onHand: 300, committed: 1200, arriving: 2400 }),
      );

      expect(pulse.free).toBe(1500);
    });

    it("goes short when the month owes more than is there", () => {
      const pulse = buildMonthPulse(input({ onHand: 400, committed: 950 }));

      expect(pulse.free).toBe(-550);
      expect(pulse.standing).toBe("short");
    });

    it("is null without a readable balance", () => {
      // An invented balance is worse than an absent one.
      const pulse = buildMonthPulse(input({ onHand: null, committed: 500 }));

      expect(pulse.free).toBeNull();
      expect(pulse.standing).toBe("unknown");
      expect(pulse.unrecordedSoFar).toBeNull();
    });

    it("rounds to the cent", () => {
      const pulse = buildMonthPulse(
        input({ onHand: 100.1, committed: 0.2, arriving: 0.1 }),
      );

      expect(pulse.free).toBe(100);
    });
  });

  describe("the standing", () => {
    it("is tight when less is left than a normal month spends unrecorded", () => {
      const pulse = buildMonthPulse(
        input({ onHand: 100, committed: 40, cap: 80 }),
      );

      expect(pulse.free).toBe(60);
      expect(pulse.standing).toBe("tight");
    });

    it("is clear once there is more slack than the cap", () => {
      expect(
        buildMonthPulse(input({ onHand: 500, committed: 40, cap: 80 }))
          .standing,
      ).toBe("clear");
    });

    it("has no middle without a cap to define one", () => {
      // Any threshold the user did not choose would be invented.
      expect(
        buildMonthPulse(input({ onHand: 100, committed: 99 })).standing,
      ).toBe("clear");
    });
  });

  describe("unrecorded spending so far", () => {
    it("is what the balance proves left that nothing explains", () => {
      // Opened at 3000, 2000 came in, 1500 of spending recorded, and the
      // account holds 3400 — so 100 left that the ledger cannot account for.
      const pulse = buildMonthPulse(
        input({
          onHand: 3400,
          openingBalance: 3000,
          flows: flows({ income: 2000, expenses: 1500 }),
        }),
      );

      expect(pulse.unrecordedSoFar).toBe(100);
      expect(pulse.overRecorded).toBe(false);
    });

    it("counts savings and transfers as money that left", () => {
      const pulse = buildMonthPulse(
        input({
          onHand: 900,
          openingBalance: 1000,
          flows: flows({ savings: 60, transfers: 40 }),
        }),
      );

      // The hundred that left is entirely explained by the two of them.
      expect(pulse.unrecordedSoFar).toBe(0);
    });

    it("is null with nothing closed to measure from", () => {
      const pulse = buildMonthPulse(
        input({ onHand: 3400, openingBalance: null }),
      );

      expect(pulse.unrecordedSoFar).toBeNull();
    });

    it("reports a balance that is too high as over-recorded, not as negative", () => {
      // Income missed, or an expense entered twice. Calling it "unrecorded
      // spending of minus eighty euros" would be nonsense.
      const pulse = buildMonthPulse(
        input({
          onHand: 1200,
          openingBalance: 1000,
          flows: flows({ income: 100 }),
        }),
      );

      expect(pulse.overRecorded).toBe(true);
      expect(pulse.unrecordedSoFar).toBeNull();
    });

    it("treats a sub-cent difference as rounding", () => {
      const pulse = buildMonthPulse(
        input({
          onHand: 1000.005,
          openingBalance: 1000,
          flows: flows(),
        }),
      );

      expect(pulse.overRecorded).toBe(false);
      expect(pulse.unrecordedSoFar).toBe(0);
    });
  });

  describe("against the cap", () => {
    it("gives a ratio for a meter to draw", () => {
      const pulse = buildMonthPulse(
        input({
          onHand: 960,
          openingBalance: 1000,
          flows: flows(),
          cap: 80,
        }),
      );

      expect(pulse.unrecordedSoFar).toBe(40);
      expect(pulse.capRatio).toBe(0.5);
      expect(pulse.overCap).toBe(false);
    });

    it("says when the cap is passed", () => {
      const pulse = buildMonthPulse(
        input({
          onHand: 880,
          openingBalance: 1000,
          flows: flows(),
          cap: 80,
        }),
      );

      expect(pulse.unrecordedSoFar).toBe(120);
      expect(pulse.capRatio).toBe(1.5);
      expect(pulse.overCap).toBe(true);
    });

    it("has no ratio without a cap, or against a zero one", () => {
      const base = {
        onHand: 960,
        openingBalance: 1000,
        flows: flows(),
      };

      expect(
        buildMonthPulse(input({ ...base, cap: null })).capRatio,
      ).toBeNull();
      expect(buildMonthPulse(input({ ...base, cap: 0 })).capRatio).toBeNull();
    });
  });
});

describe("the wording", () => {
  it("does not call the month's arithmetic money in an account", () => {
    const withoutBank = buildMonthPulse(input({ onHand: null }));

    expect(pulseHeadline(withoutBank)).toBe("Left this month");
    expect(pulseExplanation(withoutBank)).toContain("Connect a bank");
  });

  it("names a shortfall as one", () => {
    expect(
      pulseHeadline(buildMonthPulse(input({ onHand: 100, committed: 400 }))),
    ).toBe("Short by");
  });

  it("explains only the parts that exist", () => {
    expect(
      pulseExplanation(buildMonthPulse(input({ committed: 0, arriving: 0 }))),
    ).toBe("Nothing else is due this month.");
    expect(
      pulseExplanation(buildMonthPulse(input({ committed: 500, arriving: 0 }))),
    ).toBe("After everything still due to leave.");
    expect(
      pulseExplanation(buildMonthPulse(input({ committed: 0, arriving: 900 }))),
    ).toBe("Including what is still due to arrive.");
    expect(
      pulseExplanation(
        buildMonthPulse(input({ committed: 500, arriving: 900 })),
      ),
    ).toBe("After what is still due to leave, and what is still to arrive.");
  });
});
