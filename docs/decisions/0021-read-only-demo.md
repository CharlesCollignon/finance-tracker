# 0021. A read-only demo, rebuilt every night

- **Date:** 2026-10-26
- **Status:** Accepted
- **See also:** `docs/how-pluclair-works.md` « The demo »

## Context

Visitors needed to see the app without signing up, and checks needed a safe
account to look at.

## Decision

- One account carries `app_metadata.demo = true`. A `refuse_demo_write`
  trigger on every public table refuses its writes (migration `081`).
- `/demo` signs a visitor in and opens Le point. `/api/cron/demo` rebuilds
  nine months of sample data, relative to today, every night.
- Forms open, so screens can be seen, but saving is refused.

## Consequences

- **Every table created later must add the trigger.** `087`'s `cards` did
  not. See `supabase/AGENTS.md`.
- The demo has no bank feed, cards or statements.
- It is the cheapest way to check a deployed screen.
