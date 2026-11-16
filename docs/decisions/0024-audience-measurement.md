# 0024. Audience measurement under one switch

- **Date:** 2026-10-08, extended 2026-11-12
- **Status:** Accepted

## Context

The owner needed to know whether Pluclair is used, without tracking people.
The draft privacy policy said « aucune mesure d'audience ».

## Decision

- First-party counting (migration `058`): a salted pseudonymous id, kept 13
  months, with an opt-out.
- Since 2026-11-12, Vercel Web Analytics and Speed Insights on the web app,
  under the same « Mesure d'audience » switch. Off, neither script loads.
  Addresses lose their query strings, invitation tokens and ids before they
  leave the browser. Global Privacy Control is respected for visitors without
  an account.

## Consequences

- The privacy policy and the register (§ 12) describe both.
