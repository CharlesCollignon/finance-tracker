# 0028. A branch per phase; the owner merges

- **Date:** 2026-10-02
- **Status:** Accepted
- **See also:** `AGENTS.md` « How work flows »

## Context

The owner normally pushed straight to `main`, but wanted to look at each
phase of a larger plan before it landed.

## Decision

- One branch per phase, small commits, each green on its own.
- Merging into `main` is the owner's call for each batch, with
  `git merge --no-ff` and a message that says what the branch brings.
- Pushing a branch makes a Vercel preview; CI runs on `main`.

## Consequences

- Approval for one batch does not carry to the next.
