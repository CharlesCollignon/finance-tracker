import { describe, expect, it } from "vitest";
import { buildMonthTrust, type MonthTrustInput } from "./month-trust";

const base: MonthTrustInput = {
  period: "current",
  today: "2026-10-26",
  close: null,
  closeDue: "2026-11-05",
  closable: false,
  feeds: true,
  coverage: { lines: 40, lastDay: "2026-10-25", pending: 0 },
  charges: { arrived: 5, awaited: 0 },
};

describe("buildMonthTrust", () => {
  it("says nothing about a month ahead", () => {
    expect(buildMonthTrust({ ...base, period: "future" })).toEqual([]);
  });

  it("tells the four signals in a fixed order, as keys and never text", () => {
    const signals = buildMonthTrust(base);
    expect(signals.map((signal) => signal.id)).toEqual([
      "coverage",
      "charges",
      "inbox",
      "close",
    ]);
    expect(signals[0]).toEqual({
      id: "coverage",
      tone: "ok",
      messageKey: "bearingMonth.trust.coveredUntil",
      date: "2026-10-25",
    });
    expect(signals[1]).toEqual({
      id: "charges",
      tone: "ok",
      messageKey: "bearingMonth.trust.chargesArrived",
      params: { count: 5 },
    });
    expect(signals[2]).toEqual({
      id: "inbox",
      tone: "ok",
      messageKey: "bearingMonth.trust.inboxClear",
    });
    expect(signals[3]).toEqual({
      id: "close",
      tone: "waiting",
      messageKey: "bearingMonth.trust.closeDue",
      date: "2026-11-05",
    });
    for (const signal of signals) {
      expect(signal).not.toHaveProperty("text");
    }
  });

  it("says a ledger typed by hand has no statement, and no charge to await", () => {
    const signals = buildMonthTrust({
      ...base,
      feeds: false,
      coverage: { lines: 0, lastDay: null, pending: 0 },
    });
    expect(signals.map((signal) => signal.id)).toEqual(["coverage", "close"]);
    expect(signals[0]).toMatchObject({
      tone: "none",
      messageKey: "bearingMonth.trust.typedByHand",
    });
  });

  it("waits for the bank when the last line is more than three days old", () => {
    const [coverage] = buildMonthTrust({
      ...base,
      coverage: { lines: 12, lastDay: "2026-10-22", pending: 0 },
    });
    expect(coverage).toMatchObject({ tone: "waiting", date: "2026-10-22" });
    const [recent] = buildMonthTrust({
      ...base,
      coverage: { lines: 12, lastDay: "2026-10-23", pending: 0 },
    });
    expect(recent).toMatchObject({ tone: "ok" });
  });

  it("does not call a month that has ended stale", () => {
    const [coverage] = buildMonthTrust({
      ...base,
      period: "past",
      coverage: { lines: 12, lastDay: "2026-09-28", pending: 0 },
    });
    expect(coverage).toMatchObject({ tone: "ok" });
  });

  it("counts the charges still awaited ahead of those arrived", () => {
    const signals = buildMonthTrust({
      ...base,
      charges: { arrived: 3, awaited: 2 },
    });
    expect(signals[1]).toEqual({
      id: "charges",
      tone: "waiting",
      messageKey: "bearingMonth.trust.chargesAwaited",
      params: { count: 2 },
      href: "/transactions",
    });
  });

  it("says nothing of charges when none was due yet", () => {
    const signals = buildMonthTrust({
      ...base,
      charges: { arrived: 0, awaited: 0 },
    });
    expect(signals.map((signal) => signal.id)).not.toContain("charges");
  });

  it("points at the inbox while lines wait there", () => {
    const signals = buildMonthTrust({
      ...base,
      coverage: { lines: 12, lastDay: "2026-10-25", pending: 4 },
    });
    expect(signals[2]).toEqual({
      id: "inbox",
      tone: "waiting",
      messageKey: "bearingMonth.trust.inboxPending",
      params: { count: 4 },
      href: "/transactions?review=inbox",
    });
  });

  it("says what the close found, as an amount the client formats", () => {
    const closed = buildMonthTrust({
      ...base,
      period: "past",
      close: { unrecorded: 48.5, kept: 300 },
    });
    expect(closed.at(-1)).toEqual({
      id: "close",
      tone: "ok",
      messageKey: "bearingMonth.trust.closed",
      amount: 48.5,
    });
    const clear = buildMonthTrust({
      ...base,
      period: "past",
      close: { unrecorded: null, kept: 300 },
    });
    expect(clear.at(-1)).toMatchObject({
      messageKey: "bearingMonth.trust.closedClear",
    });
    const baseline = buildMonthTrust({
      ...base,
      period: "past",
      close: { unrecorded: null, kept: null },
    });
    expect(baseline.at(-1)).toMatchObject({
      messageKey: "bearingMonth.trust.closedBaseline",
    });
  });

  it("offers the close of a month that is ready for it", () => {
    const signals = buildMonthTrust({
      ...base,
      period: "past",
      closable: true,
      closeDue: null,
    });
    expect(signals.at(-1)).toEqual({
      id: "close",
      tone: "waiting",
      messageKey: "bearingMonth.trust.closeReady",
      href: "/bearing?close=1",
    });
  });

  it("calls a past month with no close what it is", () => {
    const signals = buildMonthTrust({
      ...base,
      period: "past",
      closeDue: null,
    });
    expect(signals.at(-1)).toMatchObject({
      tone: "none",
      messageKey: "bearingMonth.trust.notClosed",
    });
  });
});
