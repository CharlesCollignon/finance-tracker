import { describe, expect, it } from "vitest";

import {
  ATTENDED_COOLDOWN_SECONDS,
  DEFAULT_PULL_BUDGET,
  decideBankPull,
  describePullAge,
  lastPullAt,
  PSD2_UNATTENDED_READS_PER_DAY,
  pullIsStale,
  unattendedRemaining,
  unattendedUsedOn,
  type PullRecord,
} from "./bank-pull";

function record(
  pulledOn: string,
  unattended: number,
  attended: number,
  lastPulledAt: string,
): PullRecord {
  return { pulledOn, unattended, attended, lastPulledAt };
}

/** A pull long enough ago that the cooldown is never what refuses. */
const LONG_AGO = "2026-09-03T08:00:00.000Z";
const NOW = "2026-09-04T12:00:00.000Z";
const TODAY = "2026-09-04";

describe("decideBankPull", () => {
  it("pulls when nothing has been asked yet today", () => {
    expect(
      decideBankPull({
        kind: "attended",
        records: [],
        today: TODAY,
        now: NOW,
        pullableAccounts: 1,
      }),
    ).toEqual({ pull: true });
  });

  it("refuses when no account has a live consent", () => {
    // Spending an attempt on a lapsed connection would burn the allowance on
    // a call that cannot answer.
    expect(
      decideBankPull({
        kind: "unattended",
        records: [],
        today: TODAY,
        now: NOW,
        pullableAccounts: 0,
      }),
    ).toEqual({ pull: false, reason: "nothing-to-pull" });
  });

  describe("the attended cooldown", () => {
    it("refuses a second press within the cooldown", () => {
      const decision = decideBankPull({
        kind: "attended",
        records: [record(TODAY, 0, 1, "2026-09-04T11:59:30.000Z")],
        today: TODAY,
        now: NOW,
        pullableAccounts: 2,
      });

      expect(decision).toEqual({
        pull: false,
        reason: "cooling-down",
        retryAfterSeconds: ATTENDED_COOLDOWN_SECONDS - 30,
      });
    });

    it("allows one once the cooldown has run", () => {
      expect(
        decideBankPull({
          kind: "attended",
          records: [record(TODAY, 0, 1, "2026-09-04T11:58:00.000Z")],
          today: TODAY,
          now: NOW,
          pullableAccounts: 2,
        }),
      ).toEqual({ pull: true });
    });

    it("sees a pull made just before midnight", () => {
      // The newest row is yesterday's, so a cooldown that only read today's
      // would let this straight through one minute after the last pull.
      const decision = decideBankPull({
        kind: "attended",
        records: [record("2026-09-03", 1, 0, "2026-09-03T23:59:00.000Z")],
        today: "2026-09-04",
        now: "2026-09-04T00:00:00.000Z",
        pullableAccounts: 1,
      });

      expect(decision.pull).toBe(false);
      expect(decision).toMatchObject({ reason: "cooling-down" });
    });

    it("treats a clock that went backwards as just now", () => {
      const decision = decideBankPull({
        kind: "attended",
        records: [record(TODAY, 0, 1, "2026-09-04T12:05:00.000Z")],
        today: TODAY,
        now: NOW,
        pullableAccounts: 1,
      });

      expect(decision).toEqual({
        pull: false,
        reason: "cooling-down",
        retryAfterSeconds: ATTENDED_COOLDOWN_SECONDS,
      });
    });

    it("applies to the unattended run too", () => {
      // Two schedules landing in the same hour is a configuration mistake,
      // not a reason to make two round trips.
      const decision = decideBankPull({
        kind: "unattended",
        records: [record(TODAY, 1, 0, "2026-09-04T11:59:45.000Z")],
        today: TODAY,
        now: NOW,
        pullableAccounts: 1,
      });

      expect(decision).toMatchObject({ pull: false, reason: "cooling-down" });
    });
  });

  describe("the unattended allowance", () => {
    it("spends four and then stops", () => {
      const records = [record(TODAY, 4, 0, LONG_AGO)];

      expect(
        decideBankPull({
          kind: "unattended",
          records,
          today: TODAY,
          now: NOW,
          pullableAccounts: 1,
        }),
      ).toEqual({
        pull: false,
        reason: "allowance-spent",
        used: 4,
        allowance: PSD2_UNATTENDED_READS_PER_DAY,
      });
    });

    it("allows the fourth", () => {
      expect(
        decideBankPull({
          kind: "unattended",
          records: [record(TODAY, 3, 0, LONG_AGO)],
          today: TODAY,
          now: NOW,
          pullableAccounts: 1,
        }),
      ).toEqual({ pull: true });
    });

    it("does not hold attended pulls against it", () => {
      // Someone pressing refresh is present, and attended access has no cap.
      expect(
        decideBankPull({
          kind: "unattended",
          records: [record(TODAY, 0, 20, LONG_AGO)],
          today: TODAY,
          now: NOW,
          pullableAccounts: 1,
        }),
      ).toEqual({ pull: true });
    });

    it("never applies to an attended pull", () => {
      expect(
        decideBankPull({
          kind: "attended",
          records: [record(TODAY, 4, 9, LONG_AGO)],
          today: TODAY,
          now: NOW,
          pullableAccounts: 1,
        }),
      ).toEqual({ pull: true });
    });

    it("starts again the next day", () => {
      expect(
        decideBankPull({
          kind: "unattended",
          records: [record("2026-09-03", 4, 0, LONG_AGO)],
          today: TODAY,
          now: NOW,
          pullableAccounts: 1,
        }),
      ).toEqual({ pull: true });
    });

    it("reports the allowance before the cooldown when both bite", () => {
      // "Come back tomorrow" is the more useful of the two to hear.
      const decision = decideBankPull({
        kind: "unattended",
        records: [record(TODAY, 4, 0, "2026-09-04T11:59:59.000Z")],
        today: TODAY,
        now: NOW,
        pullableAccounts: 1,
      });

      expect(decision).toMatchObject({ reason: "allowance-spent" });
    });
  });
});

