/**
 * Icon sizes — the web half of `ICON` in `apps/mobile/src/theme/tokens.ts`.
 *
 * The phone's copy of this records the problem it solved: vector icons had
 * taken ten different inline literals across the app (11, 12, 13, 14, 15, 16,
 * 18, 20, 22, 28), which is enough spread that no two screens shared a
 * rhythm. This is the whole scale; `size={13}` at a call site is what it
 * replaces.
 *
 * Two-point steps at the small end, because a single point is a visible
 * difference on a 14px glyph and a meaningless one on a 28px glyph.
 */
export const ICON = {
  /** Inline with muted xs text — status dots, chevrons in dense rows. */
  xs: 12,
  /** Inline with sm text — row affordances. */
  sm: 14,
  /** Default: buttons, list leading icons. */
  md: 16,
  /** Section headers, sheet handles. */
  lg: 18,
  /** Primary controls, the bottom bar. */
  xl: 20,
  /** Empty states and the one-off large mark. */
  hero: 28,
} as const;
