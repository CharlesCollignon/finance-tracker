/**
 * Minimal Pluclair design tokens (muted gold accent + semantic colors).
 * Kept as plain JS for React Navigation / inline styles.
 */

export const LIGHT_COLORS = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#fafafa",
  cardForeground: "#0a0a0a",
  primary: "#c9a05a",
  primaryHover: "#b8904a",
  primaryForeground: "#ffffff",
  secondary: "#f4f4f5",
  secondaryForeground: "#0a0a0a",
  muted: "#f4f4f5",
  mutedForeground: "#71717a",
  accent: "#f5f0e8",
  accentForeground: "#0a0a0a",
  success: "#16a34a",
  successForeground: "#ffffff",
  info: "#2563eb",
  infoForeground: "#ffffff",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  border: "#e4e4e7",
} as const;

export const DARK_COLORS = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  card: "#141414",
  cardForeground: "#fafafa",
  primary: "#dbb87a",
  primaryHover: "#e4c48e",
  primaryForeground: "#0a0a0a",
  secondary: "#1c1c1c",
  secondaryForeground: "#fafafa",
  muted: "#1c1c1c",
  mutedForeground: "#a1a1aa",
  accent: "#1f1c17",
  accentForeground: "#fafafa",
  success: "#34d399",
  successForeground: "#0a0a0a",
  info: "#60a5fa",
  infoForeground: "#0a0a0a",
  destructive: "#f87171",
  destructiveForeground: "#0a0a0a",
  border: "#27272a",
} as const;

/** Charts: gold + semantic + gray. */
export const CHART_COLORS = {
  light: ["#c9a05a", "#dc2626", "#16a34a", "#2563eb", "#a1a1aa"],
  dark: ["#dbb87a", "#f87171", "#34d399", "#60a5fa", "#a1a1aa"],
} as const;

/** Default export keeps existing imports working. */
export const COLORS = DARK_COLORS;

export function colorsForScheme(scheme: "light" | "dark" | null | undefined) {
  return scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
}

/** Soft elevation — no brutalist offset shadows. */
export const SOFT_SHADOW = {
  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.06)",
} as const;
