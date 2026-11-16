# 0025. No client cache: every screen reads what it shows

- **Date:** 2026-09 (both apps), refined 2026-10
- **Status:** Accepted
- **See also:** `docs/how-pluclair-works.md` « How every surface stays current »

## Context

A write in one place must reach every screen that shows it, on both apps and
across devices, without a cache that can go stale.

## Decision

- **Web:** server components read on each render. Every server action ends in
  `revalidateApp()`. `LiveRefresh` redraws other tabs and a tab coming back
  after a minute away.
- **Phone:** `announcingFetch` announces the data area of each write, and
  `useRefreshable` reloads the screens that read it.

## Consequences

- A new table or route needs its data area on the phone, or every tab
  redraws (`apps/mobile/AGENTS.md`).
