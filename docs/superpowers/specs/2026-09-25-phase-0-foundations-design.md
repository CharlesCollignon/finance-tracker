# Phase 0 — Foundations and trust fixes: design

**Parent plan:** `docs/plans/PLUCLAIR_UPGRADE_PLAN.md`, Phase 0 (section 6), using the
shared specifications in section 4.
**Status:** phase plan approved on 2026-09-25 with every default below accepted.
**Branch:** `phase-0-foundations`.

Phase 0 of ten. It fixes four defects that break trust, and lays the
infrastructure every later phase stands on: feature flags, an analytics layer,
a single gateway for AI calls, a dated reference-data registry and a persona
test harness. It ships no advice and no recommendation. Phase 1 (bank
connection for every user) follows.

---

## 1. Decisions

| # | Question | Decision |
|---|---|---|
| D0.1 | Does the upgrade plan supersede the roadmap given earlier in September 2026? | **Yes**, wherever the two conflict: tiers 0–5 instead of levels L0–L3, goals-first priority, EUR default with USD supported, three proposed promises, no payload contents in operational AI logs, WCAG 2.2 AA. Reference keys carry a jurisdiction prefix (`fr.*`) so France-first never hard-codes France as the only case. |
| D0.2 | Where does a savings goal's running total start? | A new `starts_on` date, backfilled to the goal's creation date and editable by the user. The total runs across every month from `starts_on` to today. |
| D0.3 | Do the four bug fixes ship behind flags? | **No.** The fixes restore intended behaviour; flagging them off for existing users would keep those users on the bugs. New features (tag management, provenance lines) are flagged. |
| D0.4 | Where does tag management live? | On the Plan page's Tags card, where tags are created today on both clients. It moves with the rest of tags in Phase 3. |
| D0.5 | The month read sends the current-account balance to Mistral. | Keep it (Phase 0 changes no AI behaviour). Correct the comment that says balances are never sent. Revisit in Phase 4 with the narration contract. |
| D0.6 | Analytics without a chosen vendor. | Build the event catalogue, the consent setting and `track()`, with a sink that sends nothing until the vendor is chosen (plan open question 8). |
| D0.7 | Lint to zero in this phase? | **Yes**, web and mobile, then gate CI on it. A finding that is a deliberate choice may be suppressed inline with a one-line reason; nothing is suppressed wholesale. |

## 2. Corrections to the parent plan

Where the code contradicts the plan, the code wins. None of these change the
plan's intent; they change its size or its assumptions.

1. **The app guide does not exist.** "How Pluclair works" appears nowhere in the
   repository. Phase 0 creates it as `docs/how-pluclair-works.md` and every
   phase updates it.
2. **AI today is five features on three call sites.** Month read, category
   read, finding ordering (category selection), instrument reading (two calls:
   web search, then transcription) and wallet read. All three raw `fetch` call
   sites are in `apps/web/lib` (`month-read/client.ts:122`,
   `wallet-read/client.ts:91`, `instrument-reading/client.ts:191`). Mobile never
   calls Mistral; it reaches the month read through `POST /api/month-read`.
   Every feature uses one model (`MISTRAL_MODEL`, else `mistral-medium-latest`).
   There is no AI categorisation and no OCR.
3. **The month read sends the account balance.** `month-facts.ts:333` includes
   the current-account total as the `on-hand` fact, while
   `apps/web/.env.local.example:54` says balances are never sent (D0.5).
4. **Only two statutory parameters are hard-coded:** the PEA ceiling (€150,000,
   `pea.ts:16`) and the PEA five-year rule (`pea.ts:19`, and the word "five" in
   English and French copy). Other hard-coded fee and market data: ten dated
   ongoing-charge hints in `etf-shortlist.ts`, the world-equity region weights in
   `look-through.ts:57-63`, and a "typically 0.5 to 0.8" assurance-vie fee in
   copy. Livret A, LDDS, LEP, PFU, social charges, tax brackets, CPI, FX and
   return assumptions exist nowhere in code; those registry keys are seeded by
   the phase that first needs them.
