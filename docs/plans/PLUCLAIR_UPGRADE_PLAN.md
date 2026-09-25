# Pluclair upgrade plan — master prompt for Claude Code

> **How to use this file**
> 1. Save it in the repo as `docs/plans/PLUCLAIR_UPGRADE_PLAN.md`.
> 2. Start each Claude Code session with:
>    *"Read `docs/plans/PLUCLAIR_UPGRADE_PLAN.md` in full. We are working on Phase N. Start with the Phase plan (section 1.2) and wait for my go."*
> 3. Run one phase per session (or per series of sessions). Every phase ends with a checkpoint where I review before we continue.
> 4. Sections 1 to 5 apply to every phase. Section 6 lists the phases. Section 7 is work only I (the human) can do; never pretend it is done.

---

## 1. Your role and how you work

You are a senior full-stack engineer and product designer pairing with me (Engineering Manager, Product & Design, former Lead Frontend). You own implementation quality; I own product decisions, vendors, legal matters and anything that changes a promise made to users.

### 1.1 Rules for every change

- **Read before writing.** At the start of each phase, read: `apps/web/DESIGN.md`, `packages/core` (domain logic), the current app guide (`How Pluclair works`), and every file named in the phase.
- **Small, reviewable commits.** One concern per commit. Typecheck, lint and tests must pass before you say a task is done.
- **Feature flags.** Every user-facing change ships behind a flag (Phase 0 creates the system). Default off for existing users unless the phase says otherwise.
- **Migrations are additive and reversible.** Never drop or rewrite user data without an explicit, approved migration plan. Keep Supabase RLS on every new table.
- **Domain logic lives in `packages/core`**, as pure, tested functions shared by web (Next.js) and mobile (Expo). UI layers stay thin.
- **i18n.** No hard-coded copy. Every string exists in English and French. Money formatting uses the user's currency and locale.
- **Design.** Use the tokens and patterns in `apps/web/DESIGN.md` (dark ledger palette, one gold accent). WCAG 2.2 AA: contrast, focus states, 44 px targets, screen-reader labels on every figure.
- **Web and mobile parity** for every new flow, unless a phase explicitly says web first.
- **No hard-coded financial or tax parameters.** Rates, ceilings, thresholds and tax brackets come from the Reference data registry (4.4).
- **No invented third-party APIs.** When a phase needs a vendor (bank aggregator, data provider), build behind an interface with a fake implementation and tests, then ask me for the vendor docs and sandbox keys.
- **Mark legal sensitivity.** Any code path or copy that recommends, ranks or names a financial product carries a `// LEGAL-REVIEW:` comment with one line explaining why.
- **Update the app guide** at the end of each phase (what changed, new routes, new known issues).

### 1.2 Phase plan (required before coding)

Before writing code for a phase, produce and wait for my approval on:

1. **Understanding**: what exists today that the phase touches (files, tables, components), in a few lines each.
2. **Tasks**: ordered list, each with files to create or modify.
3. **Data model**: new tables, columns, indexes, RLS policies, migrations.
4. **Risks**: what could break (money calculations, sync, existing users) and how you will test it.
5. **Open questions**: only the ones that block you. Propose a default for each.

### 1.3 Stop and ask me when

- a change alters how a figure is calculated (Kept, Unrecorded, projection, returns);
- data would be deleted or rewritten;
- a new vendor, dependency with network access, or paid service is needed;
- new user data would be sent to an LLM or a third party;
- a user-visible promise, legal text or marketing claim is affected;
- a recommendation would name a specific financial instrument, insurance contract or provider.

---

## 2. Product context (summary)

Pluclair tracks one person's money (EUR by default, USD supported): what came in, what went out, what was set aside and what is invested. Its core ritual is the **monthly close**: on a reading day (the 5th by default, after deferred card debits land), the user's real balance is compared with the records, giving **Unrecorded spending** (what left the account that no transaction explains) and **Kept** (what the month really added to their wealth).

- **Stack:** Next.js web app (`apps/web`) and Expo phone app, one Supabase database, shared domain logic in `packages/core`. EN and FR.
- **Sections:** Bearing (`/bearing`), Ledger (List `/transactions`, Calendar `/calendar`, By category `/history`), Charges (`/recurring`), Plan (`/budgets`), Wallets (Positions `/investments`, Look-through `/investments/look-through`). Secondary: Profile, Categories, Import, Welcome.
- **Wallets:** PEA, CTO, AV, PER, Crypto. Already has money-weighted return, allocation vs targets with contribution-only rebalancing, PEA ceiling and 5-year countdown, envelope fees, 10-year fee cost, look-through (countries, sectors, overlaps, all-in cost, PEA wrapper check, target trades).
- **AI today:** Mistral writes month summaries, orders findings, reads funds (with web search) and reviews wallets, under monthly quotas. Rule already in place: **the model never writes a number; the app fills in its own figures.**
- **Bank feed today:** only for the owner's account (`OPEN_BANKING_OWNER_USER_ID`).
- **Known issues (fixed in Phase 0):** Calendar edit deletes tags; savings goals only count the current month; income charges cannot be edited from Charges; password reset never sets a new password.

