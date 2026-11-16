# 0004. Automate what the person already said; confirm what the app can't see

- **Date:** 2026-10 (several calls)
- **Status:** Accepted

## Context

The owner wants the UX "as simple as possible". The written principle that
every write is started by the person (PRODUCT.md, principle 2) got in the way
of that.

## Decision

- **Automate what the person already instructed.** Standing charges fill
  each month by themselves (the « Apply recurring » button is gone). A
  status row that only says "nothing to do" is hidden. There is one path per
  action (one add sheet for a transaction or a charge).
- **Ask for confirmation of what the app cannot verify.** A DCA bought at a
  broker the bank never sees becomes a « purchase to confirm » card, never a
  silent write. Older ones are not caught up.
- Keep the safeguards: never overwrite a row the person corrected, and say
  in a toast what was done automatically.

## Consequences

- Ask the owner before changing a written principle again.