describe("lastPullAt", () => {
  it("is null with nothing stored", () => {
    expect(lastPullAt([])).toBeNull();
  });

  it("takes the newest instant regardless of row order", () => {
    expect(
      lastPullAt([
        record("2026-09-03", 1, 0, "2026-09-03T23:00:00.000Z"),
        record("2026-09-04", 1, 0, "2026-09-04T07:00:00.000Z"),
      ]),
    ).toBe("2026-09-04T07:00:00.000Z");
  });
});

describe("unattendedUsedOn", () => {
  it("counts only the day asked for", () => {
    const records = [
      record("2026-09-04", 2, 5, LONG_AGO),
      record("2026-09-03", 4, 1, LONG_AGO),
    ];

    expect(unattendedUsedOn(records, "2026-09-04")).toBe(2);
    expect(unattendedRemaining(records, "2026-09-04")).toBe(2);
    expect(unattendedRemaining(records, "2026-09-03")).toBe(0);
  });

  it("cannot report a negative remainder", () => {
    // A cap lowered after the fact should read as "none left", not as debt.
    expect(
      unattendedRemaining([record(TODAY, 9, 0, LONG_AGO)], TODAY, {
        ...DEFAULT_PULL_BUDGET,
        unattendedPerDay: 4,
      }),
    ).toBe(0);
  });
});

describe("describePullAge", () => {
  it("says never when nothing has been pulled", () => {
    expect(describePullAge(null, NOW)).toBe("never");
  });

  it("says just now rather than zero minutes", () => {
    expect(describePullAge("2026-09-04T11:59:31.000Z", NOW)).toBe("just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(describePullAge("2026-09-04T11:40:00.000Z", NOW)).toBe("20 min ago");
    expect(describePullAge("2026-09-04T11:00:00.000Z", NOW)).toBe("1 hour ago");
    expect(describePullAge("2026-09-04T07:00:00.000Z", NOW)).toBe(
      "5 hours ago",
    );
    expect(describePullAge("2026-09-03T11:00:00.000Z", NOW)).toBe("yesterday");
    expect(describePullAge("2026-08-30T11:00:00.000Z", NOW)).toBe("5 days ago");
  });

  it("reads an unparseable instant as never", () => {
    expect(describePullAge("not a date", NOW)).toBe("never");
  });
});

describe("pullIsStale", () => {
  it("is stale when nothing has ever been pulled", () => {
    // A caller with no tally to read must not use this: unknown is not the
    // same as infinitely old, and `PullFreshness.known` is what draws the
    // distinction. This answers for a readable tally with nothing in it.
    expect(pullIsStale(null, NOW)).toBe(true);
  });

  it("turns stale at the threshold, not before", () => {
    expect(pullIsStale("2026-09-04T06:00:01.000Z", NOW)).toBe(false);
    expect(pullIsStale("2026-09-04T06:00:00.000Z", NOW)).toBe(true);
  });
});
