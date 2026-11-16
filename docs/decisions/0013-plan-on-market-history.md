# 0013. The Plan rests on market history; Pluclair stays free

- **Date:** 2026-10-25, reshaped 2026-10-26
- **Status:** Accepted (replaces the year-ahead card of 2026-10-09)
- **See also:** `docs/plans/PLAN_REDESIGN_PLAN.md`, `packages/core/src/history/`

## Context

The owner found the Plan "trop compliqué et pas assez pertinent", and wanted
real financial value grounded in market history.

## Decision

- The Plan replays the person's accounts at every start month since 1970:
  « Votre trajectoire » (the range), « Vos comptes » (growth per account,
  editable; an edited return shifts history, it doesn't replace it), and
  « Progression » (milestones, cushion, run).
- Share returns come from Global Factor Data (Jensen-Kelly-Pedersen,
  **CC BY-NC 4.0**) and public sources. Each source is listed in
  `HISTORY_SOURCES` with its terms.
- **Pluclair stays free**, confirmed by the owner. If anything is ever
  charged for, replace the share data first (Fama/French with permission, or
  a paid licence).
- The month close moved from the Plan to Le point.

## Consequences

- Crypto is never pre-filled from history.
- The phone runs the replay on Hermes, so it was rewritten to be fast (see
  `packages/core/AGENTS.md`).

## Don't

- Bring back crash tests, « Face à l'histoire » or an « Et si… » slider
  (removed 2026-10-26 after the owner tried them).
- Use MSCI data, free market-data APIs or other non-commercial-only sources
  without checking their terms.
