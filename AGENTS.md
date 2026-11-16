<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working on Pluclair

Pluclair is a free personal-finance app for French users: a Next.js web app,
an Expo phone app, one Supabase backend, and two shared TypeScript packages.
These are the rules for anyone who changes it, human or agent. Each folder
with its own habits has its own `AGENTS.md` (`apps/web`, `apps/mobile`,
`packages/core`, `packages/data`, `supabase`); read the one for the folder
you are in as well as this one.

## Read first

| You need                                                   | Read                                            |
| ---------------------------------------------------------- | ----------------------------------------------- |
| Which doc covers what                                      | `docs/README.md`                                |
| What a word means, and its French name                     | `CONTEXT.md`                                    |
| Which page shows which feature, and the code behind it     | `docs/feature-map.md`                           |
| How the parts fit, where each figure is computed           | `docs/how-pluclair-works.md`                    |
| Why something is the way it is, and what not to re-propose | `docs/decisions/README.md`                      |
| Who it is for and what it promises                         | `apps/web/PRODUCT.md`, `apps/mobile/PRODUCT.md` |
| How it looks and moves                                     | `apps/web/DESIGN.md`, `apps/mobile/DESIGN.md`   |
| Env vars, deploys, crons, releases, dashboards             | `docs/operations.md`                            |
| A feature's build plan and its open points                 | `docs/plans/<NAME>_PLAN.md`                     |

## Lines the product does not cross

The owner decided each of these on purpose. Don't build or suggest them again
unless the owner brings them up. The reasons are in `docs/decisions/`.

- **No score, goals, budgets or challenges.** Habit comes from use. Celebrate
  real events (« moments »). No XP, badges, levels or streak scores.
  ([0003](docs/decisions/0003-moments-not-a-score.md))
- **No advice on a specific product, fund, contract or provider.** Ask
  Pluclair may explain, compare and give labelled rules of thumb (tiers 0–3),
  nothing more. ([0007](docs/decisions/0007-ask-a-real-chat-advice-tiers.md))
- **No tax-return help.** No boxes, no filing help. Envelope tax rules and
  after-tax estimates stay. ([0006](docs/decisions/0006-no-tax-return-help.md))
- **No AI key of Pluclair's own.** Every AI call runs on the person's own
  OpenRouter account. ([0005](docs/decisions/0005-ai-on-the-persons-own-account.md))
- **Never reach into a bank.** No bank passwords, no scraping. The
  open-banking connection is the owner's only. Everyone else brings
  statements (files, e-mail, share, notifications).
  ([0009](docs/decisions/0009-bank-connection-owner-only.md),
  [0010](docs/decisions/0010-statements-you-bring.md))
- **French first.** French users, French banks, French and EU law. French is
  the default language and English the fallback.
  ([0001](docs/decisions/0001-french-users-first.md))
- **Pluclair stays free.** The Plan's market history is CC BY-NC data.
  Replace it before anything is ever charged for.
  ([0013](docs/decisions/0013-plan-on-market-history.md))
- **The logo never changes**, whatever the design (Nuit, Papier, Bento,
  Console). ([0016](docs/decisions/0016-four-designs-own-layouts.md))
- **Arrivals fade.** Things appear and leave with a fast opacity fade (180 ms
  in, 120 ms out). No springs or slides on arrival. Gestures, count-ups and
  moments stay. ([0012](docs/decisions/0012-arrivals-fade.md))
- **Removed, not to come back:** the « Abonnements » block on Récurrents,
  « Puis-je me permettre ? », « Une cible à viser », Plan's crash tests and
  « Et si… » slider, « Partager ce mois », « Par commerce », light under the
  pointer on cards, a scene behind the landing hero.
  ([0014](docs/decisions/0014-removed-on-purpose.md))

## How work flows

1. **One branch per phase or topic**, from an up-to-date `main`. Keep
   commits small, one concern each, and green on their own (typecheck, lint,
   knip, tests).
2. **Merging is the owner's call, every time.** Merge only on an explicit
   word for that batch (« merge », « push on main », « fusionne »). Approval
   for one batch does not carry to the next. Merge with
   `git merge --no-ff -m "Merge <branch>: <what it brings, in plain words>"`,
   then push `main`. ([0028](docs/decisions/0028-branch-per-phase-owner-merges.md))
3. **A reply that names no option is not a choice.** If you offered options
   and the answer is « ok » plus a condition, ask which option before you
   start a multi-commit build.
