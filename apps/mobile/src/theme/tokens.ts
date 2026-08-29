/**
 * Minimal Pluclair design tokens (gold accent + semantic colors).
 * Kept as plain JS for React Navigation / inline styles.
 */

export const LIGHT_COLORS = {
  background: "#f8f9fb",
  foreground: "#16161d",
  card: "#ffffff",
  cardForeground: "#16161d",
  primary: "#4f2fd0",
  primaryHover: "#4426b8",
  primaryForeground: "#ffffff",
  primaryInk: "#4c2bb8",
  secondary: "#eef0f5",
  secondaryForeground: "#16161d",
  muted: "#eef0f5",
  mutedForeground: "#5f606b",
  accent: "#ece9fd",
  accentForeground: "#16161d",
  success: "#16803d",
  successForeground: "#ffffff",
  info: "#0e7490",
  infoForeground: "#ffffff",
  destructive: "#c23b2e",
  destructiveForeground: "#ffffff",
  border: "rgba(22,22,29,0.10)",
  hairlineStrong: "rgba(22,22,29,0.16)",
} as const;

export const DARK_COLORS = {
  background: "#0a0a10",
  foreground: "#ececf1",
  card: "#131320",
  cardForeground: "#ececf1",
  primary: "#a78bfa",
  primaryHover: "#b39dff",
  primaryForeground: "#0a0a10",
  primaryInk: "#a78bfa",
  secondary: "#1c1c2b",
  secondaryForeground: "#ececf1",
  muted: "#1c1c2b",
  mutedForeground: "#9b9bad",
  accent: "#241f3d",
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

/** Charts: gold + semantic + gray. */
export const CHART_COLORS = {
  light: ["#4f2fd0", "#c2186f", "#16803d", "#0e7490", "#6b6c78"],
  dark: ["#a78bfa", "#f472b6", "#34d399", "#22d3ee", "#83849a"],
} as const;

export function colorsForScheme(scheme: "light" | "dark" | null | undefined) {
  return scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
}

/** Soft elevation — no brutalist offset shadows. */
export const SOFT_SHADOW = {
  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.06)",
} as const;