---

## 3. Locked decisions

**D1. Personal recommendations, delivered through a tier ladder.** Pluclair moves from "never gives advice" to personal recommendations. Because investment and insurance advice are regulated in France, every insight and recommendation carries a tier, and each tier is enabled by configuration:

| Tier | What it is | Example | Enabled |
|---|---|---|---|
| 0 | Fact about the user's own data | "Your subscriptions cost €1,140 a year." | Always |
| 1 | What-if simulation | "At +€100/month, the goal lands in March instead of June." | Always |
| 2 | General rule of thumb, labelled as such | "A common buffer is 3 to 6 months of essential spending." | Always |
| 3 | Personal recommendation on budgeting and saving behaviour (no product) | "Raise your Holidays contribution to €180/month to reach it on time." | From Phase 4 |
| 4 | Personal recommendation on product *types* or allocation | "Money for a goal 8 years away could be invested rather than held as cash." | Only after legal opinion (H1) |
| 5 | Personal recommendation on a specific instrument, contract or provider | "Switch fund A for ETF B in your PEA." | Only with regulatory status (H1); crypto instruments never |

Build the full pipeline (suitability profile, rulesets, records, disclosures) now, so Tiers 4 and 5 can be switched on without re-architecture. Until switched on, the same engine shows Tier 0 to 3 content.

**D2. Every user can connect their bank through an aggregator.** Account information only (AIS). Pluclair never initiates payments. Manual entry and CSV/PDF import remain as fallbacks.

**D3. Priority order for the optimization areas:** 1. Goals and forecasts, 2. Investments and fees, 3. Everyday spending and cash, 4. Tax envelopes (PEA, AV, PER).

**D4. France-first.** EUR default, French banks and wrappers first, EN and FR at parity.

**D5. Mistral stays the AI provider** (EU), behind an `AiProvider` interface so models can be swapped or pinned per feature.

**D6. Brand promises change (needs my sign-off before any copy ships).** Proposed replacement for the three promises:
1. It never moves money.
2. It never acts on a rule you didn't write.
3. It shows its work: every figure and every recommendation says where it comes from, and you decide.

**D7. "Kept" becomes the headline metric.** With bank connections, unrecorded spending tends toward zero for connected accounts; it stays meaningful for cash and unconnected accounts. Copy, onboarding and the marketing site lead with "See what you really keep each month."

---

## 4. Shared specifications

These contracts are used by several phases. Implement them in `packages/core` with unit tests.

### 4.1 Insight contract

```ts
export type Area = 'goals' | 'forecast' | 'investments' | 'fees' | 'spending' | 'cash' | 'envelopes';
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export type Unit = 'EUR' | 'PCT' | 'MONTHS' | 'DAYS' | 'COUNT' | 'PROB';

export interface SourceRef {
  kind: 'transaction' | 'close' | 'charge' | 'goal' | 'holding' | 'account' | 'reference' | 'price_series';
  id: string;
}

export interface Fact {
  key: string;                 // e.g. 'required_monthly_eur'
  value: number;
  unit: Unit;
  formulaKey: string;          // i18n key describing the calculation in plain words
  period?: { from: string; to: string };  // ISO dates
  sources: SourceRef[];
}

export type FactRef = { fact: string };

export type InAppAction =
  | { type: 'edit_goal'; goalId: string; patch: Record<string, FactRef | string> }
  | { type: 'create_goal'; template: string; target: FactRef; date?: string }
  | { type: 'create_cap'; categoryId: string | 'all'; amount: FactRef }
  | { type: 'edit_charge'; chargeId: string; amount: FactRef }
  | { type: 'create_charge'; categoryId: string; amount: FactRef; schedule: 'monthly' | 'yearly' }
  | { type: 'open_simulator'; simulator: string; params: Record<string, FactRef | string> }
  | { type: 'open_page'; route: string }
  | { type: 'mark_known' };

export interface Insight {
  id: string;                  // stable hash of (detector, subject, period)
  detector: string;            // 'goals.feasibility@1' (name@version)
  area: Area;
  tier: Tier;
  subject: { type: 'goal' | 'category' | 'charge' | 'holding' | 'wallet' | 'account' | 'global'; id?: string };
  facts: Record<string, Fact>;
  impact: { annualEur?: number; probabilityDelta?: number };
  confidence: number;          // 0..1, driven by data sufficiency, never by the LLM
  urgency: 'none' | 'this_month' | 'deadline';
  deadline?: string;
  actions: InAppAction[];      // in-app only; Pluclair never moves money
  copy: { titleKey: string; bodyKey: string };  // deterministic fallback copy
  createdAt: string;
  expiresAt?: string;
}
```