5. **Mobile has no password reset at all**, and an https email link cannot open
   the app (no universal links or intent filters). "Same flow on mobile" becomes:
   mobile asks for the email, and the link opens the web page that sets the new
   password.
6. **Gates.** Lint fails today (web: 9 errors, 2 warnings; mobile: 11 errors,
   31 warnings) and is not in CI. `still-to-come.test.ts` passes since
   2026-09-20 but CI still excludes it. Mobile has no test runner; web has one
   test file.
7. **Nothing exists for flags, analytics or consent.** Built from zero.
8. **`packages/core/test/personas/`** is outside core's tsconfig `include`
   (`src/**/*.ts`); the include is widened.

## 3. Scope and parity

| Task | Web | Mobile |
|---|---|---|
| T1 Calendar keeps tags | fixed | calendar gains tag editing (it never deleted them) |
| T2 Goals running total | yes | yes |
| T3 Income charges editable | yes | yes |
| T4 Password reset | request, and set the new password | request; the new password is set on the web page the email opens |
| T5 Feature flags | read on the server | read at session start, last value cached |
| T6 Tag rename, delete, merge | yes (flagged) | yes (flagged) |
| T7 Reference registry | yes | yes, cached for offline |
| T8 AiProvider | server only | unchanged (already goes through the web API) |
| T9 Analytics layer | yes | yes |
| T10 Personas | n/a (core tests) | n/a |

**Not in Phase 0:** per-feature AI consent toggles (4.8), the narration
validator (4.3), the insight and recommendation contracts (4.1, 4.2), any
analytics vendor, any admin screen for flags or reference values, removal of
the dead `bearing_pins` column and `bearing_arrangements` table.

## 4. Constraints that apply to every task

- Domain logic in `packages/core` as pure, tested functions; UI stays thin.
- Every user-facing string in `packages/core/src/i18n/messages/en.ts` and
  `fr.ts`, including inherited hard-coded English on any screen touched. French
  typography: no-break space (` `) before `? ! : ;`.
- `apps/web/DESIGN.md` tokens and rules: dark only, the four homes of the gold
  accent, the Semantic Amount Rule, the privacy blur on every rendered amount.
- WCAG 2.2 AA: contrast, visible focus, 44 px targets (56 px list rows),
  labelled figures, reduced motion honoured.
- `CONTEXT.md` vocabulary: *recurring template*, *savings goal*, *tag*.
- Migrations additive and reversible, RLS on every new table, each proven
  with `supabase db reset` against a local stack and an assertion script in
  `supabase/tests/`.
- Before writing any Next.js route, page or server action, read the relevant
  guide in `node_modules/next/dist/docs/` (this Next.js has breaking changes).
- One concern per commit; core typecheck, web and mobile typecheck, lint and
  tests green before a task is called done.

## 5. Tasks

Ordered. T0, T1, T3 and T4 need no migration.

### T0 — Housekeeping

- Commit `docs/plans/PLUCLAIR_UPGRADE_PLAN.md` (moved from
  `docs/superpowers/plans/`).
- `.github/workflows/ci.yml`: remove the `still-to-come.test.ts` exclusion and
  its now-false comment.
- Fix web lint (`pnpm --filter web lint`) and mobile lint
  (`pnpm --filter mobile lint`) to zero; add both steps to CI.
- Create `docs/how-pluclair-works.md`: sections, routes on each client, the
  headline figures and where each is computed, the AI features and their
  quotas, the bank feed's owner-only status, known issues. Sourced from
  `README.md`, `CONTEXT.md`, `apps/web/PRODUCT.md` and this investigation.
- Correct `apps/web/.env.local.example:54` (D0.5).

### T1 — Editing from the Calendar keeps tags

