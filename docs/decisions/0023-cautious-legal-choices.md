# 0023. Always the cautious legal choice

- **Date:** 2026-10-13
- **Status:** Accepted
- **See also:** `docs/legal/`, [0009](0009-bank-connection-owner-only.md)

## Context

The owner doesn't want to deal with legal matters. Their instruction: keep
the app legal, remove anything that isn't clearly legal, and fill the grey
areas when they carry no risk.

## Decision

- Take the cautious option every time, and say plainly that the advice isn't
  a lawyer's.
- Pluclair is published by a private individual. The legal pages, the
  register of processing and the AIPD are complete and public; no personal
  address appears in the repository.
- Legal switches (`LEGAL_DRAFT`, `ENTRAIDE_RULES_DRAFT`) publish commitments
  in the owner's name. Only the owner flips them.

## Consequences

- A change to what data is processed updates `legal-copy*.ts` and
  `docs/legal/` in the same branch.