Rules: detectors are pure functions `(ctx: FinanceContext) => Insight[]`; the same input always gives the same output; every number shown to the user is a `Fact` with sources.

### 4.2 Recommendation contract

```ts
export interface RecommendationOption {
  key: string;                 // 'raise_contribution' | 'move_date' | 'do_nothing' ...
  labelKey: string;
  facts: Record<string, Fact>; // consequences of choosing this option
  actions: InAppAction[];
}

export interface Recommendation extends Insight {
  tier: 3 | 4 | 5;
  rulesetVersion: string;      // versioned, reviewed rules that produced it
  basis: {
    goalIds: string[];
    profileVersion?: string;   // required for tier >= 4
    referenceVersions: string[];
    assumptions: { key: string; value: number; unit: Unit; sourceKey: string }[];
  };
  options: RecommendationOption[];  // at least 2, always including 'do_nothing'
  risks: string[];             // i18n keys
  costs: Fact[];
  disclosures: string[];       // i18n keys, mandatory for tier >= 4
  requiresStatus: null | 'LEGAL_OPINION' | 'CIF' | 'INSURANCE_INTERMEDIARY';
}
```

- Tier gating is enforced server-side in one place (`canShow(recommendation, userConfig, regulatoryConfig)`), never in UI code.
- Instrument-level crypto recommendations are always blocked.
- Recommendation logic is deterministic rules and optimisation code. The LLM never decides what to recommend; it only explains a `Recommendation` object that already exists.

### 4.3 Narration contract (LLM output)

Input to the model: the insight or recommendation with facts replaced by placeholder names, the user's language, the tone guide. Never raw transactions, names, IBANs or merchant lists unless the feature is explicitly approved for it.

Output: JSON validated against a schema.

```json
{ "title": "string", "body": "string", "why": "string" }
```

Validator (reject and fall back to deterministic copy on any failure, then log the reason):
- Numbers appear only as placeholders `{{f.<factKey>}}` or dates as `{{d.<key>}}`; any digit outside a placeholder fails.
- Every placeholder must exist in the input facts.
- Banned wording per tier (e.g. for tiers 0 to 3: imperative buy or sell verbs, product or provider names not already held by the user, guarantees such as "risk-free", "sure", "guaranteed").
- Length limits per surface; language must match.
- AI-written text is labelled as such in the UI.

### 4.4 Reference data registry

Table `reference_values`:

| Column | Notes |
|---|---|
| `key` | e.g. `fr.livret_a.rate`, `fr.ldds.rate`, `fr.lep.rate`, `fr.livret_a.ceiling`, `fr.lep.income_ceiling`, `fr.pea.ceiling`, `fr.pea.min_years`, `fr.av.min_years`, `fr.av.allowance_single`, `fr.pfu.rate`, `fr.social_charges.rate`, `fr.ir.brackets`, `fr.per.ceiling_rules`, `insee.cpi.<coicop>`, `ecb.fx.<ccy>`, `bench.<index>.return_assumption`, `bench.<index>.drawdowns` |
| `value` | number or JSON |
| `unit` | |
| `effective_from`, `effective_to` | values change over time (regulated savings rates move twice a year) |
| `source_label`, `source_url` | official source first (Banque de France, service-public, Légifrance, INSEE, ECB) |
| `status` | `draft` or `active`; fetchers write drafts, I activate |
| `fetched_at`, `reviewed_by` | |

- A lookup always takes a date: `ref('fr.livret_a.rate', onDate)`.
- The UI shows provenance next to any figure that uses reference data ("Source: …, effective …").
- A staleness check flags keys past their expected review date.
- Migrate existing hard-coded values (PEA €150k ceiling, 5-year rule, fee assumptions) into the registry in Phase 0.

### 4.5 Forecast engine

