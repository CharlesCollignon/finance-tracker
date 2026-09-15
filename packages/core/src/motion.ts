/**
 * How things move, in both apps.
 *
 * These numbers already existed twice. `FadeIn.tsx` on the phone held the
 * curve, `Stagger.tsx` on each client held the same 40ms cadence with a
 * comment saying so, and `AnimatedAmount` was written twice at 650ms because
 * — as its own doc puts it — "the two clients show the same figure and a
 * spring settles on a different curve, so the same amount would arrive
 * differently depending on which screen you were holding".
 *
 * A comment is not a mechanism. This is, and it is the same move the rest of
 * `packages/core` makes: the shared truth lives once, and each client adapts
 * it to its own animation engine. CSS wants a string, Reanimated wants the
 * four control points, and both come from here.
 *
 * Pure, dependency-free, and deliberately free of any component: this module
 * describes motion, it does not perform it.
 */

/**
 * The app's one easing curve, as cubic-bezier control points.
 *
 * One curve rather than a set, because a screen where different blocks
 * decelerate differently reads as several screens.
 */
export const EASE_STANDARD = [0.32, 0.72, 0, 1] as const;

export const DURATION = {
  /** A block arriving on screen. */
  enter: 500,
  /** A figure counting to a new value. */
  count: 650,
  /** A panel opening or closing. */
  panel: 420,
} as const;

/** The gap between consecutive items in a staggered enter. */
export const STAGGER_STEP_MS = 40;

/**
 * Beyond this many steps the delay stops growing.
 *
 * A twelve-tile grid staggered without a cap leaves the last tile arriving
 * half a second after the first, which reads as the screen being slow rather
 * than as a flourish.
 */
export const STAGGER_MAX_STEPS = 8;

/** How long the item at `index` waits before entering. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP_MS;
}

/** The curve as a CSS `cubic-bezier()` value. */
export function cssEasing(
  points: readonly number[] = EASE_STANDARD,
): string {
  return `cubic-bezier(${points.join(", ")})`;
}

/**
 * Ease-out cubic — fast start, settles gently on the final figure.
 *
 * Kept separate from `EASE_STANDARD` because counting a number up is not the
 * same gesture as a block arriving, and both clients already agreed on this
 * one independently.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