**Defect.** `CalendarView.tsx:526` renders the edit form without `tags` or
`selectedTagIds`, so no `tagIds` are posted, and `updateTransaction`
(`lib/actions/finance.ts:524`) deletes every `transaction_tags` row and inserts
none. Duplicating from the calendar drops tags the same way.

**Fix.**
- The form posts a hidden marker field whenever it renders the tags control.
  `updateTransaction` replaces tags only when the marker is present; without
  it, tags are untouched. The decision is a small pure function next to the
  action, with a regression test in `apps/web` (vitest).
- The calendar page loads the month's tag map (as `transactions/page.tsx`
  does) and passes `tags` and `selectedTagIds` to both forms.
- Duplicate carries the source transaction's tags.
- Mobile `calendar.tsx` passes `tags` to `TransactionFormModal`, which already
  loads and saves a transaction's tags.

**Files:** `apps/web/lib/actions/finance.ts`,
`apps/web/components/finance/TransactionForm.tsx`, `CalendarView.tsx`,
`apps/web/app/(app)/calendar/page.tsx`, `apps/mobile/src/app/(tabs)/calendar.tsx`.

### T2 — Savings goals count every month since they started

**Defect.** `buildSavingsGoalProgress` (`savings-goals.ts:13`) reads the current
month's savings breakdown, so a goal shows this month's savings as its total.
Four callers: web Plan (`budgets/page.tsx:76`), web month-read facts
(`lib/month-read/facts.ts:184`), mobile Bearing panel (`lib/bearing-panel.ts:550`),
mobile Plan (`(tabs)/planning.tsx:224`).

**Rule (D0.2).** A goal's saved amount is what the monthly summary's `current`
view counts for it, summed over every month from `starts_on` to today, with
the first month counted from `starts_on`:
- a goal linked to a category counts that category;
- a goal with no category counts all savings, with withdrawal categories
  (savings categories whose `counts_toward_summary` is false) subtracting, the
  same rule `getSavingsReserve` uses.

**Change.**
- Migration `038`: `savings_goals.starts_on date not null`, backfilled from
  `created_at` (in `Europe/Paris`), default the insert date.
- Core: `buildGoalRunningTotals(goals, transactions, templates, skips, today)`
  replaces the month-only input, reusing the existing breakdown functions per
  month. Tests: a goal spanning several months, a start mid-month, a goal with
  no category, a withdrawal, a goal starting in the future.
- Web and mobile queries fetch savings transactions from the earliest
  `starts_on`. All four callers switch.
- The goal form gains a start-date field on both clients.
- Translate the hard-coded English on the Plan page ("Categories",
  "Import a statement" and their hints) while it is open.

**Files:** `supabase/migrations/038_goal_start.sql`,
`supabase/tests/038_goal_start.test.sql`, `packages/core/src/savings-goals.ts`
and its test, `apps/web/lib/queries/phase4.ts`, `budgets/page.tsx`,
`BudgetsView.tsx`, `lib/actions/phase4.ts`, `lib/month-read/facts.ts`,
`packages/core/src/validations/phase4.ts`, mobile `planning.tsx`,
`lib/bearing-panel.ts`, `lib/queries.ts`, `lib/mutations.ts`, i18n catalogues.

### T3 — Income recurring templates can be opened from Charges

**Defect.** Both Charges screens group templates by expense, savings and
investment only (`RecurringView.tsx:49`, mobile `(tabs)/recurring.tsx:54`).
Income templates can be created (since `5db9dee`) and are summed in the
header, but never listed, so they cannot be opened.

**Fix.** An Income group, first in order, on both clients, opening the existing
form. The rollup (`recurring-rollup.ts`) is unchanged. The stale comment at
mobile `recurring.tsx:51` goes.

**Files:** `apps/web/components/finance/RecurringView.tsx`,
`apps/mobile/src/app/(tabs)/recurring.tsx`, i18n catalogues.

