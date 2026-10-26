# Reference app

October 2026. After an audit of every page (2026-10-26), the owner chose two
groups of ideas and asked that the landing site follow: what makes the
month close's moat visible to the user, and the everyday polish a reference
app is expected to have. Nothing here is advice, a score, a goal or a
budget: every new figure is arithmetic on what the person already recorded.

One branch per phase, stacked on the one before so a single merge carries
all of it in order; one concern per commit; every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges and pushes.
Each phase adds its « Nouveautés » entry, and updates
`docs/how-pluclair-works.md`, `CONTEXT.md`, `apps/web/PRODUCT.md` and the
two `DESIGN.md` files wherever it changes what they say. A migration is
numbered from 077 and is the owner's to run on the hosted project.

This plan sits beside `EVERYDAY_PLAN.md` (daily use), `STATEMENTS_PLAN.md`
(statements, whose Phase 5 and e-mail route it picks up) and
`PLUCLAIR_UPGRADE_PLAN.md`.

## What is there today

- **Le point** draws an attention row (`buildAttention`: swallowed rows,
  the close, the inbox, recurring proposals) over up to fifteen conditional
  cards. « C'est arrivé ? », purchases to confirm, accounts awaiting a role
  and a consent ending each announce themselves on their own.
- **Recurring proposals** are offered to a bank-fed ledger only
  (`hasBankFeed`), so someone who imports statements never gets them,
  although the detector reads transactions whatever their source.
- **Filing** is learned from history (`merchant-memory`, `bank-merchant`)
  and never written down: the user cannot see or edit a rule.
- **The Journal** has three views: Liste, Calendrier, Par catégorie. A shop
  has no page.
- **The shared space** recounts a partner's spending (« Ma part ») but never
  says who put in more than their part.
- **A transaction** is one amount in one category, with a note; no split, no
  receipt.
- **Cmd+K** opens the quick-add sheet, with Questions as a second entry.
- **« Votre année »** has a shareable image; a month has none.
- **Placements** positions are typed by hand; no broker export is read, no
  dividend or realised gain is tracked.
- **A visitor** sees sample figures on the site and cannot try the app.
- **The web and phone Journals** are the two largest files in the repo,
  with most of their logic twice.
- **Ways in without a bank**: files, paste, share, e-mail (Mailgun set-up
  pending on the owner's side); no Android notification listener yet.

## Decisions taken (2026-10-26)

- **Build the second and third groups of the audit**, then adapt the
  landing site. The first group (backups, monitoring, tests, security,
  portability, OTA) is not in this plan.
- **No advice, no score, no goals, no budgets** — unchanged. The partner
  balance, the trust line and the merchant view state what was recorded.
- **Nothing merged or pushed without the owner's word.**

## Assumed (the owner can overturn any of these)

1. **Vocabulary** (added to `CONTEXT.md` with its phase): « Fiabilité du
   mois » (month trust), « Règle de rangement » (filing rule), « Par
   commerce » (by shop), « Équilibre » (partner balance), « Opération
   partagée en plusieurs » (split), « Justificatif » (receipt),
   « Palette » (command palette), « Relevé du mois » (the month to share),
   « Démo ».
2. **Branch chain**: `reference-plan` → `reference-1-trust` →
   `reference-2-todo` → `reference-3-rules` → `reference-4-merchants` →
   `reference-5-balance` → `reference-6-splits` → `reference-7-palette` →
   `reference-8-month-share` → `reference-9-broker` → `reference-10-demo` →
   `reference-11-journal-core` → `reference-12-listener` →
   `reference-13-landing`.
3. **Phone parity** is built in the same phase, each platform's own
   surface; phone screens are typechecked and, where possible, run in the
   component harness, not on a device.
4. **Filing rules** are « contains these words → this category », applied
   before the learned matcher, written from the inbox (« Toujours ranger
   ici ») and from a « Règles » page; a rule files automatically, which
   keeps commitment 2 (« a rule you wrote »).
5. **Splits** keep one row per part sharing a `split_group`; a receipt is a
   private file in Supabase storage, read by the person's own AI account
   only when they ask.
6. **The palette** keeps Cmd+K: the sheet it opens already holds the quick
   add and Questions; it grows into pages, months, shops and charges.
7. **The month to share** is an image, as « Votre année » is, with a print
   page for a PDF.
8. **The demo** is a seeded read-only account, reset nightly.
9. **Broker imports** read exports as the statement engine reads a bank's:
   content, never file name; without real anonymised exports the readers
   are built on synthetic fixtures and say so.
10. **The Android listener** is built behind a flag and marked unverified
    until an APK runs it; the e-mail route waits on the owner's Mailgun
    set-up, which this plan does not change.

## Phase 1 — The month's trust line, and proposals for importers (branch `reference-1-trust`)

- Recurring proposals wherever lines have come in (`hasFeedLines`), not only
  from a bank: Récurrents on both apps, and the attention row's count.
- `@finance/core/month-trust`: from the month's period, its close, the
  balance's source, the lines that cover it (the last day a bank or a
  statement reached), the charges arrived and awaited, and the rows waiting
  in « À vérifier », a few factual signals with an i18n key each.
- `readBearingMonth` reads the coverage (one query on `bank_feed_items`) and
  hands the signals on; a « Fiabilité du mois » card on Le point, web and
  phone, after the balance.

## Phase 2 — « À faire » on Le point (branch `reference-2-todo`)

- `buildAttention` grows to every decision the screen asks for: arrived
  charges, purchases to confirm, accounts awaiting a role, a consent ending
  or stopped, the monthly statement to bring, plus what it already had.
