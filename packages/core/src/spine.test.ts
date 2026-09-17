import { describe, expect, it } from "vitest";
import { resolveSpine } from "./spine";
import type { MonthPulse } from "./month-pulse";

const pulse = (over: Partial<MonthPulse> = {}): MonthPulse =>
  ({
    free: 400,
    overRecorded: false,
    capRatio: 0.5,
    overCap: false,
    standing: "clear",
    ...over,
  }) as MonthPulse;

describe("resolveSpine", () => {
  it("falls back to remaining, and says so, when no balance is readable", () => {
    const state = resolveSpine({
      pulse: pulse({ free: null, standing: "unknown", capRatio: null }),
      everClosed: false,
      closes: null,
      remaining: 250,
    });
    expect(state.step).toBe("no-balance");
    expect(state.headline).toEqual({ figure: "remaining", value: 250 });
    expect(state.ring).toEqual({ kind: "dark" });
  });

  it("leads with free but keeps the ring dark until something has closed", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null }),
      everClosed: false,
      closes: null,
      remaining: 250,
    });
    expect(state.step).toBe("no-close");
    expect(state.headline).toEqual({ figure: "free", value: 400 });
    expect(state.ring).toEqual({ kind: "dark" });
  });

  it("draws an unproportioned arc at one close, because there is no cap yet", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null }),
      everClosed: true,
      closes: { streak: 1, bestStreak: 1 },
      remaining: 250,
    });
    expect(state.step).toBe("measuring");
    expect(state.ring).toEqual({ kind: "arc" });
  });

  // The gap six passing tests before this one did not cover: a baseline
  // close sets `openingBalance`, which is what makes `unrecordedSoFar`
  // measurable, so the month right after it is the `measuring` rung by the
  // spec's own rung-3 test — even though nothing has been reconciled yet, so
  // there is no streak to report. Run against the pre-fix module (where the
  // dark/arc boundary was `closes === null`, and a correct caller had no way
  // to express "one close happened, but it was a baseline, so there is no
  // streak yet" except by passing `closes: null` — indistinguishable from
  // "nothing has ever closed"), this failed: `expected 'no-close' to be
  // 'measuring'`. `everClosed` and `closes` are independent inputs precisely
  // so this case is expressible: something has closed, and there is
  // (correctly) no streak to show for it yet.
  it("draws the arc the month after a baseline-only close, before anything is reconciled", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null }),
      everClosed: true,
      closes: null,
      remaining: 250,
    });
    expect(state.step).toBe("measuring");
    expect(state.ring).toEqual({ kind: "arc" });
    expect(state.flame).toBeNull();
  });

  it("lights fully once a cap exists", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: 0.4, standing: "tight" }),
      everClosed: true,
      closes: { streak: 3, bestStreak: 5 },
      remaining: 250,
    });
    expect(state.step).toBe("lit");
    expect(state.ring).toEqual({
      kind: "proportion",
      ratio: 0.4,
      tone: "tight",
      over: false,
    });
    expect(state.flame).toEqual({ streak: 3, best: 5 });
  });

  it("removes the ring entirely when the account holds more than the ledger allows", () => {
    const state = resolveSpine({
      pulse: pulse({ overRecorded: true }),
      everClosed: true,
      closes: { streak: 3, bestStreak: 5 },
      remaining: 250,
    });
    expect(state.ring).toEqual({ kind: "absent" });
  });

  it("never gives the capless arc a tone, so it can never read as a verdict", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null, standing: "clear" }),
      everClosed: true,
      closes: { streak: 1, bestStreak: 1 },
      remaining: 250,
    });
    expect(state.ring).not.toHaveProperty("tone");
  });
});