### T4 — Password reset sets a new password

**Defect.** The reset link returns through `/auth/callback`, which signs the
user in on `/bearing`; `updateUser({ password })` is called nowhere. The PKCE
code verifier lives in the browser that asked, so opening the email elsewhere
likely fails. Mobile has no reset flow.

**Fix.**
- **Web confirm route** `app/auth/confirm/route.ts`: verifies a
  `token_hash` of type `recovery` with `verifyOtp`, then redirects to a
  sanitised `next`. This works from any device.
- **Web new-password page** `app/(auth)/reset/new/page.tsx` with
  `components/auth/NewPasswordForm.tsx`: requires a session; new password
  entered twice; minimum length from the project setting; `updateUser`;
  then the Bearing with a confirmation. Without a session it explains that the
  link has expired and links back to `/reset`.
- `ResetPasswordForm` asks for `redirectTo` `/auth/callback?next=/reset/new`,
  so the old same-browser path also lands on the new page until the email
  template changes. The middleware lets a signed-in user reach `/reset/new`.
- **Mobile:** "Forgot password?" on the login screen opens a reset screen
  (email field, neutral confirmation, identical wording to web) that calls
  `resetPasswordForEmail`; the confirmation says to finish from the link and
  sign in here.
- **Human step at deploy:** in the Supabase dashboard, the "Reset password"
  email template links to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/new`,
  and `/auth/confirm` is an allowed redirect. Mobile resets depend on it,
  because the phone's PKCE verifier can never reach a browser.

**Files:** `apps/web/app/auth/confirm/route.ts`, `apps/web/app/(auth)/reset/new/page.tsx`,
`apps/web/components/auth/NewPasswordForm.tsx`, `ResetPasswordForm.tsx`,
`apps/web/lib/supabase/middleware.ts`, `apps/mobile/src/components/AuthForm.tsx`,
a mobile reset screen under `apps/mobile/src/app/(auth)/`, i18n catalogues.

### T5 — Feature flags

**Model.** A flag has a global default and an optional "on for accounts created
on or after" date; a per-user override wins over both. Evaluation happens in
the database, so both clients receive the same answer.

- Migration `039`: `feature_flags`, `user_feature_flags`, and
  `evaluated_feature_flags()` (security definer, because it reads
  `auth.users.created_at`), returning `(key, enabled)` for `auth.uid()`.
- Core `flags.ts`: the typed list of flag keys with descriptions; a flag absent
  from the database, or unknown to the client, is off. Pure helpers tested.
- Web `lib/flags.ts`: one call per request, memoised with React `cache`.
- Mobile `lib/flags.ts` and a provider: fetched after sign-in, last result kept
  in AsyncStorage, off when nothing is known.
- Flags are switched with SQL or the Supabase dashboard; there is no admin UI.
- First flags: `tags.manage` (T6) and `reference.provenance` (T7).

### T6 — Tags: rename, delete, merge (flag `tags.manage`)

- Migration `040`: `merge_tags(source uuid, target uuid)`, security invoker, in
  one transaction: re-point `transaction_tags` from source to target (skipping
  pairs that already exist, including on soft-deleted transactions), then
  delete the source tag. Refuses when either tag is not the caller's or when
  source equals target.
- The Plan page's Tags card becomes a list on both clients. Rename inline
  (the web action already accepts an id). Delete through a confirmation that
  states how many transactions carry the tag. Merge by picking a target. A
  rename to a name that already exists offers the merge instead of failing.
- Web actions in `lib/actions/phase4.ts`; mobile in `lib/mutations.ts`.
- SQL assertion script covers merge with overlapping transactions, soft-deleted
  transactions, cross-user refusal and delete cascade.

### T7 — Reference data registry

**Table** (migration `041`) as in plan section 4.4: `id`, `key`, `value jsonb`,
`unit`, `effective_from`, `effective_to` (null means open), `source_label`,
`source_url`, `status` (`draft` or `active`), `review_by`, `fetched_at`,
`reviewed_by`, `created_at`. Active ranges for one key may not overlap
(exclusion constraint). Authenticated users read active rows; only the service
role writes.

**Core** `reference.ts`: `ReferenceRow`, `ReferenceSnapshot`,
`resolveRef(snapshot, key, onDate)` returning the value with its provenance or
`null`, and `staleKeys(rows, today)`. Core stays synchronous: each app loads
the active rows and passes values into the functions that need them, as
`buildPeaStatus` already accepts `ceiling`. A rule is evaluated on the date of
the figure (today for the PEA countdown).

**Loaders.** Web: server-side, memoised per request. Mobile: fetched with the
session, cached in AsyncStorage for offline use.

**Seeded and migrated** (status `active`, because they reproduce today's
figures; sources and effective dates listed in the migration for review):

| Key | Value | Replaces |
|---|---|---|
| `fr.pea.ceiling` | 150000 EUR | `PEA_CONTRIBUTION_CEILING` |
| `fr.pea.min_years` | 5 years | `PEA_MATURITY_YEARS` and "five years" / "cinq ans" in copy (placeholder `{years}`) |
| `fr.av.fee_typical` | `{ "min": 0.005, "max": 0.008 }` per year | the envelope-fee hint copy (placeholders) |
| `fund.<ISIN>.ongoing_charge` | nine values | `etf-shortlist.ts` hints (ANX has none) |
| `bench.world_equity.weight.{fr,europe,us}` | 0.03, 0.15, 0.64 | `WORLD_EQUITY_REFERENCE`; the unused `eurozone` weight is dropped |

The 10-year fee horizon, defined three times, becomes one core constant: it is
a presentation choice, not a financial fact. The per-user
`wallet_plans.contribution_ceiling` override keeps precedence over the registry.

**When a value is missing,** the figure that depends on it says it is
unavailable; nothing falls back to a number written in code.

**Provenance (flag `reference.provenance`):** a "Source: …, effective …" line
under the PEA ceiling and the five-year date on both clients.

**Staleness:** `pnpm check:reference` lists keys past `review_by`.

**Test:** with the seeded snapshot, every figure touched (PEA status and hint,
look-through charges and region bias, wallet-read facts) equals today's output.

### T8 — AiProvider and one gateway

1. **Characterisation first.** Tests on the three web adapters, through their
   existing injection points, record the exact request each feature sends and
   how each failure mode behaves. The refactor must leave them unchanged.
2. **Core `ai/`:** the `AiProvider` interface (chat completion with a JSON
   schema; web search) and `AI_FEATURES`, one registry of feature key, prompt
   version, quota, period, cooldown and model setting. The instrument-reading
   quota constants move here from `lib/instrument-reading/read.ts`.
3. **Web `lib/ai/`:** the Mistral implementation (`server-only`; the API key
   read once; one circuit breaker per feature, same thresholds) and
   `askAi(feature, request)`, the only function that reaches the provider.
   Prompts still come from the core builders. Per-feature model pin:
   `MISTRAL_MODEL_<FEATURE>`, falling back to `MISTRAL_MODEL`, then the default.
4. **Call log** (migration `042`): `ai_calls` with user, feature, model, prompt
   version, input and output tokens, latency, outcome (`ok`, `http_error`,
   `timeout`, `breaker_open`, `parse_error`), validator result (`pass`,
   `trimmed`, `rejected`, `none`), timestamp. No payload. Users read their own
   rows; server actions insert their own; the cron path uses the service role.
5. **Quotas keep their atomic `reserve_*` functions and their rules**: reserve
   before the call, refund on no answer, a rejected answer still counts, and the
   instrument reading's release-on-reject.
6. The five features move one commit at a time, each checked against step 1.

### T9 — Analytics layer

- Core `analytics.ts`: the plan 4.10 catalogue, one schema per event that
  admits only enums, identifiers, counts and durations; amounts, merchant names
  and free text are unrepresentable. Tested.
- Web and mobile `track(event, props)`: validates, then sends to a sink. The
  only sink in Phase 0 discards.
- Consent: `user_preferences.analytics_consent` (migration `043`), default off,
  a switch in Profile on both clients. No consent, no event.
- Wired now where the surface exists: onboarding steps (web `WelcomeFlow`,
  mobile `onboarding.tsx`), `import_completed`, `ai_call` (from the gateway).

### T10 — Persona fixtures and harness

- `packages/core/test/personas/`: a seeded generator and six persona specs from
  plan 4.9, each producing 24 months of categories, recurring templates,
  transactions, skips, month closes, savings goals and investment positions as
  database row types. Persona 5 is empty by design.
- A loader and one test per persona computing today's figures (monthly
  summaries, Kept and Unrecorded, the forward projection, category findings,
  goal running totals) against golden files.
- Persona 1's deferred-debit card is represented in ledger rows and closes only;
  its bank rows arrive in Phase 1.

### T11 — Close

Update `docs/how-pluclair-works.md`, then report: what changed, data model
changes, tests added, flags created, what comes next.

## 6. Data model

| Migration | Change | RLS |
|---|---|---|
| `038_goal_start` | `savings_goals.starts_on date not null`, backfilled | existing policies |
| `039_feature_flags` | `feature_flags`, `user_feature_flags`, `evaluated_feature_flags()` | flags readable by authenticated users; overrides readable by their owner; writes by service role only |
| `040_merge_tags` | `merge_tags(source, target)` | existing tag policies (security invoker) |
| `041_reference_values` | `reference_values` with non-overlap constraint, seeded | active rows readable by authenticated users; writes by service role only |
| `042_ai_calls` | `ai_calls`, index on `(user_id, created_at)` | owner reads; owner inserts; service role inserts |
| `043_analytics_consent` | `user_preferences.analytics_consent boolean not null default false` | existing policies |

Each has a `supabase/tests/<n>.test.sql` assertion script in the style of
`036_soft_delete.test.sql`, run after `supabase db reset` replays the chain.

## 7. Risks and tests

| Risk | Mitigation |
|---|---|
| Goal figures change for every existing user (D0.2) | Core tests for the rule; personas carry goals with golden totals; stored month reads keep the figures they were written from |
| Tag merge or delete loses data | Atomic function; SQL assertions including soft-deleted rows and cross-user refusal; confirmation states the count |
| The AI refactor changes behaviour silently | Characterisation tests first; one feature per commit; the cron path and the instrument quota's release-on-reject tested explicitly |
| Registry values shift a figure | Snapshot-equality test against today's outputs; missing value shown as unavailable, never guessed |
| Reset email template and deploy out of step | The confirm route and the callback both lead to `/reset/new`, so either link works during the switch |
| Flags add latency | One database call per request on web, one per session on mobile |
| Lint fixes touch unrelated files | Separate commits, no behaviour change, typecheck and tests after each |

**Test inventory:** core unit tests for every new pure function; web vitest for
the tag-update decision and the AI adapters; one SQL assertion script per
migration; persona golden tests; manual checks on both clients for T1–T4 and
T6.

## 8. What will look different when Phase 0 lands

- Editing a transaction from the Calendar keeps its tags; the phone calendar
  can edit tags.
- Savings goal progress counts everything since the goal started, not just this
  month; most totals rise. The goal form has a start date.
- Income recurring templates appear in Charges, first, and open for editing.
- A reset link asks for a new password; the phone's sign-in screen has
  "Forgot password?".
- Behind flags, off until switched on: tag rename, delete and merge; source
  lines under the PEA figures.
- Deliberately unchanged: every other figure, every AI output (same prompts,
  same model, same quotas), and no analytics leaving the device.
