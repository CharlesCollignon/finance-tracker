/**
 * Pluclair design tokens, drawn from the logo's orb and ground.
 * Kept as plain JS for React Navigation / inline styles.
 */

export const LIGHT_COLORS = {
  // Warmed off the logo's ground but pulled back toward white, so the app
  // reads as paper rather than parchment. The gold is light, so it can only be a fill — white on it is
  // 2.0:1 — which is why there are three of them.
  background: "#f7f5f2",
  foreground: "#1c1814",
  card: "#ffffff",
  cardForeground: "#1c1814",
  primary: "#d5b163",
  primaryHover: "#c29e4f",
  primaryForeground: "#1c1814",
  /** Deep gold, for anything that has to be read. 5.8:1 on the ground. */
  primaryInk: "#7a5a1e",
  /** A gold fill is 1.9:1 against the ground; this carries the edge at 3.3:1. */
  primaryRim: "#a8812c",
  secondary: "#ece9e4",
  secondaryForeground: "#1c1814",
  muted: "#ece9e4",
  mutedForeground: "#6b6259",
  accent: "#f5e9ce",
  accentForeground: "#1c1814",
  success: "#157b3b",
  successForeground: "#ffffff",
  info: "#0e7490",
  infoForeground: "#ffffff",
  destructive: "#c23b2e",
  destructiveForeground: "#ffffff",
  border: "rgba(28,24,20,0.10)",
  hairlineStrong: "rgba(28,24,20,0.16)",
} as const;

export const DARK_COLORS = {
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
export const CHART_COLORS = {
  light: ["#a57b31", "#652b20", "#4b9157", "#2f5e6a", "#918883"],
  dark: ["#d8a041", "#b05645", "#9fd08b", "#43acc7", "#968d88"],
} as const;

export function colorsForScheme(scheme: "light" | "dark" | null | undefined) {
  return scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
}

/** Soft elevation — no brutalist offset shadows. */
export const SOFT_SHADOW = {
  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.06)",
} as const;