4. **« Nouveautés » is never behind.** See the next section.
5. **Docs move with the code**, in the same branch. See « Keeping the docs
   true » below.
6. **Say what you checked.** In the merge message and in your report, say
   what was seen running (browser, harness, device) and what was only
   typechecked and tested. Phone screens often can't be run here (see
   `apps/mobile/AGENTS.md`). Say so rather than imply they were seen.

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and on PRs, not on
branch pushes. To check a pushed branch: `gh workflow run ci.yml --ref
<branch>`. Vercel builds a preview for every pushed branch.

## « Nouveautés » is never behind

Every change that reaches `main` and that someone using Pluclair can see — a screen, a figure, a fix, the site — adds its entry to `packages/core/src/changelog-entries.ts` in the same branch, before the merge: French and English, plain words, only what is true, dated the day it reaches `main`. `node scripts/changelog-draft.mjs` lists what has landed since the newest entry; `--stats` updates the figures the page states. A change nobody can see (a refactor, a test, docs) says so with a `Changelog: none` line in a commit or in the merge message.

`.claude/settings.json` holds a hook (`scripts/changelog-guard.mjs`) that refuses a merge into `main`, or a push of `main`, that changes user-facing code without one or the other.

Two more rules:

- **Phone entries wait for the APK.** The feed reaches phones that are
  already installed, so a phone-only change gets its entry in the release
  branch for the next APK (`phone-<version>`), not on merge. Mark the commit
  `Changelog: phone only, in the next APK's entry`.
- **Re-date on merge.** An entry written days before its merge takes the
  merge day.

## Where code goes

| What                                                              | Where                                                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A calculation, a rule, a zod schema, a string                     | `packages/core` (pure: no I/O, no React)                                            |
| A Supabase read or write both apps make                           | `packages/data`, taking the caller's `db`                                           |
| A web screen                                                      | `apps/web/app/(app)/<route>/page.tsx` (server) + `apps/web/components/finance/...` |
| A web write                                                       | a server action in `apps/web/lib/actions/`, through `asUser`/`asOwner`             |
| Something the phone needs a server secret for (AI, bank, inbound) | a bearer route in `apps/web/app/api/`, sharing the server action's code             |
| A phone screen                                                    | `apps/mobile/src/app/...` + `apps/mobile/src/components/...`                        |
| A scheduled job                                                   | `apps/web/app/api/cron/<name>/route.ts` + `apps/web/vercel.json`                    |
| A schema change                                                   | `supabase/migrations/NNN_name.sql` + `supabase/tests/NNN_name.test.sql`             |
| A notification kind                                               | `packages/core/src/notification-kinds.ts`, sent by `apps/web/lib/push/`             |
| A feature switch                                                  | `packages/core/src/flags.ts` + a migration seeding it                               |

The web and the phone have the same features, each in its own native form
([0002](docs/decisions/0002-shared-core-and-parity.md)). A feature built on
one platform is built on the other in the same plan. The phone may land in a
later branch.

## Checks before every commit

