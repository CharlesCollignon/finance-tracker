/**
 * Neo-brutalist design tokens ported from the web app's globals.css.
 * Kept as plain JS so they can be used in places NativeWind classes can't
 * reach (React Navigation options, inline style props, etc.).
 */
export const COLORS = {
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
