/**
 * How things move, in both apps.
 *
 * These numbers already existed twice. `FadeIn.tsx` on the phone held the
 * curve, each client held the same 40ms stagger with a comment saying so
 * (gone since everything fades in at once), and `AnimatedAmount` was written
 * twice at 650ms because
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

/**
 * The first three describe *arrival* — something appearing, counting, opening
 * — and were the only kinds this module named for a long time. That left the
 * commonest motion in the product, a surface answering the finger or pointer
 * on it, with nowhere to come from: the phone's Button reached for 120 and
 * 150, its QuickAddProvider for 110 and 140, and the web wrote 200 into 28
 * separate class strings. None of them were wrong; there was simply no word
 * for what they were all doing.
 *
 * `press` and `hover` are that word. Neither is a new opinion about how the
 * product should feel — 200ms is exactly what the web already spends on every
 * hover, and 140 sits between the two numbers the phone converged on — so
 * spending them changes provenance and not timing.
 *
 * Deliberately not a token: the phone's 850ms skeleton shimmer. That is a
 * loop, not an answer to anything, and a category with one member is worth
 * less than the literal and its comment.
 *
 * `enter` and `exit` are fades, and since October 2026 the only way anything
 * arrives in or leaves the app: opacity alone — nothing rises, slides, zooms,
 * grows or springs into place — fast enough to read as instant, slow enough
 * to read as smooth, and leaving quicker than it came. A block that changes
 * height on the way in or out spends the same two numbers on its height.
 */
export const DURATION = {
  /** A block arriving on screen: a fade, opacity only. */
  enter: 180,
  /** A block leaving the screen: a fade, quicker than it came. */
  exit: 120,
  /** A figure counting to a new value. */
  count: 650,
  /**
   * A panel opening on the public site. The app's panels fade in and out on
   * `enter` and `exit` like everything else.
   */
  panel: 420,
  /** A surface answering a press. */
  press: 140,
  /** A surface answering a pointer arriving or leaving. */
  hover: 200,
} as const;

/** The curve as a CSS `cubic-bezier()` value. */
export function cssEasing(points: readonly number[] = EASE_STANDARD): string {
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
