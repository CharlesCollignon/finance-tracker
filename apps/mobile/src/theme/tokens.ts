import type { TextStyle } from "react-native";

/**
 * Pluclair design tokens, drawn from the logo's orb and ground.
 * Kept as plain JS for React Navigation / inline styles.
 */

/**
 * The palette. There is one.
 *
 * A warm paper light palette used to sit beside this one, chosen from the
 * system colour scheme. Pluclair is dark now — the screen leads with a figure
 * over a veil, and a veil on paper is a smudge — so there is nothing to pick
 * between and no second set of values to keep honest.
 */
export const COLORS = {
  // Surfaces stay the cool near-black they were; only the accent turns gold.
  // At 11:1 on this ground the orb gold reads as text too, and needs no rim.
  background: "#0a0a10",
  foreground: "#ececf1",
  card: "#131320",
  cardForeground: "#ececf1",
  primary: "#e0be7a",
  primaryHover: "#eacb8f",
  primaryForeground: "#0a0a10",
  primaryInk: "#e0be7a",
  primaryRim: "#e0be7a",
  secondary: "#1c1c2b",
  secondaryForeground: "#ececf1",
  muted: "#1c1c2b",
  mutedForeground: "#9b9bad",
  accent: "#262015",
  accentForeground: "#ececf1",
  success: "#34d399",
  successForeground: "#0a0a10",
  info: "#22d3ee",
  infoForeground: "#0a0a10",
  destructive: "#f87171",
  destructiveForeground: "#0a0a10",
  border: "rgba(236,236,241,0.10)",
  hairlineStrong: "rgba(236,236,241,0.16)",
} as const;

/**
 * Charts: gold-anchored but still categorical, and spread on lightness as
 * well as hue. The closest pair stays 17 ΔE apart under protanopia,
 * deuteranopia and tritanopia; the palette this replaced fell to 5.4.
 */
export const CHART_COLORS = [
  "#d8a041",
  "#b05645",
  "#9fd08b",
  "#43acc7",
  "#968d88",
] as const;

/**
 * The palette, whatever scheme is asked for.
 *
 * The argument survives so the dozen call sites that thread a scheme through
 * from React Navigation and ECharts do not all have to change, and so the
 * seam is still there if a second palette is ever wanted. It is deliberately
 * ignored: one palette, one answer.
 */
export function colorsForScheme(_scheme?: "light" | "dark" | null | undefined) {
  return COLORS;
}

/** Soft elevation — no brutalist offset shadows. */
export const SOFT_SHADOW = {
  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.06)",
} as const;

/**
 * Icon sizes. Vector icons took ten different inline literals across the app
 * (11, 12, 13, 14, 15, 16, 18, 20, 22, 28), which is enough spread that no two
 * screens shared a rhythm. These are the whole scale; `size={13}` at a call
 * site is what this replaces.
 *
 * Two-point steps at the small end, because a single point is a visible
 * difference on a 14pt glyph and a meaningless one on a 28pt glyph.
 */
/**
 * The type scale, as style objects rather than `text-*` classes.
 *
 * Tailwind's size utilities set lineHeight along with fontSize, and on Android
 * that clipped the taller glyphs of this font — the header title already sets
 * its size through `style` for exactly that reason. So the display sizes live
 * here, where lineHeight stays unset and the platform uses the font's own
 * metrics.
 *
 * `tabular-nums` is not decoration on the numeric entries: proportional digits
 * change width as a figure animates, so a counting amount visibly jitters and
 * a right-aligned column of them never settles.
 */
/**
 * The face the display sizes are set in.
 *
 * Named here rather than as a `font-serif-semibold` class at the call site so
 * that one token carries the whole treatment — face, size, tracking and digit
 * metric — and a figure cannot pick up three of the four. React Native takes
 * the exact registered family and does not synthesise a weight from
 * `fontWeight`, so the semibold instance has to be asked for by name; see the
 * note in `src/app/_layout.tsx` about why these are static instances.
 */
const FIGURE_FACE = "Fraunces-SemiBold";

export const TYPE: Record<"hero" | "figure" | "micro", TextStyle> = {
  /** The one figure that owns a screen. Month on hand, portfolio total. */
  hero: {
    fontFamily: FIGURE_FACE,
    fontSize: 56,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  /** Card-level amounts, one step under the hero. */
  figure: {
    fontFamily: FIGURE_FACE,
    fontSize: 32,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  /** Timestamps, units, the line under a figure. */
  micro: { fontSize: 11 },
};

/** Digits that hold their column. Spread onto any Text showing an amount. */
export const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

export const ICON = {
  /** Inline with muted xs text — status dots, chevrons in dense rows. */
  xs: 12,
  /** Inline with sm text — row affordances. */
  sm: 14,
  /** Default: buttons, list leading icons. */
  md: 16,
  /** Section headers, sheet handles. */
  lg: 18,
  /** Primary controls, tab bar. */
  xl: 20,
  /** Empty states and the one-off large mark. */
  hero: 28,
} as const;
