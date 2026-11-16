# 0026. Deletes can be taken back for 30 days

- **Date:** 2026-09-20
- **Status:** Accepted
- **See also:** `docs/superpowers/specs/2026-09-20-soft-delete-and-undo-design.md`

## Context

A delete was final. A mistaken tap lost data.

## Decision

A deleted transaction or category is marked (`deleted_at`, migration `036`)
and hidden by the select policies. The toast's Undo restores it through
`restore_deletion`. The nightly sweep removes for good what is still marked
after 30 days. A statement import can be undone the same way.

## Consequences

- Every delete returns an undo token (`@finance/data/deletions`).
