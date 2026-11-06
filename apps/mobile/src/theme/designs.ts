import { vars } from "nativewind";
import { Appearance } from "react-native";
import { DESIGN_PALETTES } from "@finance/core/design-palettes";
import {
  DEFAULT_DESIGN,
  isLightDesign,
  type Design,
} from "@finance/core/designs";

import { COLORS, TYPE } from "@/theme/tokens";

/**
 * The design the phone is drawn in (`packages/core/src/designs.ts`).
 *
 * A design restates the palette and the face figures are set in; nothing
 * else moves, and the logo least of all — the orb keeps its own colours
 * (`components/Orb.tsx`) and the wordmark its own face (Orbit).
 *
 * Two kinds of call site read the palette, and each is reached its own way:
 *
 * - classes (`bg-card`, `text-primary`) read CSS variables, which
 *   `designVars` restates on the root view for everything under it;
 * - code (`useThemeColors()`, `COLORS.x`, `TYPE.hero`) reads the objects in
 *   `theme/tokens.ts`, which `applyDesign` rewrites in place.
 *
 * Both are read while rendering, and a change of design remounts the
 * navigator (`app/_layout.tsx`), so nothing on screen keeps the old values.
 */

/** « Nuit »'s values, kept before any design rewrites `COLORS`. */
const NUIT = { ...COLORS };

/** The face figures (`TYPE.hero`, `TYPE.figure`) are set in, per design. */
const FIGURE_FACES: Record<Design, string> = {
  nuit: "Fraunces-SemiBold",
  papier: "Newsreader-SemiBold",
  bento: "BricolageGrotesque-Bold",
  console: "IBMPlexMono-Medium",
};

let current: Design = DEFAULT_DESIGN;

/** The design on screen now. */
export function currentDesign(): Design {
  return current;
}

/** The face a large figure is set in, in the design on screen. */
export function figureFace(): string {
  return FIGURE_FACES[current];
}

/**
 * Rewrite the palette and the figure face for this design, and tell the
 * system which keyboard and dialogs to draw. Call before the tree that reads
 * them renders: at boot, and before the remount a change triggers.
 */
export function applyDesign(design: Design): void {
  current = design;
  const palette = design === "nuit" ? NUIT : DESIGN_PALETTES[design];
  // `COLORS` is declared `as const` for its readers; this is the one writer.
  Object.assign(COLORS as Record<keyof typeof NUIT, string>, palette);
  TYPE.hero.fontFamily = FIGURE_FACES[design];
  TYPE.figure.fontFamily = FIGURE_FACES[design];
  Appearance.setColorScheme(isLightDesign(design) ? "light" : "dark");
}

/** "#f6f1e7" or "rgba(28,26,23,0.10)" as the "246 241 231" a class reads. */
function channels(value: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value.replace(/\s+/g, ""));
  return rgba ? rgba[1]!.split(",").slice(0, 3).join(" ") : value;
}

/** camelCase token to the kebab-case variable `global.css` declares. */
function variable(key: string): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

const VARS = new Map<Design, ReturnType<typeof vars>>();

/**
 * The CSS variables of a design, for the root view's `style`. « Nuit » is
 * `:root` in `global.css` already, so it restates nothing.
 */
export function designVars(design: Design): ReturnType<typeof vars> | null {
  if (design === "nuit") {
    return null;
  }
  let style = VARS.get(design);
  if (!style) {
    const palette = DESIGN_PALETTES[design];
    style = vars(
      Object.fromEntries(
        Object.entries(palette).map(([key, value]) => [
          variable(key),
          channels(value),
        ]),
      ),
    );
    VARS.set(design, style);
  }
  return style;
}
