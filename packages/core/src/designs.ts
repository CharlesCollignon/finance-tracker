/**
 * The looks Pluclair can be read in, chosen per person in the profile.
 *
 * A design is a skin and nothing more: colours, the faces the figures and
 * headings are set in, and how round a corner is. Every screen keeps its
 * layout whichever one is on, so a design never decides what is shown or
 * where — only how it looks. The logo is the same in all of them: the orb
 * keeps its own colours (`--orb-c1/2/3` on the web, `Orb.tsx` on the phone)
 * and the wordmark its own face, whatever the palette around them does.
 *
 * - `nuit` — the dark, back-lit ledger Pluclair has always been; the default.
 * - `papier` — light: warm paper, serif figures, ruled and square.
 * - `bento` — light: grey ground, white tiles, round corners, a lime accent.
 * - `console` — dark: black, figures and headings in a fixed-width face.
 *
 * Stored in `user_preferences.design` (migration 088) so the phone and the
 * laptop agree, and cached on the web in a cookie so the first paint is
 * already in the right design.
 */
export const DESIGNS = ["nuit", "papier", "bento", "console"] as const;

export type Design = (typeof DESIGNS)[number];

export const DEFAULT_DESIGN: Design = "nuit";

/** The web's cookie, read by the root layout before anything is painted. */
export const DESIGN_COOKIE = "pc-design";

export function isDesign(value: unknown): value is Design {
  return (
    typeof value === "string" && (DESIGNS as readonly string[]).includes(value)
  );
}

/** A stored or sent value as a design; anything unknown is the default. */
export function parseDesign(value: unknown): Design {
  return isDesign(value) ? value : DEFAULT_DESIGN;
}

/** Whether a design is drawn on a light ground, for the system's own chrome. */
export function isLightDesign(design: Design): boolean {
  return design === "papier" || design === "bento";
}
