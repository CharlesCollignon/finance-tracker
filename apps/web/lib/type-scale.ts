/**
 * The figure scale — the web half of `TYPE` in
 * `apps/mobile/src/theme/tokens.ts`.
 *
 * Kept as strings rather than components for the reason `lib/glass.ts` gives
 * about its own three weights: they compose with `cn` at the call site, and a
 * wrapper per step would be three components that only forward children.
 *
 * One face at both steps. A hero figure used to be Fraunces while a
 * card-level one was the ledger mono, which meant the same amount changed
 * typeface depending on which component happened to draw it. On the phone the
 * split was worse than inconsistent: the hero went through a masking wrapper
 * that named no family at all, so it rendered in whatever the OS supplies.
 *
 * `tabular-nums` is not decoration here. Proportional digits change width as a
 * figure animates, so a counting amount visibly jitters, and a right-aligned
 * column of them never settles.
 *
 * The sizes stay responsive rather than matching the phone's flat 56px:
 * `MoneyOnHand` chose the narrow step deliberately so a six-figure balance and
 * its delta pill wrap instead of truncating at 320px. What the two clients owe
 * each other is the face, the weight and the digit metric — not a pixel.
 */

/** The one figure that owns a screen — month on hand, portfolio total. */
export const FIGURE_HERO =
  "font-serif font-semibold tracking-tight tabular-nums " +
  "text-[2.75rem] leading-[0.95] sm:text-5xl md:text-6xl";

/** Card-level amounts, one step under the hero. */
export const FIGURE =
  "font-serif font-semibold tracking-tight tabular-nums text-2xl md:text-3xl";

/** Timestamps, units, the line under a figure. Mirrors `TYPE.micro` (11px). */
export const MICRO = "text-[0.6875rem] leading-tight";