- One strip under the month picker, with the count; opened, every item with
  its own count and its way in. The decision cards keep their place, and the
  banners they replace go. Both tab badges read the same list.

## Phase 3 — Filing rules the user writes (branch `reference-3-rules`)

- Migration 077 `filing_rules` (owner, words, category, created from which
  line, `applied_count`), RLS select-own, deleted with the category.
- `@finance/core/filing-rules`: match words in a line's note, case- and
  accent-insensitive; the planner (`bank-feed`) asks the rules before the
  learned matcher and writes `decided_by = 'rule'`.
- « Toujours ranger ici » on an inbox group writes a rule; a « Règles » page
  (from Catégories and the inbox) lists, edits, deletes them, with how many
  lines each filed; both apps.

## Phase 4 — « Par commerce » (branch `reference-4-merchants`)

- `@finance/core/merchant-screen`: the last twelve months grouped by
  merchant key, each with its visits, its monthly normal, its last visit, its
  category; search within.
- A fourth Journal view, `/merchants` and the phone's `merchants`, and a
  merchant's panel from a row.

## Phase 5 — « Équilibre » in the shared space (branch `reference-5-balance`)

- Migration 078 `space_contributions`: a member reads what each partner put
  into the joint account over a span — their own transfer rows, the one sum
  the space may read.
- `@finance/core/space-balance`: per month, what each partner transferred to
  the joint account against their share of what the space spent; the
  difference, said as a fact.
- A card on Le point under « Commun », and the running figure in Profil's
  space section; both apps.

## Phase 6 — Splits and receipts (branch `reference-6-splits`)

- Migration 079: `transactions.split_group`, `transactions.receipt_path`,
  a private storage bucket `receipts` with owner-only policies.
- Split a row into parts from its form, the Journal drawing the group as
  one with its parts; attach a photo or a PDF; « Lire le ticket » on the
  person's AI account fills the amount and the shop.

## Phase 7 — The palette (branch `reference-7-palette`)

- Cmd+K's sheet becomes a palette: add, ask, go to a page, a month, a shop,
  a charge, a category; keyboard throughout. Web only; the phone keeps its
  search.

## Phase 8 — The month to share (branch `reference-8-month-share`)

- `/api/month-review/image`: the month's cards as a PNG, with or without
  amounts; « Partager ce mois » on Le point; a print page for a PDF; the
  phone shares through its sheet.

## Phase 9 — Broker imports, dividends, realised gains (branch `reference-9-broker`)

- Migration 080: `investment_events` (buy, sell, dividend, fee) per wallet,
  a person's own, with a fingerprint per line read from a file.
- `@finance/core/investment-events`: the events, realised gains per wrapper
  and year (first in, first out, uncovered sells said), dividends and fees
  by year, and `readBrokerRows`, a broker's CSV or spreadsheet read by its
  column names and each line's words (FR/EN); `tableRows` in
  `@finance/core/statement` gives any table file its rows.
- Both apps: « Opérations » on each wallet (list, hand entry, file import
  shown before it is stored), « Dividendes et plus-values réalisées » on
  Analyse. Built on synthetic exports (`investment-events.test.ts`).
- Not built: positions read off a broker's file (a position stays typed or
  searched), dividends as income in the ledger (they stay inside the
  wallet, as the card shows them).

## Phase 10 — The demo (branch `reference-10-demo`)

- Migration 081: `demo: true` in the auth user's app metadata (not a column
  on `owners`: nothing else needs it), `is_demo_user`, `demo_user_id`, and
  `refuse_demo_write` on every public table — writes refused by trigger
  rather than by RLS, so no policy had to change.
- `@finance/core/demo-sample` (nine months built for the day, the
  landing's figures), `@finance/data/demo`'s `resetDemo`, `/api/cron/demo`
  nightly (its own route, after the sweep), `scripts/seed-demo.mjs` for the
  account and the first seed; `/demo` signs the visitor in, `DemoBanner`
  above the shell, « Essayer la démo » in the hero when `DEMO_EMAIL` is set.
- Owner's part: choose `DEMO_EMAIL`/`DEMO_PASSWORD`, set them on Vercel,
  run the script once with `CRON_SECRET`.

## Phase 11 — One Journal (branch `reference-11-journal-core`)

- The list's view model (rows, planned rows, filters, search, selection) in
  `@finance/core/ledger-view`, both apps reading it; no change on screen.
  Done as `buildLedgerView` (the half shown, the rows kept and ordered,
  their days, the figures), `ledgerCategoryOptions`, `hiddenFilterCount`,
  `hasLedgerFilters` and `LEDGER_TYPE_FILTERS`: the two Journals' memo
  clusters became one call each; `filterLedger`, `ledgerDays` and the
  selection module were already shared.

## Phase 12 — The Android listener (branch `reference-12-listener`)

- STATEMENTS_PLAN Phase 5: a notification-listener module behind a flag,
  bank alerts read as provisional lines; unverified until an APK runs it.

## Phase 13 — The landing (branch `reference-13-landing`)

- The story, « Et tout ce qu'il y a autour », the feature pages and their
  mocks for what the phases built; « Bientôt » for what is not open; FAQ,
  store listing, `how-pluclair-works.md`, `PRODUCT.md`.

## The owner's part

- Merge and push each phase; run migrations 077–080 on the hosted project.
- Real anonymised broker exports for Phase 9's fixtures.
- Mailgun set-up for the e-mail route (`statements-email-setup`).
- An APK for Phases 3–12's phone screens, and a device for Phase 12.

## Open points

1. Whether « Il vous reste » returns to Le point or the site's copy changes
   (the audit's first decision): not in this plan.
2. Whether « économisé » becomes the headline figure (D7 of the upgrade
   plan): not in this plan.