The same gates as CI, from the repository root:

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec eslint --max-warnings 0 .
pnpm --filter mobile exec tsc --noEmit        # needs apps/mobile/expo-env.d.ts (CI: expo customize tsconfig.json)
pnpm --filter mobile exec expo lint --max-warnings 0
pnpm --filter @finance/core exec tsc --noEmit
pnpm --filter @finance/data exec tsc --noEmit
pnpm check:reachability                        # unused i18n keys + knip (unused files/exports)
pnpm check:docs                                # every route and migration is in the docs
pnpm test                                      # core, data and web vitest
```

Run them one after another, never in parallel (see « This machine »). Before
a partial commit, check `git diff --cached --stat`: a `git rm` or `git mv`
stays staged and rides along with the next commit. knip fails a commit that
adds an export nothing reads yet. Add an export in the same commit as its
first reader.

## Database changes

- A new migration takes the next number (`ls supabase/migrations | tail -1`).
  Add an assertion file in `supabase/tests/` for any RLS or function.
- After applying it locally, run `pnpm gen:types`, and narrow the types in
  `packages/core/src/types/database.ts` if needed.
- **Code must work before the migration runs on the hosted database.** Read a
  missing column as its default, and let a missing table give an empty
  result or a clear toast, never a crash. The owner runs migrations on the
  hosted project by hand, sometimes days after the merge.
- Say in the merge message which migrations the owner must run on the hosted
  database.
- **Never write to the hosted database.** `apps/web/.env.local` points at it.
  Hand the owner the SQL. Reading their data to diagnose a problem needs
  their OK for that one question: selects only.
- Every new table needs RLS and the demo account's `refuse_demo_write`
  trigger. See `supabase/AGENTS.md`.

## Copy and language

- Every string lives in `packages/core/src/i18n/messages/fr.ts` and `en.ts`,
  written in French first. `pnpm check:reachability` fails on a key nothing
  uses.
- Use the words in `CONTEXT.md`, in both languages, and no others. A new
  concept gets its entry there in the same branch.
- French typography: « guillemets » with spaces inside, the apostrophe ’ as
  the catalogue writes it, and elision left to `t()` (« d'octobre »).
- Plain words, no jargon, no exclamation-mark marketing. Pluclair states
  facts and doesn't judge (« constat », not « alerte »).
- Don't use gendered words for the owner or the reader.
- Copy that changes what data is processed (AI, bank, analytics) also
  changes `legal-copy*.ts` and `docs/legal/` (register, AIPD) in the same
  branch.

## Formatting traps

- **Never run `prettier --write` over `apps/mobile/src`.** The phone code is
  not Prettier-formatted. A run rewrites files you didn't touch. Edit in the
  surrounding style.
- **Never run Prettier on `docs/legal/*.md` or `docs/store/*.md`.** It shifts
  the indentation after `[[…]]` placeholders on every run.
- Web code, packages, `CONTEXT.md`, `docs/how-pluclair-works.md`,
  `docs/plans/` and `docs/decisions/` are Prettier-clean. Formatting a file
  you changed is fine there.

## This machine

The development machine is WSL2 with about 8 GB of RAM, shared with other
projects. A web typecheck or a Next build takes 1–2 GB, and the phone's web
bundle takes about 4 GB.

- **Run one heavy process at a time.** Don't run builds, typechecks or dev
  servers in parallel. Don't fan out several agents that each run them. Two
  terminal crashes lost work this way.
- **Commit often**, so a crash loses little.
- Don't `pkill -f` a pattern that also appears in your own command: it kills
  your shell. Kill by PID (`ss -ltnp | grep :<port>`).
- `:3000` may be another project's dev server. Check
  `readlink /proc/<pid>/cwd` before trusting it.

How to see a change running, cheapest first:

1. **After a deploy:** open `https://pluclair.com/demo` in headless Chromium.
   It signs into the read-only demo account. There is no bank, card or
   statement data there.
2. **A single web component:** a throwaway esbuild + Tailwind harness in a
   scratch folder, outside the repo.
3. **A pushed branch:** its Vercel preview. Ask the owner for the protection
   bypass secret each session, and never store it.
4. **Data code:** a throwaway vitest file run against the local Supabase,
   deleted afterwards.
5. **The phone:** a device with the next APK. The Expo web build doesn't fit
   in memory here.

## The repository is public

Never commit secrets, account ids, personal addresses, e-mail addresses
other than the published contact, or the owner's own figures. This applies
to code, fixtures, docs and commit messages. Use made-up data in fixtures and
examples. `apps/mobile/google-services.json` holds a Firebase client key that
is public by design. Restrict it; don't rotate it.

## Keeping the docs true

The same branch that changes the code updates the docs:

| When you…                                    | Update                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| add, move or remove a page, screen or route  | `docs/feature-map.md` (`pnpm check:docs` fails otherwise)                          |
| add a migration                              | its row in `docs/feature-map.md` « Migrations » (checked too)                      |
| add a term or rename one                     | `CONTEXT.md`                                                                       |
| change where a figure is computed, or a flow | `docs/how-pluclair-works.md`                                                       |
| change a look, a component rule, a motion    | `apps/*/DESIGN.md`                                                                 |
| change a promise or a principle              | `apps/*/PRODUCT.md`, and ask the owner first                                       |
| make, or receive, a product decision         | a new `docs/decisions/NNNN-*.md` + its line in `docs/decisions/README.md` timeline |
| add an env var, cron, dashboard step         | `docs/operations.md`                                                               |
| finish or abandon a plan phase               | the plan's status lines                                                            |
| learn a lasting rule the hard way            | the nearest `AGENTS.md`                                                            |
