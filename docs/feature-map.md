# Feature map

Which page shows which feature, and the code, tables, server routes,
notifications and switches behind it. Use it to find where to start a
change, and to see what else a change touches.

- **Words** come from `CONTEXT.md`. Each feature gives its French name first,
  as the screens show it.
- **Why** a feature is shaped the way it is: `docs/decisions/`. **How** its
  figures are computed: `docs/how-pluclair-works.md`.
- Paths are relative to each app: `apps/web/` for web files,
  `apps/mobile/src/` for phone files, `packages/core/src/` and
  `packages/data/src/` for `@finance/core/…` and `@finance/data/…`.
- `pnpm check:docs` (`scripts/docs-check.mjs`) holds the « Route index » and
  « Migrations » sections to the code, in both directions. A page, screen,
  route or migration added without its line here fails CI, and so does a
  line left behind after a removal. The feature sections above them are kept
  by hand: update them in the same branch.

## Navigation

| Place             | Web                                                                                                                         | Phone                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Main bar          | Le point, Journal, Récurrents, Placements, Immobilier, Plan (`lib/navigation.ts`, shell per design in `components/layout/`) | Same six tabs (`app/(tabs)/_layout.tsx`). Journal's tab is `(tabs)/calendar`; its other views are hidden tabs that keep it lit. |
| A surface's views | `SurfaceTabs`: Journal → Calendrier / Liste / Par catégorie; Placements → Comptes / Analyse / Composition                   | `components/layout/SurfaceTabs`, same views                                                                                     |
| Account menu      | `components/layout/AccountMenu.tsx`: Profil, Catégories, Importer, Banque, Nouveautés, Entraide, sign out                   | Profil tab and its rows                                                                                                         |
| Add               | The floating « + » and the command palette open the add sheet (`QuickAddProvider`)                                          | The bar's « + », and the `add` deep link (`pluclair://add`)                                                                     |
| Search and go-to  | Cmd+K / Ctrl+K: `components/layout/CommandPalette.tsx` (« 23,45 courses », search, `G` then a letter)                       | Search inside the Journal                                                                                                       |
| Shared space      | Owner switch in the header (`OwnerSwitch`, cookie `pluclair-owner`)                                                         | `OwnerProvider`, switch in Profil                                                                                               |

Personal-only surfaces (Plan, Placements) are hidden while a shared space is
shown.

## Features

### Le point — the home screen (`bearing`)

Where the month stands: the balance, what is spent, what is still to come,
what has arrived, the « À faire » strip, the weekly recap, the month read,
the month close, setup steps and moments.

- **Web:** `/bearing` (`/bearing?close=1` opens the month close).
  `components/finance/bearing/` (`BearingMonthView`, `MonthReadSlot`,
  `RecapSlot`), `MonthCloseSheet`, `ArrivedCharges`, `PurchasesToConfirm`.
- **Phone:** `(tabs)/index`. `components/bearing/` (`BalanceCard`,
  `SpentCard`, `UpcomingCard`, `WhereItWentCard`, `TodoStrip`, `TrustCard`,
  `WeeklyRecapCard`, `MomentumCard`…), `MonthRead`, `ArrivedCharges`,
  `PurchasesToConfirm`.
- **Core:** `month-balance`, `still-to-come`, `left-to-spend`, `month-pulse`,
  `month-close`, `month-trust`, `attention`, `setup-steps`, `weekly-recap`,
  `month-facts`, `month-read`, `purchases-to-confirm`, `pay-period`,
  `business-days`.
- **Data:** `bearing-month`, `month-balance`, `balance-reading`, `closing`,
  `month-close`, `left-to-spend`, `weekly-recap`, `purchases-to-confirm`,
  `space-balance`.
- **Server:** `/api/month-read` (phone writes a month read on the person's AI
  account).
- **Push:** `recap`, `overdraft`, `close`, `bigCharge`, `arrived`,
  `monthOpen`, `milestone`.
- **Read more:** `docs/how-pluclair-works.md` « Le point, first »;
  `CONTEXT.md` « Closing the books », « Where it all stands »; ADR 0003.

### Journal — Calendrier, Liste, Par catégorie (`ledger`)

Every movement of the month: the calendar (where the Journal opens), the
list with the bank's review inbox (« À vérifier »), and categories over time.

- **Web:** `/calendar` (`CalendarView`, `CalendarPulse`), `/transactions`
  (`TransactionsView`, `BankInbox`, `SwallowedRecovery`, `ImportInvite`,
  `SelectionBar`), `/history` (`category/CategoryHistoryView`).
- **Phone:** `(tabs)/calendar`, `(tabs)/transactions` (`BankInboxSheet`),
  `(tabs)/history` (`components/category/`).
- **Core:** `ledger-view` (`buildLedgerView`, one Journal for both apps),
  `calendar`, `ledger-search`, `ledger-csv`, `bank-inbox-groups`,
  `bank-decided-groups`, `fulfilment-state`, `recurring-fulfilment`,
  `category-history`, `category-findings`, `category-screen`, `selection`,
  `cash-date`, `purchase-day`.
- **Data:** `ledger`, `month-ledger`, `history`, `ledger-search`,
  `bank-inbox`, `feed-decisions`, `fulfilment`, `fulfilment-decisions`,
  `splits`, `deletions`, `moved-rows`, `category-screen`.