- **Base:** keep the existing deterministic "If nothing changes" projection (charges plus usual unrecorded spending).
- **Range:** add a Monte Carlo layer in `packages/core/forecast`:
  - inputs: scheduled charges, detected income (with variance for irregular income), monthly totals per discretionary category from closed months, unrecorded history, goal contributions, investment assumptions from the registry;
  - method: block bootstrap of monthly residuals (month-of-year aware once 12+ months exist), 2,000 seeded paths for reproducibility;
  - outputs: P10, P50, P90 per month end; probability of the balance dropping below the user's floor before the next income, using an intra-month spending profile;
  - investments: return and volatility assumptions per asset class from the registry; never user-specific market predictions.
- **Confidence** comes from data sufficiency (months of history, share of categorised spending) and widens the range; the UI says so in plain words.
- **Calibration test:** backtest on persona fixtures; the P10 to P90 band should contain roughly 80% of realised outcomes. Fail the build if coverage falls outside 70 to 90%.
- **Performance:** must run on mobile; target under 200 ms for 24 months of history, otherwise move to a worker.

### 4.6 Suitability profile (for tiers 4 and 5)

- Collected just in time, the first time the user opens a tier 4+ recommendation, never in onboarding.
- Domains: knowledge and experience; financial situation (income, assets, debts, ability to bear losses); objectives (horizon, risk tolerance, sustainability preferences).
- Pre-filled from Pluclair data where possible, always confirmed by the user.
- Versioned, with an expiry date and a re-validation prompt; consistency checks (e.g. declared low risk tolerance while holding a large crypto share) produce a question, not a silent correction.
- Output: a risk class aligned with the 1 to 7 PRIIPs summary risk indicator, stored with its version.
- `// LEGAL-REVIEW:` on the questionnaire content; final wording comes from H1.

### 4.7 Records and audit

Table `recommendation_records`, append-only:
`id, user_id, recommendation_snapshot (JSON), profile_snapshot, ruleset_version, reference_versions, narration_shown, shown_at, surface, user_response (accepted | declined | dismissed | ignored), response_at, response_reason`.
Retention period to be confirmed in H1. Users can export their records. Nothing in this table is ever updated in place.

### 4.8 AI data minimisation

- One helper builds every LLM payload; features cannot call the provider directly.
- Send aggregates and placeholders, not raw ledgers. Categorisation sends merchant labels only (no amounts, dates, IBANs).
- Per-feature consent toggles in Profile (AI summaries, categorisation, document reading, Ask Pluclair).
- Every call logs feature, model, tokens, latency, validator result; no payload contents in logs.
- Quotas stay per feature, per month; generation happens at close time in batch where possible, then is cached.

### 4.9 Evaluation harness

- `packages/core/test/personas/`: synthetic 24-month datasets with expected outputs:
  1. Salaried renter in Paris, deferred debit card, one PEA.
  2. Homeowner with a mortgage and yearly charges (property tax, insurance).
  3. Freelancer with irregular income.
  4. Investor with PEA, AV, CTO and crypto, overlapping index funds.
  5. Brand-new user with no history.
  6. Student with low income (LEP-eligible), mostly cash spending.
- Tests: detectors are deterministic (golden files); forecast calibration (4.5); narration validator pass rate; tier gating never leaks a tier above config; suitability constraints never violated by any tier 4+ recommendation.
- CI runs deterministic tests on every PR; LLM evals (faithfulness, banned wording, EN/FR parity) run nightly or on demand.

### 4.10 Analytics events

Privacy-friendly, EU-hosted tool (I will choose). Never send amounts, merchant names or free text.

`onboarding_step_viewed | completed | skipped {step}`, `sample_data_entered | exited`, `bank_connect_started | succeeded | failed {provider, bank_id, error_code}`, `import_completed {source, rows}`, `bearing_first_populated {seconds_since_signup}`, `month_review_started | completed | abandoned {step, duration}`, `insight_shown | opened | actioned | dismissed {detector, tier, reason}`, `recommendation_shown | accepted | declined {detector, tier}`, `ai_call {feature, validator_pass, latency_ms}`.

### 4.11 Vocabulary

Apply in both languages in Phase 3. French labels marked "to confirm" need my validation.

| Today | New | Note |
|---|---|---|
| Bearing | Bearing, with "Where do I stand?" as visible subtitle | Keep brand voice, show the question |
| Ledger | Ledger + "What happened?" | |
| Charges | Recurring (FR: Récurrents, to confirm) + "What repeats?" | Salary is not a "charge" |
| Apply | removed | Charges post themselves (Phase 3) |
| Close the month | Month review | The close becomes the first step of the review |
| Look-through | Inside your funds (FR to confirm) | |
| Plan | Plan + "What does it add up to?" | Holds caps, goals, projection only |
| Kept, Unrecorded spending, Reading day | unchanged | Each gets a "How is this calculated?" sheet |

---

