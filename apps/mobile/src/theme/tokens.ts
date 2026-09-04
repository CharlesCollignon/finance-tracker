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
