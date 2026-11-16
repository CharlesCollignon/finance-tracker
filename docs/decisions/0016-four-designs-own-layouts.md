# 0016. Four designs, each with its own layouts; the logo never changes

- **Date:** 2026-11-06
- **Status:** Accepted
- **See also:** `docs/plans/DESIGN_LAYOUTS_PLAN.md`

## Context

The owner looked at design directions and kept three beside the original:
Papier, Bento and Console, plus Nuit. A first build changed only colours,
fonts and radii. The owner expected the layouts to change too.

## Decision

- Four designs to choose from in « Apparence »: Nuit, Papier, Bento,
  Console. Every screen has its own layout per design, on the web and the
  phone (navigation, tab bar, shared blocks, Le point, the Journal,
  Placements, the Plan).
- **The logo never changes** and stays well set in every design.
- The choice syncs across devices (`user_preferences.design`, migration
  `088`).

## Consequences

- Web: a `data-design` attribute, tag classes on blocks, styles in
  `globals.css`. Phone: `DesignProvider` and `theme/design-blocks.ts`.
  `design-parity.test.ts` holds the phone's palettes to the web's CSS.
- When the owner says « design », it can mean layout, not only colour.
