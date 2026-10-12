<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# « Nouveautés » is never behind

Every change that reaches `main` and that someone using Pluclair can see — a screen, a figure, a fix, the site — adds its entry to `packages/core/src/changelog-entries.ts` in the same branch, before the merge: French and English, plain words, only what is true, dated the day it reaches `main`. `node scripts/changelog-draft.mjs` lists what has landed since the newest entry; `--stats` updates the figures the page states. A change nobody can see (a refactor, a test, docs) says so with a `Changelog: none` line in a commit or in the merge message.

`.claude/settings.json` holds a hook (`scripts/changelog-guard.mjs`) that refuses a merge into `main`, or a push of `main`, that changes user-facing code without one or the other.
