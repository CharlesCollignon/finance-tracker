import type { Design } from "./designs";

/**
 * The colours of the designs other than « Nuit », for the phone
 * (`apps/mobile/src/theme/designs.ts`), keyed like its `COLORS`.
 *
 * The web states the same values as custom properties under
 * `:root[data-design="…"]` in `apps/web/app/globals.css`, and
 * `design-parity.test.ts` holds the two together value by value. « Nuit » is
 * not here: it is `COLORS` in `apps/mobile/src/theme/tokens.ts` and `:root`
 * on the web, already held together by the same test.
 *
 * Hairlines are an ink at « Nuit »'s two alphas, 0.10 and 0.16, because the
 * phone's `border` classes apply exactly those alphas to the channels.
 */
export interface DesignPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  primaryInk: string;
  primaryRim: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  successForeground: string;
  info: string;
  infoForeground: string;
  destructive: string;
  destructiveForeground: string;
  warning: string;
  warningForeground: string;
  border: string;
  hairlineStrong: string;
}

export const DESIGN_PALETTES: Record<Exclude<Design, "nuit">, DesignPalette> = {
  papier: {
    background: "#f6f1e7",
    foreground: "#1c1a17",
    card: "#fbf8f2",
    cardForeground: "#1c1a17",
    primary: "#9a3412",
    primaryHover: "#7c2d12",
    primaryForeground: "#fff8f0",
    primaryInk: "#9a3412",
    primaryRim: "#9a3412",
    secondary: "#ebe3d3",
    secondaryForeground: "#1c1a17",
    muted: "#ebe3d3",
    mutedForeground: "#5f584e",
    accent: "#f3e2cf",
    accentForeground: "#1c1a17",
    success: "#2f6b3a",
    successForeground: "#ffffff",
    info: "#1f5f8b",
    infoForeground: "#ffffff",
    destructive: "#b42318",
    destructiveForeground: "#ffffff",
    warning: "#865000",
    warningForeground: "#ffffff",
    border: "rgba(28,26,23,0.10)",
    hairlineStrong: "rgba(28,26,23,0.16)",
  },
  bento: {
    background: "#eef0f3",
    foreground: "#0f1115",
    card: "#ffffff",
    cardForeground: "#0f1115",
    primary: "#2340f5",
    primaryHover: "#1a31c4",
    primaryForeground: "#ffffff",
    primaryInk: "#2340f5",
    primaryRim: "#2340f5",
    secondary: "#e3e6eb",
    secondaryForeground: "#0f1115",
    muted: "#e6e9ee",
    mutedForeground: "#535a68",
    accent: "#e9f6b3",
    accentForeground: "#0f1115",
    success: "#116a32",
    successForeground: "#ffffff",
    info: "#0e6e8c",
    infoForeground: "#ffffff",
    destructive: "#c42b2b",
    destructiveForeground: "#ffffff",
    warning: "#a35200",
    warningForeground: "#ffffff",
    border: "rgba(15,17,21,0.10)",
    hairlineStrong: "rgba(15,17,21,0.16)",
  },
  console: {
    background: "#0b0b0b",
    foreground: "#ededed",
    card: "#121212",
    cardForeground: "#ededed",
    primary: "#fa9842",
    primaryHover: "#fbb26a",
    primaryForeground: "#0a0a10",
    primaryInk: "#fa9842",
    primaryRim: "#fa9842",
    secondary: "#1c1c1c",
    secondaryForeground: "#ededed",
    muted: "#1c1c1c",
    mutedForeground: "#9a9a9a",
    accent: "#2a1d10",
    accentForeground: "#ededed",
    success: "#6fd08c",
    successForeground: "#0b0b0b",
    info: "#6cc4ff",
    infoForeground: "#0b0b0b",
    destructive: "#ff7a7a",
    destructiveForeground: "#0b0b0b",
    warning: "#fbbd23",
    warningForeground: "#0a0a10",
    border: "rgba(255,255,255,0.10)",
    hairlineStrong: "rgba(255,255,255,0.16)",
  },
};
