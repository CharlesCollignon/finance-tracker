import { describe, expect, it } from "vitest";
import { drawSpineRing, resolveSpine } from "./spine";
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

// Spreads over the same complete fixture `pulse` does, under the name the
// second-figure tests below read most naturally.
const pulseWith = (over: Partial<MonthPulse> = {}): MonthPulse => pulse(over);

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

describe("drawSpineRing", () => {
  const proportion = (ratio: number, over: boolean) =>
    ({ kind: "proportion", ratio, tone: "clear", over }) as const;

  it("fills the ring in proportion and states the percentage it filled to", () => {
    expect(drawSpineRing(proportion(0.95, false))).toEqual({
      fill: 0.95,
      percent: 95,
      overshoot: 0,
    });
  });

  it("draws no overshoot lap at exactly the cap", () => {
    expect(drawSpineRing(proportion(1, false)).overshoot).toBe(0);
  });

  // The whole point of the second channel: at the cap and past it must not
  // resolve to the same drawing, and a clamped fill of 1 is all they would
  // otherwise share.
  it("separates at the cap from over it, which the fill alone cannot", () => {
    const atCap = drawSpineRing(proportion(1, false));
    const over = drawSpineRing(proportion(1.4, true));
    expect(over.fill).toBe(atCap.fill);
    expect(over.overshoot).toBeGreaterThan(atCap.overshoot);
  });

  it("grows the overshoot lap with how far past the cap the month is", () => {
    expect(drawSpineRing(proportion(1.4, true)).overshoot).toBeCloseTo(0.4);
    expect(drawSpineRing(proportion(1.75, true)).overshoot).toBeCloseTo(0.75);
  });

  it("keeps the lap visible when rounding leaves nothing to draw", () => {
    // `capRatio` is rounded to two places, so a month a hundredth over its
    // cap arrives here as exactly 1. The lap must still appear.
    expect(drawSpineRing(proportion(1, true)).overshoot).toBeGreaterThan(0);
  });

  it("caps the lap at one turn, so 250% does not wrap round unreadably", () => {
    expect(drawSpineRing(proportion(2.5, true)).overshoot).toBe(1);
  });

  it("states the true percentage rather than the one the fill stopped at", () => {
    expect(drawSpineRing(proportion(2.5, true)).percent).toBe(250);
  });

  it("never states a negative percentage or fills backwards", () => {
    expect(drawSpineRing(proportion(-0.2, false))).toEqual({
      fill: 0,
      percent: 0,
      overshoot: 0,
    });
  });
});

describe("the headline's second figure", () => {
  it("carries what the accounts hold when a balance is readable", () => {
    const state = resolveSpine({
      pulse: pulseWith({ onHand: 1240.5, free: 880.2 }),
      everClosed: true,
      closes: { streak: 3, bestStreak: 5 },
      remaining: 400,
    });

    expect(state.onHand).toBe(1240.5);
    expect(state.headline).toEqual({ figure: "free", value: 880.2 });
  });

  /**
   * The ladder's whole argument: a reader with no bank must not be shown a
   * figure that implies one. The headline falls back to the recorded
   * remaining, and the second figure is simply absent rather than zero.
   */
  it("has no second figure without a readable balance", () => {
    const state = resolveSpine({
      pulse: pulseWith({ onHand: null, free: null }),
      everClosed: false,
      closes: null,
      remaining: 400,
    });

    expect(state.onHand).toBeNull();
    expect(state.headline.figure).toBe("remaining");
  });
});