- **Server:** `/api/bank/feed` (phone files inbox groups), `/api/category-read`
  and `/api/category-rerank` (category reads on the person's AI account),
  `/api/receipts` (reading a receipt).
- **Push:** `review`, `spending`, `arrived`.
- **Read more:** `CONTEXT.md` « Money movements »; ADR 0018, 0020.

### Récurrents — standing instructions (`recurring`)

Charges and incomes that repeat: rent, salary, subscriptions, DCAs, loans.
They fill each month by themselves and are matched to bank lines. Includes
suggestions found in the bank's history, and the DCA transfer to the broker
kept under the hood.

- **Web:** `/recurring` (`RecurringView`, `RecurringForm`,
  `RecurringProposals`, `DcaStrip`, `PlannedOccurrenceSheet`).
- **Phone:** `(tabs)/recurring` (`RecurringFormModal`, `RecurringProposals`,
  `WhereItGoes`).
- **Core:** `recurrence`, `apply-recurring`, `recurring-fulfilment`,
  `recurring-detection`, `recurring-rollup`, `recurring-shares`, `dca-need`,
  `instalments`, `subscription-watch`, `business-days`, `rental`.
- **Data:** `recurring-templates`, `templates`, `occurrences`,
  `recurring-apply`, `recurring-proposals`, `recurring-positions`,
  `dca-transfer`, `fulfilment`.
- **Server:** `/api/cron/refresh` (07:00 fills the month's occurrences and
  reprices share-priced ones).
- **Push:** `bigCharge`, `arrived`, `dca`.
- **Read more:** `CONTEXT.md` « Standing instructions »;
  `docs/plans/DCA_TRANSFER_PLAN.md`, `CARDS_CADENCE_PLAN.md`; ADR 0004,
  0019, 0020.

### Placements — Comptes, Analyse, Composition (`investments`)

Savings accounts and investment accounts (PEA, CTO, crypto, assurance-vie,
PER) as tiles, with positions that follow confirmed purchases, broker
operations, returns, fund costs and what the funds are made of.

- **Web:** `/investments` (`InvestmentsView`, `investments/`, `accounts/`,
  `InvestmentPositionSheet`, `PeaCard`), `/investments/analysis`
  (`analysis/AnalysisView`, `analysis/HoldingsCard` « Toutes vos lignes »,
  `FundCostCard`, `AllocationCard`), `/investments/look-through`
  (`LookThroughView`, `look-through/`).
- **Phone:** `(tabs)/investments` (`InvestmentPositionTile`,
  `accounts/AccountChipRow`, `WalletEventsSheet`), `(tabs)/analysis`
  (`HoldingsCard`), `(tabs)/look-through`.
- **Core:** `investments`, `investment-positions`, `holdings-overview`,
  `investment-returns`,
  `investment-events`, `investment-upcoming`, `investment-streak`,
  `savings-accounts`, `allocation`, `fund-costs`, `pea`, `xirr`,
  `look-through`, `look-through-facts`, `wallet-read`, `instrument-reading`,
  `instrument-price-series`, `etf-shortlist`, `account-order`, `market/`.
- **Data:** `positions`, `savings-accounts`, `wallet-plans`,
  `investment-events`, `instrument-readings`, `quote-source`, `preferences`
  (account order).
- **Server:** `/api/wallet-read`, `/api/instrument-reading` (phone, on the
  person's AI account); `/api/cron/read-instruments` (04:00);
  `/api/cron/market` (Mondays).
- **Push:** `dca`, `milestone`.
- **Read more:** `CONTEXT.md` « Investing »; ADR 0014 (« Une cible à
  viser » removed).

### Immobilier — property (`property`)

Homes and premises owned: price, loans (each with its own charge), market
value from DVF sales and the INSEE index, the price history since the
purchase, rental, a share of a joint home.
Behind the `property.track` flag (on by default).

- **Web:** `/property` (`property/PropertyList`), `/property/[id]`
  (`property/PropertyDetail`, `PriceHistoryCard`, `JointDeed`).
- **Phone:** `(tabs)/property/index`, `(tabs)/property/[id]`
  (`components/property/`, with its `PriceHistoryCard`).
- **Core:** `property`, `property-form`, `property-progress`,
  `property-history` (« Évolution du prix »), `property-future`,
  `property-moments`, `loan-schedule`, `rental`, `rent-reference`,
  `price-index`, `address-search`.
- **Data:** `properties`.
- **Server:** `/api/property/addresses` (IGN geocoder),
  `/api/property/market` (DVF reading); `/api/cron/market`.
- **Push:** `property`.
- **Read more:** `CONTEXT.md` « Property »; `docs/plans/REAL_ESTATE_PLAN.md`,
  `PROPERTY_POLISH_PLAN.md`; ADR 0017.

### Plan — the trajectory (`plan`)

Where the accounts lead: « Votre trajectoire » replayed on market history
since 1970, « Vos comptes » (editable growth per account), « Progression »
(milestones, cushion, run).

- **Web:** `/plan` (`plan/PlanView` and its cards).
- **Phone:** `(tabs)/planning` (`components/plan/`: `TrajectoryCard`,
  `PlanAccounts`, `ProgressionCard`, `use-plan-replay`).
- **Core:** `history/` (`replay`, `mix`, `plan-accounts`, `plan-figures`,
  `plan-settings`), `projection`, `future-plan`, `year-ahead`.
- **Data:** `plan-wealth`, `positions`, `savings-accounts`, `properties`.
- **Push:** `milestone`.
- **Read more:** `CONTEXT.md` « Where the months lead »;
  `docs/plans/PLAN_REDESIGN_PLAN.md`; ADR 0013.

### Questions — Ask Pluclair (`ask`)

A chat about one's own money, answered from the app's figures with tools,
on the person's own AI account. Conversations are kept 30 days.

- **Web:** `/ask` (`components/ask/AskView`).
- **Phone:** `ask` (`AskMarkdown`).
- **Core:** `ask`, `ask-chat`, `ask-figures`, `ask-markdown`, `ai-models`.
- **Data:** `ask`, `ai-connection`.
- **Server:** `/api/ask/stream` (phone, streamed), `/api/ask` (older phone
  builds); `/api/cron/sweep` deletes old conversations.
- **Read more:** `docs/how-pluclair-works.md` « Questions »;
  `docs/plans/AI_ACCOUNT_PLAN.md`; ADR 0005, 0007.

### Votre année — the year in review (`year`)

The year before, told in a few cards, with a picture to share.

- **Web:** `/year` (`YearReviewView`).
- **Phone:** `year`.
- **Core:** `year-review`. **Data:** `year-review`.
- **Server:** `/api/year-review/image` (the picture to share).
- **Push:** `year` (January).

### Banque — the bank connection (`bank`)

The open-banking connection, the accounts it reads and their roles
(Courant / Épargne / Commun / Ne pas suivre), and cards on deferred debit.
Open to the owner's account only.

- **Web:** `/bank` (`bank/BankView`, `bank/CardsSection`).
- **Phone:** `bank` (`components/bank/`).
- **Core:** `bank-feed`, `bank-accounts`, `bank-balance`, `bank-consent`,
  `bank-pull`, `bank-merchant`, `bank-mcc`, `bank-attention`,
  `bank-wizard`, `cards`, `merchant-memory`, `filing-rules`.
- **Data:** `bank-feed`, `bank-accounts`, `bank-balance`, `cards`,
  `feed-decisions`, `ledger-duplicates`; web-only tables `bank_connections`,
  `bank_connection_secrets`, `bank_pulls` (`apps/web/lib/bank/`).
- **Server:** `/api/bank/*` (phone: status, consent, credentials, accounts,
  import, refresh, feed, disconnect); `/api/cron/refresh` (07:00, 12:00,
  17:00, 21:00 reads the stored statement, never asks the bank).
- **Push:** `bank`, `review`, `spending`, `arrived` (« Salaire arrivé »).
- **Read more:** `docs/how-pluclair-works.md` « Bank feed »;
  `docs/operations.md` « Asking the bank »; `docs/plans/BANK_CONNECT_PLAN.md`,
  `MULTI_ACCOUNT_PLAN.md`; ADR 0009, 0018.

### Importer — statements you bring (`import`)

Bank lines brought by hand: a file (CSV, XLSX, ODS, OFX, QIF, CAMT, MT940,
CFONB, PDF), a pasted table, a scan read by AI, a file shared to Pluclair, a
forwarded bank e-mail, or the Android bank notifications. They go through the
same feed and inbox as the bank's lines. An import can be undone for 30 days.

- **Web:** `/import` (`statements/StatementImport`, `MappingCard`,
  `BankGuide`); a file dropped anywhere in the app (`StatementDropTarget`).
- **Phone:** `import` (`components/statements/`); `bank-notifications`
  (Android listener, flag `listener.android`, off).
- **Core:** `statement/` (readers, line ids, balance check, e-mail alerts,
  notifications), `statement-file`, `statement-reminder`, `csv-import`.
- **Data:** `statements`.
- **Server:** `/api/statements` (phone), `/api/statements/inbound` (the
  inbound-mail webhook for `…@releves.pluclair.com`).
- **Push:** `statement` (on the 5th, never with a bank feed).
- **Read more:** `docs/plans/STATEMENTS_PLAN.md`; ADR 0010.

### Catégories and Règles — filing (`categories`, `rules`)

The person's categories, and the rules that file a bank line by itself.

- **Web:** `/categories` (`CategoriesView`), `/rules` (`rules/RulesView`).
- **Phone:** `categories`, `rules`.
- **Core:** `categories` (`categoriesFor`), `category-styles`,
  `seed-categories`, `filing-rules`, `merchant-memory`.
- **Data:** `categories`, `filing-rules`.

### Profil — settings (`profile`)

Language, currency, design (« Apparence »), notifications per kind, privacy
blur, passkeys and biometric lock, the AI account, the shared space and its
split, feedback, account deletion.

- **Web:** `/profile` (`components/profile/`: `ProfileView`,
  `PasskeysPanel`, `AiAccountSection`, design picker).
- **Phone:** `(tabs)/profile` (`components/profile/`: `DesignPicker`,
  `SecurityCards.tsx` (passkeys), `SpaceSection`, `AiAccountSection`).
- **Core:** `notification-kinds`, `designs`, `design-palettes`, `flags`,
  `ai-brands`, `ai-models`.
- **Data:** `preferences`, `ai-connection`, `account`, `spaces`,
  `space-balance`.
- **Server:** `/api/ai/openrouter/start` and `/api/ai/openrouter/callback`
  (connecting an AI account), `/api/ai/connection` (its credit).
- **Read more:** ADR 0005, 0008, 0016.

### Shared space — a couple's money (`space`)

Two people share a space beside their own money: the joint account, joint
charges, a joint home, each partner's share.

- **Web:** `/join/[token]` (accepting an invitation); the owner switch;
  Profil's space section (`components/space/`).
- **Phone:** `join/[token]`; `OwnerProvider`; Profil's `SpaceSection`.
- **Core:** `my-share`, `space-balance`, `share-count`.
- **Data:** `spaces`, `space-balance`.
- **Read more:** `docs/plans/SHARED_SPACE_DESIGN.md`; `CONTEXT.md`
  « Shared space »; ADR 0008.

### Bienvenue — first steps (`welcome`)

The first run, step by step: currency, income, standing charges, the bank
(only where it can be offered), the AI account (behind `ai.account`).

- **Web:** `/welcome` (`components/onboarding/WelcomeFlow`).
- **Phone:** `onboarding` (`components/onboarding/`).
- **Core:** `setup-steps`, `seed-categories`.

### Add and edit sheets

One sheet to add a transaction or a standing instruction, and one frame for
every edit sheet.

- **Web:** `QuickAddSheet`, `components/finance/add/`,
  `components/finance/sheet/entry-sheet.tsx`, `TransactionForm`.
- **Phone:** `components/add/`, `components/sheet/EntrySheet.tsx`,
  `TransactionFormModal`; the `add` deep link.
- **Core:** `entry-draft`, `amount-input`, `calculator`, `receipts`.
- **Data:** `ledger`, `recurring-templates`, `splits`.
- **Read more:** `apps/*/DESIGN.md` « Add Sheet ».

### Nouveautés — what's new (`nouveautes`)

Every shipped change in plain words, with reactions, and what is coming
(« Bientôt ») with votes. A dot marks what a person hasn't seen yet.

- **Web:** `/nouveautes`, `/nouveautes/[id]`; feeds `/nouveautes/rss.xml`,
  `/nouveautes/feed.json` (read by the phone and its update banner).
- **Phone:** `nouveautes`; the « Quoi de neuf » sheet after an update.
- **Core:** `changelog-entries` (the entries), `changelog`, `reactions`.
- **Data:** `reactions`, `preferences` (`changelog_seen`).
- **Read more:** `docs/plans/BLOG_CHANGELOG_PLAN.md`; ADR 0015.

### Le blog and Entraide — guides and community (`blog`)

The owner's guides (MDX), and Entraide: members ask and answer, under
pseudonyms, moderated after posting.

- **Web:** `/blog`, `/blog/[slug]` (`content/guides/`, `lib/guide-list.ts`),
  `/blog/rss.xml`; `/blog/entraide`, `/blog/entraide/[thread]`,
  `/blog/entraide/regles`, `/blog/entraide/moderation` (moderators only).
- **Phone:** `entraide/index`, `entraide/new`, `entraide/[thread]`.
- **Core:** `entraide`, `entraide-copy`, `entraide-mask`, `reactions`.
- **Data:** `entraide`, `entraide-moderation`, `reactions`.
- **Server:** `/api/entraide` (phone writes, sharing
  `apps/web/lib/entraide-write.ts`); `/api/cron/sweep` (`sweep_entraide`).
- **Push:** `community`.
- **Flag:** `community.moderate` (the moderation queue).
- **Read more:** `docs/legal/ENTRAIDE.md`; ADR 0022.

### Sign in and accounts (`auth`)

E-mail and password, Google, passkeys; password reset; e-mails sent through
Resend with the templates in `supabase/templates/`.

- **Web:** `/login`, `/signup`, `/reset`, `/reset/new`, `/auth/confirm`,
  `/auth/callback`; `/.well-known/apple-app-site-association`,
  `/.well-known/assetlinks.json` (passkeys on the apps).
- **Phone:** `(auth)/login`, `(auth)/signup`, `(auth)/reset`,
  `auth/callback`.
- **Core:** `auth-errors`. **Data:** `account` (delete-all).
- **Read more:** `docs/operations.md` « Supabase dashboard ».

### Demo

A read-only shared account, rebuilt every night, that anyone can open from
the site.

- **Web:** `/demo` (signs in as the demo account and opens Le point),
  `DemoBanner`; `/api/cron/demo` (03:30).
- **Core:** `demo-sample`. **Data:** `demo`.
- **Database:** `refuse_demo_write` trigger on every table (migration 081).
- **Read more:** `docs/how-pluclair-works.md` « The demo »; ADR 0021.

### The site (`marketing`)

- **Pages:** `/` (landing), `/fonctionnalites/[slug]` (one per feature,
  French slugs in `components/marketing/feature-slugs.ts`; old `/features/…`
  redirect), `/a-propos`, `/telecharger`, `/privacy`, `/terms`,
  `/mentions-legales`.
- **Links that don't move:** `/android` (the latest APK), `/ios` (TestFlight,
  then the App Store; a 404 until one is set). Until then iPhone visitors get
  the home-screen section of `/telecharger`.
- **For machines:** `/llms.txt`, sitemap and robots, JSON-LD
  (`lib/seo/structured-data.ts`).
- **Code:** `components/marketing/` with copy beside it in
  `*-copy.ts` / `*-copy.fr.ts`; legal text in `legal-copy*.ts`.
- **Read more:** `apps/web/PRODUCT.md`; ADR 0011, 0024.

### Notifications

Sent by the web server only, to browsers (Web Push) and phones (Expo push),
by `apps/web/lib/push/deliver.ts`. Each kind can be turned off in Profil.
Quiet hours are 21:00–08:00 (Paris). `notification_log` keeps each one sent
once across devices.

| Kind        | Sent by                                                                | Opens                    |
| ----------- | ---------------------------------------------------------------------- | ------------------------ |
| `recap`     | `/api/cron/notify` (Mondays)                                           | Le point                 |
| `overdraft` | `/api/cron/notify`                                                     | Le point                 |
| `close`     | `/api/cron/notify` (reading day); a bank that closed the month         | Le point                 |
| `bigCharge` | `/api/cron/notify` (the day before)                                    | Le point                 |
| `arrived`   | `/api/cron/notify` (`push-digest`)                                     | Le point                 |
| `monthOpen` | `/api/cron/notify` (`push-digest`)                                     | Le point                 |
| `dca`       | `/api/cron/notify` (before the 1st); `/api/cron/refresh` (pay arrived) | Le point                 |
| `spending`  | `/api/cron/refresh`, after the sync                                    | Journal                  |
| `review`    | `/api/cron/refresh`, after the sync                                    | Journal, inbox           |
| `bank`      | `/api/cron/notify`, `/api/cron/refresh`                                | Banque                   |
| `milestone` | `/api/cron/notify`                                                     | Plan                     |
| `year`      | `/api/cron/notify` (January)                                           | Votre année              |
| `property`  | `/api/cron/notify`, `/api/cron/market`                                 | The property             |
| `statement` | `/api/cron/notify` (the 5th)                                           | Importer                 |
| `community` | Entraide writes (`apps/web/lib/entraide-push.ts`)                      | The thread, or the queue |

What is worth saying, and where it opens, is built in
`@finance/core/push-messages` and `push-digest`. `push-routes` turns a web
address into the phone's screen. The phone also schedules its own reminders
on the device (`ReminderProvider`).

### Feature switches

`@finance/core/flags`, stored by migration 039 (one row per flag, plus
`user_feature_flags` per person), read only through
`evaluated_feature_flags()` (web `lib/flags.ts`, phone `useFlag`).

| Flag                 | Gates                                 | Default                                  |
| -------------------- | ------------------------------------- | ---------------------------------------- |
| `ai.account`         | Connecting an AI account              | On                                       |
| `bank.connect`       | Offering the bank connection          | Owner only, whatever the flag (ADR 0009) |
| `community.moderate` | Entraide's moderation queue           | Moderators only                          |
| `property.track`     | Immobilier                            | On                                       |
| `listener.android`   | Reading bank notifications on Android | Off (never run on a device)              |

## Route index

Every page, route handler and phone screen, as the code has them. Route
groups such as `(app)` are left out of web paths. Phone paths are file paths
under `apps/mobile/src/app/`. Checked by `pnpm check:docs`.

### Web pages

<!-- docs-check:web-pages -->

- `/` — landing
- `/a-propos` — about the maker
- `/ask` — Questions
- `/bank` — Banque
- `/bearing` — Le point
- `/blog` — Le blog
- `/blog/[slug]` — a guide
- `/blog/entraide` — Entraide
- `/blog/entraide/[thread]` — a question and its answers
- `/blog/entraide/moderation` — moderation queue
- `/blog/entraide/regles` — Entraide's rules
- `/calendar` — Journal, Calendrier
- `/categories` — Catégories
- `/fonctionnalites/[slug]` — a feature page
- `/history` — Journal, Par catégorie
- `/import` — Importer
- `/investments` — Placements, Comptes
- `/investments/analysis` — Placements, Analyse
- `/investments/look-through` — Placements, Composition
- `/join/[token]` — joining a shared space
- `/login` — sign in
- `/mentions-legales` — legal notice
- `/nouveautes` — Nouveautés
- `/nouveautes/[id]` — one entry
- `/plan` — Plan
- `/privacy` — privacy policy
- `/profile` — Profil
- `/property` — Immobilier
- `/property/[id]` — one property
- `/recurring` — Récurrents
- `/reset` — password reset
- `/reset/new` — new password
- `/rules` — Règles
- `/signup` — sign up
- `/telecharger` — download the apps
- `/terms` — terms of use
- `/transactions` — Journal, Liste
- `/welcome` — Bienvenue
- `/year` — Votre année

<!-- /docs-check -->

### Web route handlers

<!-- docs-check:web-routes -->

- `/.well-known/apple-app-site-association` — iOS passkeys and links
- `/.well-known/assetlinks.json` — Android passkeys and links
- `/android` — redirect to the latest APK
- `/api/ai/connection` — AI account credit
- `/api/ai/openrouter/callback` — AI account connection, return
- `/api/ai/openrouter/start` — AI account connection, start
- `/api/ask` — Ask, one answer (older phones)
- `/api/ask/stream` — Ask, streamed
- `/api/bank/accounts` — phone: find accounts
- `/api/bank/consent` — phone: give consent
- `/api/bank/credentials` — phone: credentials file
- `/api/bank/disconnect` — phone: disconnect
- `/api/bank/feed` — phone: file inbox groups
- `/api/bank/import` — phone: first import
- `/api/bank/import/finish` — phone: first import done
- `/api/bank/refresh` — ask the bank (attended)
- `/api/bank/status` — phone: what the server knows of the bank
- `/api/category-read` — write a category read
- `/api/category-rerank` — order a category's findings
- `/api/cron/demo` — rebuild the demo account
- `/api/cron/market` — housing index and market readings
- `/api/cron/notify` — the day's notifications
- `/api/cron/read-instruments` — read aging instruments
- `/api/cron/refresh` — fill, reprice, read the bank
- `/api/cron/sweep` — delete for good, expire old rows
- `/api/entraide` — phone: Entraide writes
- `/api/instrument-reading` — phone: read one instrument
- `/api/month-read` — phone: write a month read
- `/api/month-share/image` — « Partager ce mois » picture; the feature is gone, kept while 1.5.0 phones still ask for it
- `/api/property/addresses` — phone: address search
- `/api/property/market` — phone: market reading
- `/api/receipts` — read a receipt
- `/api/statements` — phone: statement preview, import, undo
- `/api/statements/inbound` — inbound bank e-mail webhook
- `/api/wallet-read` — phone: wallet read
- `/api/year-review/image` — « Votre année » picture to share
- `/auth/callback` — OAuth return
- `/auth/confirm` — e-mail confirmation and reset links
- `/blog/rss.xml` — guides feed
- `/demo` — open the demo
- `/ios` — iPhone link
- `/llms.txt` — the site for AI assistants
- `/nouveautes/feed.json` — Nouveautés for the phone
- `/nouveautes/rss.xml` — Nouveautés feed

<!-- /docs-check -->

### Phone screens

<!-- docs-check:phone-screens -->

- `(auth)/login` — sign in
- `(auth)/reset` — password reset
- `(auth)/signup` — sign up
- `(tabs)/analysis` — Placements, Analyse
- `(tabs)/calendar` — Journal (the bar's tab)
- `(tabs)/history` — Journal, Par catégorie
- `(tabs)/index` — Le point
- `(tabs)/investments` — Placements, Comptes
- `(tabs)/look-through` — Placements, Composition
- `(tabs)/planning` — Plan
- `(tabs)/profile` — Profil
- `(tabs)/property/[id]` — one property
- `(tabs)/property/index` — Immobilier
- `(tabs)/recurring` — Récurrents
- `(tabs)/transactions` — Journal, Liste
- `add` — deep link to the add sheet
- `ask` — Questions
- `auth/callback` — OAuth return
- `bank` — Banque
- `bank-notifications` — Android bank notifications
- `categories` — Catégories
- `entraide/[thread]` — a question
- `entraide/index` — Entraide
- `entraide/new` — ask a question
- `import` — Importer
- `join/[token]` — joining a shared space
- `nouveautes` — Nouveautés
- `onboarding` — Bienvenue
- `rules` — Règles
- `year` — Votre année

<!-- /docs-check -->

## Data modules

What each `@finance/data` module reads and writes (`name()` is a database
function), and how many files in each app import it. Counts are as of
2026-11-16 and are not checked; regenerate them when the shape changes.

| Module                 | Tables and functions                                                                                                                                                                                           | Imported by                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `account`              | `deletion_undo`, `restore_deletion()`, `transactions`, `transaction_tags`                                                                                                                                      | web (1), phone (1), data (1)   |
| `activity`             | `record_activity()`                                                                                                                                                                                            | web (3), phone (1)             |
| `ai-connection`        | `ai_connections`                                                                                                                                                                                               | web (2), phone (2)             |
| `ask`                  | `ask_conversations`, `ask_messages`, `ask_tallies`, `categories`, `refund_ask()`, `reserve_ask()`, `transactions`                                                                                              | web (7), phone (1)             |
| `balance-reading`      | `balance_readings`                                                                                                                                                                                             | web (1), phone (1), data (1)   |
| `bank-accounts`        | `bank_accounts`, `savings_accounts`, `space_members`                                                                                                                                                           | web (1), phone (1)             |
| `bank-balance`         | `bank_accounts`, `bank_feed_items`                                                                                                                                                                             | web (1), phone (1), data (2)   |
| `bank-feed`            | `bank_feed_items`, `categories`                                                                                                                                                                                | web (3), phone (1), data (8)   |
| `bank-inbox`           | `bank_feed_items`, `recurring_proposal_dismissals`, `recurring_templates`, `transactions`                                                                                                                      | web (1), phone (2), data (3)   |
| `bearing-month`        | — (assembles Le point's month from other modules)                                                                                                                                                              | web (3), phone (1)             |
| `cards`                | `bank_accounts`, `bank_feed_items`, `cards`, `transactions`                                                                                                                                                    | web (7), phone (3)             |
| `categories`           | `categories`                                                                                                                                                                                                   | web (5), phone (3), data (2)   |
| `category-screen`      | `category_reads`, `category_read_tallies`, `category_selections`, `transactions`                                                                                                                               | web (3), phone (1)             |
| `client`               | — (the `Db` type)                                                                                                                                                                                              | web (11), data (54)            |
| `closing`              | `month_closes`, `month_close_settings`                                                                                                                                                                         | web (1), phone (1)             |
| `dca-transfer`         | `categories`, `recurring_fulfilments`, `recurring_skips`, `recurring_templates`, `transactions`                                                                                                                | web (3), phone (1), data (4)   |
| `deletions`            | `deletion_undo`, `recurring_skips`, `restore_deletion()`, `soft_delete_category()`, `soft_delete_transactions()`, `transactions`                                                                               | web (2), phone (1), data (2)   |
| `demo`                 | `categories`, `filing_rules`, `investment_events`, `investment_positions`, `month_closes`, `recurring_templates`, `savings_accounts`, `transactions`, `user_preferences`, `wallet_plans`                       | web (1)                        |
| `entraide`             | `entraide_decisions`, `entraide_list()`, `entraide_posts`, `entraide_profiles`, `entraide_replies`, `entraide_replies()`, `entraide_reports`, `entraide_search()`, `entraide_thread()`                         | web (6), phone (1)             |
| `entraide-moderation`  | `entraide_decisions`, `entraide_posts`, `entraide_profiles`, `entraide_replies`, `entraide_reports`                                                                                                            | web (4)                        |
| `errors`               | — (`dbError`)                                                                                                                                                                                                  | web (4), phone (3), data (25)  |
| `feed-decisions`       | `bank_feed_items`, `transactions`                                                                                                                                                                              | web (2), phone (1)             |
| `filing-rules`         | `bump_filing_rule()`, `filing_rules`                                                                                                                                                                           | web (5), phone (2)             |
| `fulfilment`           | `bank_feed_items`, `recurring_fulfilment_refusals`, `recurring_fulfilments`, `recurring_templates`, `transactions`                                                                                             | web (3), phone (2), data (4)   |
| `fulfilment-decisions` | `recurring_fulfilment_refusals`, `recurring_fulfilments`, `recurring_templates`, `transactions`                                                                                                                | web (1), phone (1)             |
| `history`              | `transactions`                                                                                                                                                                                                 | web (2), phone (1), data (1)   |
| `instrument-readings`  | `instrument_readings`                                                                                                                                                                                          | web (2), phone (1)             |
| `investment-events`    | `investment_events`                                                                                                                                                                                            | web (2), phone (2)             |
| `ledger`               | `categories`, `transactions`                                                                                                                                                                                   | web (2), phone (1)             |
| `ledger-duplicates`    | `bank_feed_items`, `transactions`                                                                                                                                                                              | data (1)                       |
| `ledger-search`        | `categories`, `transactions`                                                                                                                                                                                   | web (1), phone (1)             |
| `left-to-spend`        | `transactions`                                                                                                                                                                                                 | phone (1), data (1)            |
| `month-balance`        | `transactions`                                                                                                                                                                                                 | web (1), phone (1), data (2)   |
| `month-close`          | `month_closes`, `month_close_settings`, `transactions`, `wallet_transfers`                                                                                                                                     | web (3), phone (1), data (5)   |
| `month-ledger`         | `transactions`                                                                                                                                                                                                 | web (2), phone (1), data (1)   |
| `moved-rows`           | `transactions`                                                                                                                                                                                                 | data (2)                       |
| `occurrences`          | `recurring_skips`, `recurring_templates`, `transactions`                                                                                                                                                       | web (1), phone (1)             |
| `plan-wealth`          | — (assembles the Plan's accounts)                                                                                                                                                                              | web (1)                        |
| `positions`            | `investment_positions`, `wallet_plans`                                                                                                                                                                         | web (2), phone (1), data (1)   |
| `preferences`          | `user_preferences`                                                                                                                                                                                             | web (22), phone (8), data (3)  |
| `properties`           | `categories`, `housing_price_index`, `properties`, `property_loans`, `property_market_readings`, `property_rent_references`, `property_shares`, `recurring_templates`, `set_property_share()`, `space_members` | web (16), phone (5)            |
| `purchases-to-confirm` | `recurring_skips`, `transactions`                                                                                                                                                                              | web (1), data (1)              |
| `quote-source`         | — (market quotes)                                                                                                                                                                                              | web (1), data (2)              |
| `reactions`            | `reaction_counts()`, `reactions`                                                                                                                                                                               | web (4), phone (1)             |
| `recurring-apply`      | `recurring_fulfilments`, `recurring_skips`, `recurring_templates`, `reprice_occurrences()`, `transactions`                                                                                                     | web (2), data (3)              |
| `recurring-positions`  | `investment_positions`, `recurring_templates`                                                                                                                                                                  | data (2)                       |
| `recurring-proposals`  | `recurring_proposal_dismissals`, `recurring_templates`                                                                                                                                                         | web (1), phone (1)             |
| `recurring-templates`  | `categories`, `recurring_templates`                                                                                                                                                                            | web (1), phone (1), data (1)   |
| `savings-accounts`     | `bank_accounts`, `categories`, `investment_positions`, `savings_accounts`, `transactions`, `wallet_plans`                                                                                                      | web (3), phone (1), data (2)   |
| `schema`               | — (`isMissingSchema`)                                                                                                                                                                                          | web (10), phone (3), data (21) |
| `space-balance`        | `space_contributions()`                                                                                                                                                                                        | web (2), phone (1)             |
| `spaces`               | `create_space()`, `create_space_invite()`, `join_space()`, `leave_space()`, `peek_space_invite()`, `rename_space()`, `set_space_share()`, `space_members`, `space_people()`, `transactions`                    | web (5), phone (5), data (2)   |
| `splits`               | `transactions`                                                                                                                                                                                                 | web (2), phone (1), data (1)   |
| `statements`           | `bank_accounts`, `bank_feed_items`, `statement_imports`, `statement_inboxes`, `statement_mail_items`                                                                                                           | web (7), phone (5), data (1)   |
| `templates`            | `recurring_skips`, `recurring_templates`                                                                                                                                                                       | web (2), phone (1), data (5)   |
| `wallet-plans`         | `savings_accounts`, `wallet_plans`                                                                                                                                                                             | web (1), phone (1)             |
| `weekly-recap`         | `bank_feed_items`, `transactions`                                                                                                                                                                              | web (3), phone (2)             |
| `year-review`          | `transactions`                                                                                                                                                                                                 | web (3), phone (1)             |

Tables only the web server touches, because they hold secrets, counters or
delivery state:

| Table                                                                                                                                  | Where                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ai_connections`' secrets: `ai_connection_secrets`, `ai_connect_flows`                                                                 | `apps/web/lib/ai/`                                                                  |
| `bank_connections`, `bank_connection_secrets`, `bank_pulls`                                                                            | `apps/web/lib/bank/` (the phone reads `bank_connections` too)                       |
| `month_reads`, `wallet_reads`, `category_reads`, `instrument_reading_tallies` and their `reserve_*` / `store_*` / `refund_*` functions | `apps/web/lib/month-read/`, `wallet-read/`, `category-read/`, `instrument-reading/` |
| `push_subscriptions`, `expo_push_tokens`, `notification_log`                                                                           | `apps/web/lib/push/` (the phone registers its Expo token)                           |
| `entraide_authorship`                                                                                                                  | `apps/web/lib/entraide-authorship.ts`                                               |
| `sweep_*` functions                                                                                                                    | `apps/web/app/api/cron/sweep/route.ts`                                              |

## Migrations

What each migration brought. Checked by `pnpm check:docs`: a new file needs
its row. Run order and the local and hosted procedures are in
`supabase/AGENTS.md`.

<!-- docs-check:migrations -->

| Migration                          | What it brought                                                          |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `001_initial`                      | The first schema: categories, transactions, recurring templates, RLS     |
| `002_investment_granularity`       | Weekly recurrence; investment categories                                 |
| `003_yearly_recurrence`            | Yearly recurrence for annual bills                                       |
| `004_recurring_description`        | A note on a standing instruction                                         |
| `005_recurring_shares`             | Share-priced DCAs with live quotes                                       |
| `006_investment_wallets`           | A wallet's starting capital and market value                             |
| `007_investment_positions`         | Positions per category (replacing wallet buckets)                        |
| `008_investment_positions_v2`      | Several positions per wallet (PEA, CTO, crypto)                          |
| `009_fractional_position_shares`   | Fractional share counts                                                  |
| `010_cleanup_and_rls_hardening`    | The old wallet model dropped; RLS on foreign keys                        |
| `011_category_archiving`           | Archived categories                                                      |
| `012_budgets_transfers_tags_goals` | Budgets, wallet transfers, tags, goals (budgets and goals later retired) |
| `013_recurring_skips`              | Skipping one occurrence                                                  |
| `014_recurring_schedule`           | A start and end date for a standing instruction                          |
| `015_wallet_plans`                 | What the person intends for each wallet                                  |
| `016_position_ongoing_charge`      | A fund's ongoing charge                                                  |
| `017_push_subscriptions`           | Web push subscriptions and the log of what was sent                      |
| `018_month_closes`                 | The month close: one balance a month                                     |
| `019_bank_feed`                    | Bank lines waiting to be filed                                           |
| `020_proposal_dismissals`          | Suggested standing instructions turned down                              |
| `021_bank_balances`                | Balances after each bank movement; which accounts count                  |
| `022_bank_pulls`                   | When the bank itself was last asked                                      |
| `023_recurring_fulfilments`        | A bank line confirmed as a standing instruction's occurrence             |
| `024_month_reads`                  | The month read and its allowance                                         |
| `025_definer_callers`              | Who may call the definer functions (the service role, named)             |
| `026_expo_push_tokens`             | Phone push tokens                                                        |
| `027_user_preferences`             | The person's language, stored                                            |
| `028_month_read_locale`            | A read's language                                                        |
| `029_bearing`                      | Le point's arrangement (no longer read)                                  |
| `030_investment_wallet_values`     | Assurance-vie and PER wallets                                            |
| `031_envelope_fee`                 | An envelope's own yearly fee                                             |
| `032_instrument_readings`          | What each instrument is made of                                          |
| `033_wallet_reads`                 | The wallet read                                                          |
| `034_position_value_pinned`        | A typed value that overrides the market                                  |
| `035_category_findings`            | Category reads and their order                                           |
| `036_soft_delete`                  | Deletes that can be taken back                                           |
| `037_instrument_asset_kind`        | What an instrument holds                                                 |
| `038_goal_start`                   | Goals as a running total (goals later retired)                           |
| `039_feature_flags`                | Feature switches                                                         |
| `040_merge_tags`                   | Merging tags                                                             |
| `041_bank_connections`             | Bank connections per person                                              |
| `042_bank_credentials_file`        | Connections by credentials file                                          |
| `043_french_by_default`            | French as the default language                                           |
| `044_bank_consent`                 | The bank consent's version and date                                      |
| `045_cash_date`                    | The day money moved, when it differs from the day it counts              |
| `046_savings_accounts`             | Savings accounts                                                         |
| `047_savings_targets`              | A target share per savings account                                       |
| `048_notification_preferences`     | Notification switches per kind; the last milestone seen                  |
| `049_properties`                   | Properties and their loans                                               |
| `050_property_market`              | Market readings for a property                                           |
| `051_property_rental`              | Rental and energy class                                                  |
| `052_loan_insurance_separate`      | Loan insurance as its own charge                                         |
| `053_ai_connections`               | The person's own AI account (OpenRouter)                                 |
| `054_transfer_follows_purchases`   | The broker transfer follows the DCAs                                     |
| `055_dca_funded_by_transfer`       | A tick per DCA funded by the transfer                                    |
| `056_bank_account_roles`           | A role per bank account                                                  |
| `057_balance_readings`             | Where Le point's balance was read from                                   |
| `058_audience_measurement`         | First-party audience count                                               |
| `059_milestone_history`            | When each milestone was reached                                          |
| `060_shared_space`                 | Shared spaces: a space is an owner                                       |
| `061_joint_account`                | The joint bank account in a space                                        |
| `062_space_share`                  | Each partner's share of joint spending                                   |
| `063_property_together`            | A property owned by a space, and deed shares                             |
| `064_ask`                          | Ask Pluclair's conversations and allowance                               |
| `065_ai_account_for_everyone`      | `ai.account` on for everyone                                             |
| `066_tax_boxes`                    | Tax-return boxes (removed by 068)                                        |
| `067_batched_updates`              | Batched repricing and feed balances                                      |
| `068_no_tax_boxes`                 | Tax-return boxes dropped                                                 |
| `069_changelog_seen`               | The last « Nouveautés » entry seen                                       |
| `070_reactions`                    | Reactions and « J'attends ça » votes                                     |
| `071_entraide`                     | Entraide's profiles, questions and answers                               |
| `072_entraide_moderation`          | Reports and moderation decisions                                         |
| `073_entraide_authorship`          | Who wrote what, kept one year (hosting law)                              |
| `074_statements`                   | Statement imports as feed lines                                          |
| `075_statement_inbox`              | A personal address for forwarded bank e-mails                            |
| `076_account_order`                | The order of Placements' accounts                                        |
| `077_filing_rules`                 | Filing rules                                                             |
| `078_space_contributions`          | What each partner put into the space                                     |
| `079_splits_receipts`              | Split transactions and receipts                                          |
| `080_investment_events`            | Broker operations: dividends, sales, fees                                |
| `081_demo_account`                 | The demo account and the `refuse_demo_write` trigger                     |
| `082_listener_flag`                | The `listener.android` flag                                              |
| `083_position_balance_as_of`       | When a position's typed figures were true                                |
| `084_recurring_months`             | Standing instructions in some months only                                |
| `085_feed_purchased_on`            | A card line's purchase day                                               |
| `086_recurring_amount_varies`      | « Le montant varie »                                                     |
| `087_cards`                        | Cards and deferred debit                                                 |
| `088_design`                       | The chosen design                                                        |
| `089_demo_cards`                   | The demo guard on `cards`                                                |

<!-- /docs-check -->
