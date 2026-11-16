# 0006. No tax-return help

- **Date:** 2026-10-09
- **Status:** Accepted

## Context

A tax page was built (migration `066`, French tax-return boxes per
category) as part of the everyday plan.

## Decision

The owner had it removed the same day: "I don't want any of this in my app".
It is gone from the web, the phone and the landing. Migration `068` drops its
table.

## Consequences

- What stays: each envelope's tax rules and after-tax estimates (Plan,
  Placements). They describe accounts, not a declaration.

## Don't

- Suggest tax-return boxes, filing help or « case 6NS »-style claims, in the
  apps or the marketing copy.
