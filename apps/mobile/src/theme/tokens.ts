/**
 * Neo-brutalist design tokens ported from the web app's globals.css.
 * Kept as plain JS so they can be used in places NativeWind classes can't
 * reach (React Navigation options, inline style props, etc.).
 */

export const LIGHT_COLORS = {
  background: "#ffffff",
  foreground: "#000000",
  card: "#ffffff",
  cardForeground: "#000000",
  primary: "#ffdb33",
  primaryHover: "#ffcc00",
  primaryForeground: "#000000",
  secondary: "#000000",
  secondaryForeground: "#ffffff",
  muted: "#aeaeae",
  mutedForeground: "#5a5a5a",
  accent: "#fae583",
  accentForeground: "#000000",
  destructive: "#e63946",
  destructiveForeground: "#ffffff",
  border: "#000000",
} as const;

export const DARK_COLORS = {
  background: "#141414",
  foreground: "#f2f2ec",
  card: "#1d1d1d",
  cardForeground: "#f2f2ec",
  primary: "#ffdb33",
  primaryHover: "#ffcc00",
  primaryForeground: "#000000",
  secondary: "#f2f2ec",
  secondaryForeground: "#000000",
  muted: "#3a3a3a",
  mutedForeground: "#a8a8a0",
  accent: "#3a3418",
  accentForeground: "#f2f2ec",
  destructive: "#ff6b77",
  destructiveForeground: "#000000",
  border: "#f2f2ec",
} as const;

/** Default export keeps existing imports working (light palette). */
export const COLORS = LIGHT_COLORS;

export function colorsForScheme(
  scheme: "light" | "dark" | null | undefined,
) {
  return scheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

/**
 * Hard offset shadow (the brutalist "sticker" look). RN 0.76+ supports the
 * CSS `boxShadow` style prop, so we reuse the exact web offsets.
 */
export const BRUTAL_SHADOW = {
  boxShadow: "4px 4px 0px 0px #000000",
} as const;

export const BRUTAL_SHADOW_SM = {
  boxShadow: "2px 2px 0px 0px #000000",
} as const;

export function brutalShadowForScheme(
  scheme: "light" | "dark" | null | undefined,
) {
  const color = scheme === "dark" ? "#f2f2ec" : "#000000";
  return { boxShadow: `4px 4px 0px 0px ${color}` } as const;
}