## 5. Guardrails for the optimization layer

1. **The engine computes, the model narrates.** All figures, rankings inputs and recommendations come from deterministic code. The LLM phrases, orders (within rules) and answers questions through tools.
2. **Evidence, simulation, action.** Every insight shows why ("Why am I seeing this?": facts, formula, period, sources, confidence), what happens under each option, and one-tap actions inside Pluclair.
3. **Always a "do nothing" option,** and dismissing teaches: "Not relevant", "Already done", "Wrong" adjust per-user thresholds; "Wrong" is logged for review.
4. **Calm by default.** One item in the Bearing attention row, at most three opportunities per Month review, push notifications only for deadlines or real risk (e.g. likely overdraft before payday).
5. **Never moves money.** Actions edit Pluclair data (goals, caps, charges). Anything outside Pluclair is described, never executed.
6. **Honest uncertainty.** Ranges instead of single numbers for anything about the future; assumptions visible and sourced.

---

## 6. Phases

Sizes are rough (S = days, M = 1 to 2 weeks, L = 3+ weeks of focused work). Each phase lists acceptance criteria; the checkpoint is my review against them.

### Phase 0 — Foundations and trust fixes (M)

**Goal:** fix what breaks trust and lay the infrastructure every later phase needs.

Tasks:
1. **Bug: Calendar edit deletes tags** (`components/finance/CalendarView.tsx:526`, `lib/actions/finance.ts:524`). Pass existing tags to the Calendar edit form, and make the save action change tags only when the tags field is present in the payload. Add a regression test.
2. **Bug: savings goals only count this month** (`app/(app)/budgets/page.tsx:76`). Compute the running total from the goal's start date across all months; move the calculation to `packages/core`; test with multi-month fixtures.
3. **Gap: income charges not editable** (`components/finance/RecurringView.tsx:49`). List and edit income charges in Charges.
4. **Gap: password reset** (`components/auth/ResetPasswordForm.tsx:48`). After the reset link signs the user in, require and save a new password (Supabase `updateUser`). Same flow on mobile.
5. **Tags:** add rename, delete and merge.
6. **Feature flags:** per-user, server-evaluated, readable on web and mobile.
7. **Analytics layer** with the events in 4.10, behind a consent setting if required.
8. **`AiProvider` interface** wrapping all existing Mistral calls, with the payload helper (4.8), central quotas and call logging. No behaviour change.
9. **Reference data registry** (4.4) and migration of hard-coded parameters.
10. **Persona fixtures and test harness skeleton** (4.9).

Acceptance: the four known issues are closed with tests; all existing AI features run through `AiProvider`; no hard-coded PEA or fee parameter remains; personas load in tests.

### Phase 1 — Bank connection for every user (L)

**Goal:** any user can connect their banks through an aggregator; the owner-only feed disappears.

Tasks:
1. **Discovery (checkpoint).** Document how the current owner feed works (provider, tables, sync, merge logic, "rows merged away by mistake"). Then write a `BankProvider` interface: `createConnectSession`, `handleCallback`, `listAccounts`, `fetchBalances`, `fetchTransactions(since)`, `getConnectionStatus`, `renewConsent`, `revoke`, optional `listHoldings` for savings and investment accounts. Build a fake provider for dev and tests. Do not integrate a real vendor until I confirm the choice (H2) and give you docs and sandbox keys.
2. **Data model:** `bank_connections`, `bank_accounts` (type: current, savings, card, investment, loan; `is_cash` flag), `raw_bank_transactions` (immutable, provider ids, pending vs booked), link table to ledger transactions. Provider tokens encrypted, server-side only, never sent to clients. RLS everywhere.
3. **Sync pipeline:** server jobs, idempotent, incremental, retry with backoff, webhook handler if the provider has one. Deduplicate against manual and imported rows using the existing merge logic, and add tests for the "merged away by mistake" case.
4. **Deferred debit cards (carte à débit différé):** model the card as its own account; categorise card payments individually; mark the monthly settlement line on the current account as an internal transfer so nothing is counted twice; verify close maths on persona 1.
5. **Internal transfers** between the user's own accounts: detect them; transfers to savings count as "Set aside".
6. **Consent UX:** read-only explanation (what is read, how long, how to revoke), re-consent reminders before expiry, connection health in Profile → Connections, disconnect with the choice to keep or delete imported data.
7. **Auto-close:** when cash accounts are connected, compute the close on the reading day automatically; the user confirms it in the Month review. Unrecorded spending is computed only for cash and unconnected sources, and the UI explains why it may be zero.
8. **Mobile:** connect flow in an in-app browser with deep-link callback.
9. **Retire `OPEN_BANKING_OWNER_USER_ID`**, migrating the owner's existing connection to the new model without data loss.

