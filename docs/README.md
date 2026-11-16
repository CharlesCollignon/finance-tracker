# Pluclair's docs

Every document in the repository, what it is for, and when it must change.
The rule for all of them is in `AGENTS.md` « Keeping the docs true »: the
branch that changes the code updates the doc.

## Start here

| Doc                          | What it holds                                                                                   | Update it when…                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AGENTS.md` (root)           | The working rules: product lines, git, checks, database, copy, the machine                      | a lasting rule is learned or decided                                                       |
| `<folder>/AGENTS.md`         | Rules for `apps/web`, `apps/mobile`, `packages/core`, `packages/data`, `supabase`               | that folder's habits change                                                                |
| `README.md` (root)           | What Pluclair is, the layout, setting up a machine                                              | setup or layout changes                                                                    |
| `docs/feature-map.md`        | Each feature → routes, screens, modules, tables, APIs, pushes, flags; every route and migration | a page, screen, route, migration, push kind or flag changes (checked by `pnpm check:docs`) |
| `docs/how-pluclair-works.md` | How the parts fit, where each figure is computed, known issues                                  | a flow, a computation or a known issue changes                                             |
| `docs/decisions/`            | Why: one record per decision, and the timeline of what shipped                                  | a product or lasting technical decision is made                                            |
| `docs/operations.md`         | Production: env vars, deploys, crons, bank, notifications, dashboards, releases                 | an env var, cron, dashboard setting or release step changes                                |
| `CONTEXT.md`                 | The glossary: every term and its French word                                                    | a term is added or renamed                                                                 |

## Product and design

| Doc                                             | What it holds                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/PRODUCT.md`, `apps/mobile/PRODUCT.md` | Who Pluclair is for, its promises and principles. Changed only with the owner |
| `apps/web/DESIGN.md`, `apps/mobile/DESIGN.md`   | Colours, type, layout, components, motion, do's and don'ts                    |

## Plans

`docs/plans/` holds one plan per larger piece of work: its phases, the
owner's answers, what was assumed, and what is left. Each plan's status lines
say which phases are merged. A finished plan stays as history; open points in
it are still open.

| Plan                              | Topic                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| `PLUCLAIR_UPGRADE_PLAN.md`        | The first upgrade plan; advice tiers (D1)                      |
| `QUALITY_SYNC_ENGAGEMENT_PLAN.md` | Notifications, moments, weekly recap, warnings                 |
| `REAL_ESTATE_PLAN.md`             | Immobilier                                                     |
| `PROPERTY_POLISH_PLAN.md`         | Immobilier's progress and links                                |
| `AI_ACCOUNT_PLAN.md`              | The person's own AI account                                    |
| `DCA_TRANSFER_PLAN.md`            | The transfer to the broker                                     |
| `MULTI_ACCOUNT_PLAN.md`           | Several bank accounts                                          |
| `BANK_CONNECT_PLAN.md`            | Bank sync for every user (now owner-only)                      |
| `BANK_PROVIDERS.md`               | Bank-data providers compared                                   |
| `EVERYDAY_PLAN.md`                | Daily use: search, imports, « Votre année », shared space, Ask |
| `SHARED_SPACE_DESIGN.md`          | The shared space's design                                      |
| `BLOG_CHANGELOG_PLAN.md`          | « Nouveautés », « Le blog », Entraide                          |
| `STATEMENTS_PLAN.md`              | Statements you bring                                           |
| `PLAN_REDESIGN_PLAN.md`           | The Plan on market history                                     |
| `REFERENCE_APP_PLAN.md`           | Trust, filing rules, splits, broker operations, the demo       |
| `CARDS_CADENCE_PLAN.md`           | Deferred-debit cards and payment rhythms                       |
| `DESIGN_LAYOUTS_PLAN.md`          | Layouts per design                                             |
| `MOBILE_WEB_AUDIT.md`             | Phone vs web audit (2026-10-01)                                |

`docs/superpowers/` holds the September 2026 design notes and plans (Le
point, category findings, soft delete). They are history: where they disagree
with the code, the code and `how-pluclair-works.md` win.

## Legal and stores

| Doc                                      | What it holds                                         |
| ---------------------------------------- | ----------------------------------------------------- |
| `docs/legal/registre-des-traitements.md` | The register of processing (GDPR art. 30)             |
| `docs/legal/AIPD.md`                     | The data protection impact assessment                 |
| `docs/legal/ENTRAIDE.md`                 | Entraide's legal decisions (hosting, DSA)             |
| `docs/store/`                            | Store listings, privacy labels, the release checklist |

Edit these by hand. Never run Prettier on them: it shifts the indentation
after `[[…]]` placeholders.

The public legal pages themselves are code: `apps/web/components/marketing/legal-copy*.ts`.

## Writing docs here

- Plain words and short sentences. Name files and functions in backticks.
- French terms in « guillemets », as the screens write them.
- Say when something was last true if it can drift (« as of 2026-11-16 »).
- Don't copy a fact that another doc owns; link to it. The feature map owns
  « where », the decisions own « why », `how-pluclair-works.md` owns « how »,
  `operations.md` owns « in production ».
- The repository is public: no secrets, account ids, personal addresses or
  the owner's own figures.
