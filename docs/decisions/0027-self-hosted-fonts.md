# 0027. Fonts are self-hosted

- **Date:** 2026-10-09
- **Status:** Accepted

## Context

A production build failed although a preview of the same code had built:
Google Fonts sometimes answers with URLs Turbopack splits (a known flake).

## Decision

Every family (Instrument Sans, Fraunces, IBM Plex Mono, and the designs'
Bricolage Grotesque and Newsreader) is kept in `apps/web/app/fonts/` with its
OFL licence, and loaded with `next/font/local`. The wordmark is Orbit, in
`public/fonts/`.

## Consequences

- When a Vercel build fails on code that already built in a preview,
  suspect the environment first (`docs/operations.md`).

## Don't

- Bring back `next/font/google`.