Acceptance: end-to-end connection with the sandbox on web and mobile; history backfill as deep as the provider allows; no duplicates on persona fixtures combining feed and CSV; tokens never reach a client; revoke removes provider tokens; close figures unchanged for the owner's past months.

### Phase 2 — Onboarding v2 (M)

**Goal:** a populated, useful Bearing in under three minutes (excluding the bank's own authentication).

Principle: ask only what the app can't infer, show something useful after each answer, postpone the rest.

Flow (web and mobile, resumable, every step skippable):
1. **Intent, one tap:** "What do you want most?" — know where my money goes, spend less, save for something, grow my investments. Stored; weights Bearing ordering and insight ranking. A "Try with sample data" link opens a read-only demo workspace built from persona 1, with a permanent "Sample data" banner and one-click exit. Demo data never mixes with real data.
2. **Bring your money in:** primary "Connect your bank"; secondary "Import statements" (CSV with presets for major French banks and neobanks, or PDF statements read with Mistral OCR: transactions plus opening and closing balances, low-confidence rows sent to review, files discarded after extraction unless I decide otherwise); tertiary "Start manually" with tappable chips for common fixed costs (rent, electricity, internet box, phone plan, mutuelle, transport, insurance).
3. **What we found:** one confirmation screen listing detected income (amount, day), recurring payments (reuse the statement-suggestion logic on the backfilled history), cash accounts, savings and investment accounts. Each item can be toggled or edited. Unknown merchants are categorised with AI (4.8 rules) and low-confidence ones go to the Review inbox.
4. **Your starting line:** today's balance, pre-filled from the bank when connected. One sentence and a small month timeline explain the review: "During the month, Pluclair records. On the 5th, it compares with your real balance and shows what you kept." Reading day editable (default 5th).
5. **Your Bearing:** populated with what's yours to spend, the projection, and past months' Kept computed from the backfill. A first-month checklist (dismissible, persisted): install the phone app, enable Face ID, add investments, create a first goal. Notification permission asked in context: "Remind me on {next reading day} for my first Month review."

Removed from onboarding: currency step (inferred from locale, editable inline), spending cap (suggested in Phase 7 from real medians), Wallets (offered in the checklist, or at step 3 when intent is "grow my investments").

Acceptance: median time to a populated Bearing under 3 minutes on the persona datasets with the fake provider; every step has EN/FR copy and analytics; demo mode fully isolated; a manual-only path works end to end; usability test script for five users delivered with the phase (H6).

### Phase 3 — Simplification and the Month review (M)

**Goal:** the monthly cycle becomes two actions: record during the month, review on the 5th.

Tasks:
1. **Month review:** full-screen flow, web and mobile, under two minutes, opened from the reading-day notification or the Bearing attention row, resumable. Steps: confirm balance (auto when connected) → Kept and Unrecorded vs allowance, streak → what moved (existing findings) → up to three opportunities (Phase 4 onward; empty-safe before that) → next month (confirm charges, adjust caps and goals) → AI month summary (numbers by placeholder). The existing close logic is reused, not rewritten.
2. **Retire "Apply":** charges post themselves as "expected" on their due date, get matched to bank rows or confirmed via "Did these arrive?", and can always be undone. Default on for new users; existing users get an in-app choice. Keep a manual-mode setting.
3. **Declutter Plan:** Plan keeps caps, goals and projection. The close moves into the Month review (history stays reachable), tags move to Categories ("Categories and tags"), reading day and cash accounts move to Profile → Money.
4. **Vocabulary pass** (4.11) in EN and FR; section questions visible as subtitles.
5. **Progressive disclosure:** Wallets appears once an investment account or holding exists; By category after two months of data; a reusable "How is this calculated?" sheet on every headline figure (formula, data period, sources, link to the detail page).
6. **Mobile parity:** By category, password reset (from Phase 0), offline outbox if feasible; document what remains.

Acceptance: a persona can complete a Month review in under two minutes on mobile; no change in close figures; Apply is gone for new users; every headline figure has its explainer.

### Phase 4 — Insight and recommendation engine (M)

**Goal:** one engine that produces, ranks, explains, gates and records every insight and recommendation.

Tasks:
1. `packages/core/insights`: detector registry, contracts 4.1 and 4.2, ranking score = impact × confidence × intent weight × novelty (deterministic, documented), deduplication, expiry, lifecycle (new, seen, actioned, dismissed with reason), per-user threshold learning from dismissals.
2. Storage: `insights` (per user, per period) and `recommendation_records` (4.7).
3. Surfaces: Bearing attention row (with explicit priority rules against existing items), Month review opportunities (max three), contextual slots on pages, notifications only for `urgency !== 'none'`.
4. Narration service (4.3) through `AiProvider`, batched at close time, cached, with deterministic fallback copy.
5. Tier gating (`canShow`) with `userConfig.tierMax` and a global `regulatoryConfig { legalOpinion: boolean, cif: boolean, insuranceIntermediary: boolean }`, all false by default. Crypto instrument recommendations hard-blocked.
6. "Why am I seeing this?" drawer: facts, formula, period, sources, assumptions, confidence, feedback buttons.
7. Eval harness wired into CI (4.9).

Acceptance: a dummy detector flows end to end on web and mobile; gating tests prove no tier above config is ever returned; a narration containing a raw number is rejected and replaced by fallback copy; every shown recommendation creates a record.

### Phase 5 — Goals and forecasts (priority 1) (L)

**Goal:** users know if they will reach their goals, with honest ranges, and get personal recommendations to get there.

Tasks:
1. **Goals v2:** types (emergency fund, purchase or project, travel, home deposit, retirement), target, date, priority, starting amount, linked accounts or categories, running total (from Phase 0), optional linked contribution charge.
2. **Emergency fund template:** target = N × median monthly essential spending (N chosen by the user, default 3), shown as a tier 2 rule of thumb.
3. **Forecast engine v2** (4.5): ranges on Bearing "The year ahead" and in Plan; "risk of dipping below your floor before your next income" in the This month card; floor setting in Plan.
4. **Detector `goals.feasibility`:** probability of reaching each goal by its date at the user's real Kept pace; required monthly amount for an 80% chance (configurable); allocation of expected Kept across goals by priority (waterfall) to surface conflicts.
5. **Tier 3 recommendations:** raise a contribution, move a date, lower a cap on a named category to fund a goal (using its median), pause a lower-priority goal. Each has at least two options plus "do nothing", and one-tap actions.
6. **Tier 4 (gated, `LEGAL-REVIEW`):** where to hold a goal's money by horizon (cash-like vs invested), product types only.
7. **What-if simulator:** monthly saving, date, one-off expense ("Can I afford €X on this date?"); shows how the range and goal probabilities move. Reused by Ask Pluclair.

Acceptance: calibration test passes on personas; goal probabilities are reproducible (seeded); every recommendation shows options, facts and sources; persona 3 (irregular income) shows visibly wider ranges with an explanation.

### Phase 6 — Investments and fees (priority 2) (L)

**Goal:** users see what their investments really cost, how they really performed, and what to change.

Tasks:
1. **Fee audit:** all-in cost per holding and per wallet (fund ongoing charges from KID/PRIIPs documents where available, envelope fees, transaction fees); cost over the user's horizon compared with a sourced low-cost reference level.
2. **Honest benchmark:** replay the user's actual cash flows (dates and amounts) into a user-selectable benchmark (default a broad world equity index proxy, or a blend matching their target allocation); compare money-weighted returns; methodology visible.
3. **Risk and concentration:** existing overlap detection, plus single-line concentration, currency exposure, crypto share, country and sector vs market; stress test with historical drawdown scenarios from the registry.
4. **Drift bands and contribution-first rebalancing** over N months (extends the existing panel).
5. **Suitability profile** (4.6) and a mismatch detector (profile vs actual allocation).
6. **Recommendations:** tier 3 and 4 at allocation level (e.g. consolidate overlapping index exposure, direct next contributions to an under-weight asset class), gated; tier 5 (specific switches, buy or sell lines) built with rulesets and records but switched off until `regulatoryConfig.cif`.
7. **Holdings import:** via the aggregator's savings and investment coverage when available, and via PDF broker or AV statements (OCR).
8. **Mobile parity:** Look-through and wallet review.

Acceptance: persona 4 surfaces overlap, fee drag and benchmark gap with sources; tier 5 code paths are covered by tests but unreachable in production config; every fee figure links to its source document or assumption.

### Phase 7 — Everyday spending and cash (priority 3) (M)

Detectors (all tier 0 to 3):
- **Subscriptions:** creep, duplicates, price increases (merchant normalisation), yearly total.
- **Idle cash:** daily balance curve rebuilt from the feed (or closes plus ledger); buffer = N months of essential spending; forgone interest at current regulated rates from the registry. Tier 3: "Move €X to savings" (the user does it; Pluclair never moves money).
- **Seasonal provisioning** (12+ months): recurring peaks become a suggested monthly provision charge.
- **Cap suggestions** from category medians (replaces the onboarding cap).
- **Unrecorded leaks:** trend and correlation with cash withdrawals, with a suggestion to log cash spending.
- **Personal inflation:** category spending vs INSEE CPI divisions (documented category mapping).

Acceptance: persona 1 surfaces subscriptions and idle cash; persona 2 surfaces seasonal provisioning; all rates shown with source and effective date.

### Phase 8 — Tax envelopes (priority 4) (M)

- **PEA:** remaining room, PEA-eligible holdings sitting in a CTO (inverse of the existing wrapper check), 5-year date.
- **AV:** contract opening dates, 8-year milestone, yearly allowance on gains.
- **PER:** deduction simulator (marginal tax rate and ceiling, entered or read from the tax notice with opt-in OCR that keeps only the needed fields and discards the document), year-end reminder.
- **LEP:** eligibility check against the income ceiling.
- All parameters per tax year from the registry. Start with tiers 0 to 2; tier 4 and 5 content (e.g. "contribute €X to your PER", "open a PEA") gated behind `insuranceIntermediary` / `cif` and `LEGAL-REVIEW`. Crypto taxation out of scope.

Acceptance: simulations reproduce hand-checked examples for each persona; changing a tax-year parameter in the registry changes results without code changes.

### Phase 9 — Ask Pluclair (M to L)

- Conversational Q&A in EN and FR, web and mobile, with suggested questions.
- Tool calling over whitelisted, read-only core functions: `getSpending(period, category?)`, `compareMonths`, `getGoalStatus`, `runForecast`, `simulateAffordability(amount, date)`, `simulateSaving`, `getHoldingsSummary`, `getFees`, `explainFigure(figureId)`, `listInsights`.
- Numbers only through tool results and placeholders (same validator). Recommendations only by surfacing existing `Recommendation` objects allowed by `canShow`, never generated freely.
- Quotas, clear AI label, conversation history the user can delete.
- Eval set: 50+ golden questions per persona, run before each release.

Acceptance: 100% of numbers in answers trace to tool results on the eval set; refusal behaviour tested for money movement and product-pick requests above the allowed tier.

---

## 7. Human-only track (I do these; you prepare material when asked)

- **H1. Regulatory path for tiers 4 and 5.** Legal opinion on the tier 3/4 boundary. For instrument-level advice: CIF status (ORIAS registration, membership of an AMF-approved association, certification, professional liability insurance, engagement letter and written suitability report) or a partnership with a licensed firm. For AV and PER contract recommendations: insurance intermediary registration. Crypto instrument advice stays excluded (MiCA requires a CASP authorisation). Records retention period.
- **H2. Aggregator choice:** coverage of French banks, neobanks and deferred debit cards; savings and investment coverage; consent duration and renewal; pricing; contract model; sandbox; data residency. Candidates: Powens, Bridge, Linxo Connect, Tink.
- **H3. GDPR:** DPIA (financial data plus profiling), processing register, data processing agreements with the aggregator and Mistral, retention policy, privacy policy and terms updates, AI transparency labels.
- **H4. Brand promises (D6)** on the marketing site, feature pages and onboarding.
- **H5. Business model:** aggregator and AI costs per active user, pricing (free vs premium), quotas.
- **H6. Usability tests:** five users on Phase 2 and Phase 3 prototypes.

---

## 8. Open questions (answer before the phase that needs them)

1. Which aggregator, and does it cover savings and investment accounts? (Phase 1)
2. Keep or delete imported data when a user disconnects a bank: default choice? (Phase 1)
3. Store uploaded PDF statements, or discard after extraction? (Phase 2)
4. Existing users: switch to auto-posted charges by default, or opt-in? (Phase 3)
5. French labels for Recurring and Inside your funds. (Phase 3)
6. Default goal probability target (80%?) and default emergency-fund months (3?). (Phase 5)
7. Default benchmark for the honest comparison. (Phase 6)
8. Analytics tool and consent approach. (Phase 0)

---

## 9. Success metrics (initial targets, to adjust with real data)

| Metric | Initial target |
|---|---|
| Signups reaching a populated Bearing within 24 h | > 70% |
| Median time from signup to populated Bearing (excluding bank auth) | < 3 min |
| Bank connection success rate | > 85% of attempts |
| First Month review completed | > 60% of activated users |
| Second Month review completed | > 45% of activated users |
| Insight action rate | > 15% of insights shown |
| Insights dismissed as "Wrong" | < 5% |
| Forecast P10–P90 coverage (backtest) | 75–85% |
| Narration validator pass rate | > 98%, zero raw numbers shipped |
| AI cost per active user per month | tracked from Phase 0, budget set in H5 |
