import { describe, expect, it } from "vitest";

import {
  cssEasing,
  DURATION,
  EASE_STANDARD,
  easeOutCubic,
  staggerDelay,
  STAGGER_MAX_STEPS,
  STAGGER_STEP_MS,
} from "./motion";

describe("staggerDelay", () => {
  it("steps by the cadence both clients already use", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(STAGGER_STEP_MS);
    expect(staggerDelay(3)).toBe(3 * STAGGER_STEP_MS);
  });

  it("caps, so a long list does not leave later rows visibly late", () => {
    const capped = STAGGER_MAX_STEPS * STAGGER_STEP_MS;
    expect(staggerDelay(STAGGER_MAX_STEPS)).toBe(capped);
    expect(staggerDelay(STAGGER_MAX_STEPS + 40)).toBe(capped);
  });
});

describe("cssEasing", () => {
  it("writes the shared curve as a CSS value", () => {
    expect(cssEasing()).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
  });
});

describe("easeOutCubic", () => {
  it("lands exactly on both ends", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("is ahead of linear in the first half, which is what ease-out means", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("the vocabulary itself", () => {
  it("keeps the curve the phone already animates on", () => {
    expect(EASE_STANDARD).toEqual([0.32, 0.72, 0, 1]);
  });

  it("keeps the count-up duration AnimatedAmount fixed on both clients", () => {
    expect(DURATION.count).toBe(650);
  });
});
