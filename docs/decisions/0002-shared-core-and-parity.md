# 0002. One set of rules, two apps with the same features

- **Date:** 2026-10-01 (`@finance/data`); earlier for `@finance/core`
- **Status:** Accepted
- **See also:** `docs/how-pluclair-works.md` « Shape », `packages/core/AGENTS.md`, `packages/data/AGENTS.md`

## Context

The web and phone apps drifted: the same figure was computed twice and the
same query written twice, so they disagreed. About twenty copies of "is this
migration applied?" lived across the two apps.

## Decision

- Every calculation, rule, schema and string lives once in
  `@finance/core`, pure and tested.
- Every Supabase read or write both apps make lives once in
  `@finance/data`, taking the caller's client.
- **Strict parity:** the web and the phone have the same features, each in
  its platform's own form (decided again on 2026-10-08). Web often lands
  first, and the phone follows in the same plan.

## Consequences

- A feature's plan has web and phone phases.
- Exceptions are named, not drifted into: the home-screen widget and the
  bank-notification listener are Android only; Entraide's moderation queue
  and the public site are web only.
