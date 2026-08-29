/**
 * Minimal Pluclair design tokens (gold accent + semantic colors).
 * Kept as plain JS for React Navigation / inline styles.
 */

export const LIGHT_COLORS = {
  background: "#fbfaf7",
  foreground: "#1c1a16",
  card: "#ffffff",
  cardForeground: "#1c1a16",
  primary: "#0a6fbf",
  primaryHover: "#005a99",
  primaryForeground: "#ffffff",
  primaryInk: "#0060a0",
  secondary: "#f2efe7",
  secondaryForeground: "#1c1a16",
  muted: "#f2efe7",
  mutedForeground: "#6b6459",
  accent: "#f7f0d9",
  accentForeground: "#1c1a16",
  success: "#16803d",
  successForeground: "#ffffff",
  info: "#7c3aed",
  infoForeground: "#ffffff",
  destructive: "#c23b2e",
  destructiveForeground: "#ffffff",
  border: "rgba(28,26,22,0.08)",
  hairlineStrong: "rgba(28,26,22,0.14)",
} as const;

export const DARK_COLORS = {
  background: "#0b0905",
  foreground: "#f6efe0",
  card: "#15100a",
  cardForeground: "#f6efe0",
  primary: "#38b6ff",
  primaryHover: "#5cc8ff",
  primaryForeground: "#04121c",
  primaryInk: "#4cc2ff",
  secondary: "#1d160d",
  secondaryForeground: "#f6efe0",
  muted: "#1d160d",
  mutedForeground: "#ab9f86",
  accent: "#2a2410",
  accentForeground: "#f6efe0",
  success: "#34d399",
  successForeground: "#0a0a0a",
  info: "#a78bfa",
  infoForeground: "#0a0a0a",
  destructive: "#f87171",
  destructiveForeground: "#0a0a0a",
  border: "rgba(255,246,230,0.08)",
  hairlineStrong: "rgba(255,246,230,0.15)",
} as const;

/** Charts: gold + semantic + gray. */
export const CHART_COLORS = {
  light: ["#0a6fbf", "#c23b2e", "#16803d", "#7c3aed", "#948a73"],
  dark: ["#38b6ff", "#f87171", "#34d399", "#a78bfa", "#7c7360"],
} as const;

export function colorsForScheme(scheme: "light" | "dark" | null | undefined) {
  return scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
}

/** Soft elevation — no brutalist offset shadows. */
export const SOFT_SHADOW = {
  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.06)",
} as const;
