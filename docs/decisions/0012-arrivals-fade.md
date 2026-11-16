# 0012. Arrivals fade

- **Date:** 2026-10-25
- **Status:** Accepted (supersedes the springy arrivals of 2026-10-08)
- **See also:** `apps/web/DESIGN.md`, `apps/mobile/DESIGN.md`

## Context

In October the owner asked for playful, Framer-style motion for retention.
The springy, staggered arrivals that followed read as busy rather than calm.

## Decision

Everything that appears or leaves in the apps is an opacity fade:
`DURATION.enter` 180 ms, `DURATION.exit` 120 ms. No rise, slide, zoom, grow,
draw-in, spring or stagger on arrival, on the web and the phone.

Kept on purpose: motion driven by a finger (knobs, sliders, drags, press
feedback), count-ups, ambient light (the veil, the orb), and the moments.
The landing, `/a-propos` and `/telecharger` keep their scroll story.

## Consequences

- Web: `fade-in` / `fade-out` or `FADE`, `useFadePresence` for sheets.
  Phone: `FADE_IN` / `FADE_OUT` / `LAYOUT`.
- Exceptions are written in each app's DESIGN.md « Motion ».

## Don't

- Add a light that follows the pointer on app cards (removed 2026-10-09), or
  cards that lift on hover (removed 2026-11-06).
