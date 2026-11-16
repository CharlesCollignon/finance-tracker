# 0015. « Nouveautés » is never behind

- **Date:** 2026-10-12
- **Status:** Accepted
- **See also:** `docs/plans/BLOG_CHANGELOG_PLAN.md`

## Context

The APK has no store and no over-the-air updates, so the in-app changelog
and the "new version" banner are the only way phone users hear about a
change. The owner asked that the changelog "always be updated when something
new is pushed".

## Decision

- Every visible change adds its entry to
  `packages/core/src/changelog-entries.ts` in the same branch, in French and
  English, dated the day it reaches `main`.
- A change nobody sees says so with `Changelog: none`.
- A PreToolUse hook (`scripts/changelog-guard.mjs`) refuses a merge into
  `main`, or a push of `main`, that breaks the rule.
- Phone-only entries wait for the APK that ships them.

## Consequences

- The rule lives in `AGENTS.md`. The hook only covers commands Claude Code
  runs; a merge done by hand is held by the rule alone.
