# Phase 0, Plan 0.1 — Trust fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four defects that break trust (Calendar edits delete tags, savings goals count one month, income charges cannot be opened, password reset never sets a password), and make the repository's gates real (lint to zero on both apps, the full test suite in CI, an app guide).

**Architecture:** Every figure change lands as a pure function in `packages/core` with tests first, then each client is wired to it. The goal running total reuses the exact counting rule the monthly summary's `current` view already uses, bounded by a new `savings_goals.starts_on` column, so the phone and the server compute identical figures (the month read compares them by digest). Password reset moves to a token-hash confirm route that works from any device, plus a new-password page.

**Tech Stack:** TypeScript 5, Next.js 16.2.9 App Router (`apps/web`), Expo 57 / React Native 0.8x with expo-router and NativeWind (`apps/mobile`), `packages/core` shipped as source to both, Supabase (Postgres + RLS, supabase-js 2.108), zod 4, vitest 3, ESLint with the React Compiler rules.

**Spec:** `docs/superpowers/specs/2026-09-25-phase-0-foundations-design.md` (tasks T0–T4). Parent plan: `docs/plans/PLUCLAIR_UPGRADE_PLAN.md`, Phase 0.

**This is Plan 0.1 of five for Phase 0.** Plan 0.2 (feature flags, tag management), 0.3 (reference registry), 0.4 (AiProvider) and 0.5 (analytics, personas, phase close) follow, each written after the previous one lands.

## Global Constraints

- Domain logic lives in `packages/core` as pure, tested functions; UI layers stay thin.
- Every user-facing string goes through `packages/core/src/i18n/messages/en.ts` and `fr.ts`; `fr.ts` is typed `Messages` (= `typeof en`), so `pnpm --filter @finance/core exec tsc --noEmit` is the parity check. French typography: a no-break space written ` ` before `? ! : ;`.
- On any screen whose behaviour or UI this plan changes, inherited hard-coded English moves into the catalogues too.
- `packages/core/src/i18n/unused-keys.test.ts` fails on a key nobody reads: every new key must be used.
- A new module in `packages/core/src` needs an entry in `packages/core/package.json` `"exports"` before either app can import it.
- `apps/web/DESIGN.md`: dark only; tokens only (no hex, no alpha literals, no arbitrary durations); gold accent only in its four homes; every rendered amount carries `.privacy-amount` / `PrivateAmount`.
- WCAG 2.2 AA: 44 px targets (56 px list rows), visible focus, labelled controls, reduced motion honoured.
- `CONTEXT.md` vocabulary: *recurring template* (never "rule" or "subscription"), *savings goal*, *tag*, *transaction*.
- Migrations are additive and reversible, RLS on every table, and each is executed with `supabase db reset` on a local stack plus an assertion script before it is committed.
- Before writing a Next.js route, page or server action, read the matching guide under `node_modules/next/dist/docs/01-app/` (this Next.js has breaking changes; route handlers: `01-getting-started/15-route-handlers.md`).
- Gates before any task is called done: `pnpm --filter @finance/core exec tsc --noEmit`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter mobile exec tsc --noEmit`, `pnpm --filter @finance/core test`, `pnpm --filter web test`, and (from Task 3 on) both lint commands with `--max-warnings 0`.
- One concern per commit. Commit messages follow the repository's style: a plain sentence saying what changed for the reader, no `feat:` prefix, ending with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Run `npx prettier --write <changed files>` before each commit.
- Work on branch `phase-0-foundations`.

## Review Focus

1. **A goal whose savings are net negative** (withdrawals exceed deposits in an all-savings goal): progress must read 0 %, never a negative bar. Pinned in Task 6.
2. **More than 1,000 rows**: PostgREST caps a response at 1,000 rows (`supabase/config.toml` `max_rows = 1000`), and a goal's history can exceed that. Totals must include every row. Pinned by the `allRows` test in Task 6 and used by both ledger queries in Tasks 7 and 8.
3. **Editing from the Calendar when the user has no tags at all**: the tags control is not rendered, so the save must leave tags untouched. Pinned in Task 4.
4. **A reset link opened after it expired or was already used**: the user lands on `/reset` with a sentence saying so and a form to ask again, not on the sign-in page. Pinned in Task 10.
5. **A month read for a past month**: goal figures stop at that month's end, identically on web and phone, or the stored read looks stale on one of them. Pinned by the `goalTotalsAsOf` test in Task 6 and used in Tasks 7 and 8.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `.github/workflows/ci.yml` | Full core suite, then lint for both apps | 1, 2, 3 |
| `apps/web/.env.local.example` | Truthful comment on what the month read sends | 1 |
| `docs/how-pluclair-works.md` | **Create.** The app guide every phase updates | 1, 12 |
| web lint sites (7 files) | React Compiler rule fixes, no behaviour change | 2 |
| mobile lint sites (13 files) | Same, plus mechanical warnings | 3 |
| `apps/web/lib/actions/tag-field.ts` (+ test) | **Create.** Decides whether a form submission carries tags | 4 |
| `apps/web/lib/actions/finance.ts` | `updateTransaction` replaces tags only when the form carries them | 4 |
| `apps/web/components/finance/TransactionForm.tsx` | Posts the tags marker with the tags control | 4 |
| `apps/web/app/(app)/calendar/page.tsx`, `CalendarView.tsx` | Loads and passes tags | 4 |
| `apps/mobile/src/app/(tabs)/calendar.tsx` | Loads and passes tags | 4 |
| `supabase/migrations/038_goal_start.sql` (+ test) | **Create.** `savings_goals.starts_on` | 5 |
| `packages/core/src/types/database.ts` | `starts_on` on `savings_goals` | 5 |
| `packages/core/src/paging.ts` (+ test) | **Create.** Read every page of a capped query | 6 |
| `packages/core/src/savings-goals.ts` (+ test) | Running totals, as-of date, progress | 6 |
| `packages/core/src/validations/phase4.ts` | `startsOn` on the goal schema | 7 |
| `apps/web/lib/queries/phase4.ts` | `getGoalLedger` | 7 |
| `apps/web/app/(app)/budgets/page.tsx`, `BudgetsView.tsx` | Running totals, start-date field, translated link cards | 7 |
| `apps/web/lib/actions/phase4.ts` | Saves `starts_on` | 7 |
| `apps/web/lib/month-read/facts.ts` | Goal figures as of the month read | 7 |
| `apps/mobile/src/lib/queries.ts`, `mutations.ts` | `getGoalLedger`, `startsOn` | 8 |
| `apps/mobile/src/app/(tabs)/planning.tsx`, `lib/bearing-panel.ts` | Running totals, start-date field | 8 |
| `apps/web/components/finance/RecurringView.tsx` | Income group | 9 |
| `apps/mobile/src/app/(tabs)/recurring.tsx`, `components/RecurringFormModal.tsx` | Income group, income selectable | 9 |
| `apps/web/lib/auth/next-path.ts` (+ test) | **Create.** Safe `next` paths and the confirm redirect | 10 |
| `apps/web/app/auth/confirm/route.ts` | **Create.** Verifies a recovery token hash | 10 |
| `apps/web/app/(auth)/reset/new/page.tsx`, `components/auth/NewPasswordForm.tsx` | **Create.** Choose a new password | 10 |
| `packages/core/src/validations/finance.ts` (+ test) | `newPasswordSchema`, `resetRequestSchema` | 10 |
| `apps/mobile/src/app/(auth)/reset.tsx` | **Create.** Ask for a reset link | 11 |
| `apps/mobile/src/providers/AuthProvider.tsx`, `components/auth/AuthForm.tsx`, `app/(auth)/login.tsx` | Reset request and the "Forgot password?" link | 11 |

---

### Task 1: Housekeeping — full test suite in CI, a truthful env comment, the app guide

**Files:**
- Modify: `.github/workflows/ci.yml:71-90` and `:115-117`
- Modify: `apps/web/.env.local.example:51-54`
- Create: `docs/how-pluclair-works.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/how-pluclair-works.md`, which Task 12 and every later plan update.

- [ ] **Step 1: Confirm the excluded test passes on its own**

Run: `pnpm --filter @finance/core exec vitest run src/still-to-come.test.ts`
Expected: `Tests  12 passed (12)`.

- [ ] **Step 2: Run the test step without the exclusion in CI**

In `.github/workflows/ci.yml`, replace the comment block that starts `# Test suite, with one known-failing file excluded.` and the step under it:

```yaml
      # ---------------------------------------------------------------
      # Test suite, with one known-failing file excluded.
      ...
      # ---------------------------------------------------------------
      - name: Test (packages/core, with still-to-come.test.ts excluded)
        run: pnpm --filter @finance/core exec vitest run --exclude '**/still-to-come.test.ts'
```

with:

```yaml
      - name: Test (packages/core)
        run: pnpm --filter @finance/core test
```

and delete item 3 from the trailing `# Gates NOT run by this workflow` comment (the three lines starting `# 3. The one excluded test file`). Change that comment's closing paragraph, `# None of these are fixed here: this workflow only wires up gates that already pass, plus the test suite minus its one known-failing file, so`, to:

```yaml
# None of these are fixed here: this workflow only wires up gates that
# already pass, so CI is green from its first run instead of training
# everyone to ignore a red badge.
```

- [ ] **Step 3: Run the full core suite exactly as CI now will**

Run: `pnpm --filter @finance/core test`
Expected: every file passes, including `still-to-come.test.ts`.

- [ ] **Step 4: Correct the env comment**

In `apps/web/.env.local.example`, replace:

```
# numbers by name and the app substitutes them, so nothing it invents can
# reach the screen. Aggregates go over the wire — category totals, the
# reconciliation figures — never merchants, individual payments or balances.
```

with:

```
# numbers by name and the app substitutes them, so nothing it invents can
# reach the screen. Aggregates go over the wire — category totals, the
# reconciliation figures, and for the month in progress the total the
# day-to-day accounts hold — never merchants or individual payments.
```

- [ ] **Step 5: Write the app guide**

Create `docs/how-pluclair-works.md` with exactly this content:

````markdown
# How Pluclair works

The working guide to the app as it is today: what each part is, where each
figure is computed, and what is known to be wrong. Written for whoever works
on the repository next, human or agent. Every phase of
`docs/plans/PLUCLAIR_UPGRADE_PLAN.md` updates it before it closes.

Last updated: Phase 0, Plan 0.1 (2026-09-25).

## Shape

| Part | What it is |
|---|---|
| `apps/web` | Next.js 16.2 App Router. Server components read Supabase with the user's cookie session; server actions write. |
| `apps/mobile` | Expo 57 with expo-router and NativeWind, dark only. Reads and writes Supabase directly under RLS; calls the web app for the month read (`POST /api/month-read`) and a bank refresh (`POST /api/bank/refresh`) with a bearer token. |
| `packages/core` | Pure TypeScript shared by both apps and shipped to them as source: every calculation, every zod schema, every string (`src/i18n/messages/en.ts`, `fr.ts`). |
| `supabase/` | Migrations `001`–`038`, assertion scripts in `tests/`, one edge function (`delete-account`). |

Vocabulary is fixed by `CONTEXT.md`; product commitments by
`apps/web/PRODUCT.md`; visual rules by `apps/web/DESIGN.md` and
`apps/mobile/DESIGN.md`.

## Sections

| Section | Web route | Phone screen |
|---|---|---|
| Bearing | `/bearing` | `(tabs)/index` |
| Ledger — list | `/transactions` | `(tabs)/transactions` |
| Ledger — calendar | `/calendar` | `(tabs)/calendar` |
| Ledger — by category | `/history` | none |
| Charges | `/recurring` | `(tabs)/recurring` |
| Plan | `/budgets` | `(tabs)/planning` |
| Wallets — positions | `/investments` | `(tabs)/investments` |
| Wallets — look-through | `/investments/look-through` | none |
| Categories | `/categories` | `categories` |
| Import (CSV) | `/import` | `import` |
| Welcome | `/welcome` | `onboarding` |
| Profile | `/profile` | `(tabs)/profile` |
| Sign in, sign up | `/login`, `/signup` | `(auth)/login`, `(auth)/signup` |
| Password reset | `/reset`, `/auth/confirm`, `/reset/new` | `(auth)/reset` (the new password is set on the web page the email opens) |

## Where each figure is computed

| Figure | Core module |
|---|---|
| Monthly summary and its `current` / `month_end` views | `monthly-summary.ts`, `budget.ts` |
| Month close, Kept, Unrecorded spending | `month-close.ts` (closes in `month_closes`; reading day in `month_close_settings.close_day`, default 5) |
| Forward projection, runway | `projection.ts` |
| Bearing cards and tiles | `bearing-cards.ts`, `bearing-tiles.ts`, `bearing-facts.ts` |
| Savings goal progress | `savings-goals.ts` — a running total from the goal's `starts_on` to today, by the same counting rule as the monthly summary's `current` view |
| Spending caps | `budget-limits.ts` |
| Category findings | `category-findings.ts` |
| PEA ceiling and five-year date | `pea.ts` |
| Fund costs, look-through, target trades | `fund-costs.ts`, `look-through.ts`, `look-through-target.ts` |
| Money-weighted return | `xirr.ts`, `investment-returns.ts` |

## AI features

Mistral, called only from the web server (the phone goes through
`/api/month-read`). The model never writes a figure: it names a fact by id and
the app substitutes its own value; `verify*` functions in core reject or trim
anything else. One model for every feature (`MISTRAL_MODEL`, else
`mistral-medium-latest`).

| Feature | Web entry | Quota |
|---|---|---|
| Month read | `lib/month-read/` | 5 per month written about |
| Category read | `lib/category-read/` | 10 per calendar month |
| Finding ordering | `lib/category-selection/` | 5 per calendar month |
| Wallet read | `lib/wallet-read/` | 5 per calendar month, refused when nothing changed |
| Instrument reading (web search, then transcription) | `lib/instrument-reading/`, nightly cron | 40 per calendar month |

What goes over the wire: aggregates and names the user typed (category,
budget, goal and holding names), the month's category totals, and for the
month in progress the total the day-to-day accounts hold. Never merchants or
individual payments. Instrument reading sends the name, symbol and ISIN of a
held instrument.

## Bank feed

Built and reachable by one account per deployment: the one whose id is
`OPEN_BANKING_OWNER_USER_ID` (`apps/web/lib/bank/client.ts`). Everyone else
enters balances and transactions by hand or imports a CSV. Rows the matcher
would not file wait in the review inbox at `?review=inbox`.

## Gates

```
pnpm --filter @finance/core exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter mobile exec expo customize tsconfig.json && pnpm --filter mobile exec tsc --noEmit
pnpm --filter @finance/core test
pnpm --filter web test
pnpm --filter web exec eslint --max-warnings 0 .
pnpm --filter mobile exec expo lint --max-warnings 0
pnpm check:reachability
```

Migrations: `npx supabase start`, `npx supabase db reset`, then
`docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/<n>.test.sql`.

## Known issues

- Editing a transaction from the web Calendar deletes its tags (fixed in Plan 0.1, Task 4).
- A savings goal counts only the current month's savings (fixed in Plan 0.1, Tasks 5–8).
- Income recurring templates cannot be opened from Charges (fixed in Plan 0.1, Task 9).
- Password reset signs the user in without asking for a new password; the phone has no reset (fixed in Plan 0.1, Tasks 10–11).
- `writesAFigure` (`packages/core/src/month-read.ts`) knows English number words only; a French spelled-out quantity would pass. Digits are always caught.
- The Wallets page's fund-cost card and the look-through page can show different annual costs: only the look-through falls back to the shortlist's charge hints.
- `packages/core/src/types/database.ts` is maintained by hand and does not list `deleted_at` (migration `036`).
- Dead schema: `user_preferences.bearing_pins` and the `bearing_arrangements` table have no readers.
- The `delete-account` edge function deletes a fixed list of older tables and relies on `on delete cascade` for the rest.
- The phone has no By category view, no look-through and no wallet read.
````

- [ ] **Step 6: Commit**

```bash
npx prettier --write .github/workflows/ci.yml docs/how-pluclair-works.md
git add .github/workflows/ci.yml apps/web/.env.local.example docs/how-pluclair-works.md
git commit -m "$(cat <<'EOF'
Run every core test in CI, and write down how the app works

still-to-come.test.ts has passed since 20 September, so the exclusion that
kept it out of CI now only hid it. The env example claimed balances never
reach Mistral; the month read sends the day-to-day accounts' total for the
month in progress, and the comment now says so. docs/how-pluclair-works.md is
the guide each phase of the upgrade plan keeps current.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Web lint to zero, gated in CI

**Files:**
- Modify: `apps/web/app/(app)/budgets/BudgetsView.tsx:3,115-163`
- Modify: `apps/web/components/finance/ApplyRecurringSheet.tsx:3,106-123`
- Modify: `apps/web/components/finance/RecurringView.tsx:293-310,473`
- Modify: `apps/web/components/finance/TransactionsView.tsx:262-264`
- Modify: `apps/web/components/layout/AccountMenu.tsx`
- Modify: `apps/web/components/finance/InstrumentLogo.tsx:41`, `apps/web/components/magicui/safari.tsx:78`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: no API change. `RecurringView` now keeps `tabOverride` state (Task 9 extends its type).

- [ ] **Step 1: Record the failing baseline**

Run: `pnpm --filter web exec eslint --max-warnings 0 .`
Expected: FAIL, `11 problems (9 errors, 2 warnings)` in the seven files above.

- [ ] **Step 2: Plan page — react to action results inside the actions**

In `apps/web/app/(app)/budgets/BudgetsView.tsx`, add below the imports:

```tsx
type PlanActionResult = { error?: string; success?: boolean };
```

Replace the three `useActionState` calls (lines 115–123):

```tsx
  const [budgetState, budgetAction, budgetPending] = useActionState(
    upsertBudget,
    {},
  );
  const [goalState, goalAction, goalPending] = useActionState(
    upsertSavingsGoal,
    {},
  );
  const [tagState, tagAction, tagPending] = useActionState(upsertTag, {});
```

with actions that react to their own result, so nothing has to watch the state in an effect:

```tsx
  // Each action says what happened itself, once, when it returns. The three
  // effects that used to watch the returned state set state inside an
  // effect, which re-rendered the page a second time for every save.
  const [, budgetAction, budgetPending] = useActionState(
    async (previous: PlanActionResult, formData: FormData) => {
      const result = await upsertBudget(previous, formData);
      if (result.success) {
        toast(t("plan.capSaved"), "success");
        setEditingBudget(null);
        setBudgetFormOpen(false);
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );
  const [, goalAction, goalPending] = useActionState(
    async (previous: PlanActionResult, formData: FormData) => {
      const result = await upsertSavingsGoal(previous, formData);
      if (result.success) {
        toast(t("plan.goalSaved"), "success");
        setEditingGoal(null);
        setGoalFormOpen(false);
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );
  const [, tagAction, tagPending] = useActionState(
    async (previous: PlanActionResult, formData: FormData) => {
      const result = await upsertTag(previous, formData);
      if (result.success) {
        toast(t("plan.tagAdded"), "success");
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );
```

Delete the three `useEffect` blocks that watched `budgetState`, `goalState` and `tagState`. Run `grep -n useEffect "apps/web/app/(app)/budgets/BudgetsView.tsx"`; if only the import line remains, remove `useEffect` from the `react` import.

The `useState` calls for `editingBudget`, `editingGoal`, `budgetFormOpen` and `goalFormOpen` are declared after the `useActionState` calls. Move those four `useState` lines above the first `useActionState` so the actions close over declared setters.

- [ ] **Step 3: Apply sheet — remember deselection against the list it was made on**

In `apps/web/components/finance/ApplyRecurringSheet.tsx`, add at module level (below the imports):

```tsx
const NOTHING_DESELECTED: ReadonlySet<string> = new Set();
```

Replace:

```tsx
  // Everything starts selected; deselecting is the exception.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDeselected(new Set());
  }, [allKeys]);

  const isSelected = (key: string) => !deselected.has(key);
  const toggle = (key: string) =>
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
```

with:

```tsx
  // Everything starts selected; deselecting is the exception. The choice is
  // remembered against the list it was made on, so a new plan starts fully
  // selected by derivation rather than through an effect that clears it.
  const [deselection, setDeselection] = useState<{
    keys: string[];
    off: ReadonlySet<string>;
  }>({ keys: allKeys, off: NOTHING_DESELECTED });
  const deselected =
    deselection.keys === allKeys ? deselection.off : NOTHING_DESELECTED;

  const isSelected = (key: string) => !deselected.has(key);
  const toggle = (key: string) =>
    setDeselection((current) => {
      const next = new Set(
        current.keys === allKeys ? current.off : NOTHING_DESELECTED,
      );
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { keys: allKeys, off: next };
    });
```

Remove `useEffect` from the `react` import if `grep -n useEffect` shows no other use.

- [ ] **Step 4: Charges — derive the tab, and fetch the Apply count in the effect's callback**

In `apps/web/components/finance/RecurringView.tsx`, replace:

```tsx
  const [activeTab, setActiveTab] = useState<AllocType>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
```

with (the phone's `recurring.tsx` already does exactly this):

```tsx
  // Derived rather than synced through an effect: the tab follows the first
  // non-empty group until the user picks one, as on the phone.
  const [tabOverride, setTabOverride] = useState<AllocType | null>(null);
  const activeTab = tabOverride ?? defaultTab;
```

and change the toggle button's `onClick={() => setActiveTab(type)}` to `onClick={() => setTabOverride(type)}`.

Replace:

```tsx
  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, templates]);
```

with:

```tsx
  // Asked again whenever the templates change. The answer is set in the
  // promise's callback, so the effect itself never sets state.
  useEffect(() => {
    let cancelled = false;
    void previewApplyRecurringForMonth(year, month).then((result) => {
      if (cancelled || result.error || !result.plan) {
        return;
      }
      const counts = applyRecurringPlanCounts(result.plan);
      setApplyPending(counts.creates + counts.updates > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [month, year, templates]);
```

Keep `refreshApplyPending`: the handler at line 347 still calls it after an apply.

- [ ] **Step 5: Ledger list — the same Apply-count effect**

In `apps/web/components/finance/TransactionsView.tsx`, replace:

```tsx
  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, transactions]);
```

with:

```tsx
  // Asked again whenever the month's transactions change. The answer is set
  // in the promise's callback, so the effect itself never sets state.
  useEffect(() => {
    let cancelled = false;
    void previewApplyRecurringForMonth(year, month).then((result) => {
      if (cancelled || result.error || !result.plan) {
        return;
      }
      const counts = applyRecurringPlanCounts(result.plan);
      setApplyPending(counts.creates + counts.updates > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [month, year, transactions]);
```

Keep `refreshApplyPending` for its call at line 371.

- [ ] **Step 6: Account menu — derive "open" and "mounted", measure on press**

In `apps/web/components/layout/AccountMenu.tsx`:

Change the React import to:

```tsx
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
```

Add above `export function AccountMenu`:

```tsx
/** Nothing to subscribe to: the answer only differs between server and client. */
function subscribeToNothing() {
  return () => {};
}
```

Replace:

```tsx
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
```

with:

```tsx
  // The page the menu was opened on. Open only while still on that page, so
  // navigating closes it by derivation rather than through an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  // Measured when the menu opens, in the press handler, because reading the
  // trigger's box during render reads a ref during render.
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>();
  // False on the server and during hydration, true after: the portal needs
  // `document.body`, which only exists on the client.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  function toggle() {
    if (open) {
      setOpenAt(null);
      return;
    }
    setPanelStyle(
      variant === "side" ? sidePanelStyle(triggerRef.current) : undefined,
    );
    setOpenAt(pathname);
  }
```

Delete both effects:

```tsx
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
```

Replace every remaining `setOpen(false)` in the file (the Escape handler, the `close` resize handler, the backdrop button, the two `Link` rows) with `setOpenAt(null)`. Replace both `onClick={() => setOpen((value) => !value)}` with `onClick={toggle}`. Replace:

```tsx
              style={
                variant === "side"
                  ? sidePanelStyle(triggerRef.current)
                  : undefined
              }
```

with `style={panelStyle}`.

Run: `grep -n "setOpen\b\|setMounted" apps/web/components/layout/AccountMenu.tsx`
Expected: no output.

- [ ] **Step 7: Say why two `<img>` elements stay**

In `apps/web/components/finance/InstrumentLogo.tsx`, directly above `<img` (line 42), replace the comment line `{/* External brand marks 404 often; img + onError is the fallback path. */}` with:

```tsx
      {/* External brand marks 404 often; img + onError is the fallback path.
          next/image would need every logo host allow-listed and cannot fall
          back when one fails. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
```

In `apps/web/components/magicui/safari.tsx`, directly above `<img` (line 79), add:

```tsx
          {/* eslint-disable-next-line @next/next/no-img-element -- vendored
              marketing frame; the screenshot inside is decorative and sized
              by its container, which next/image cannot do without fixed
              dimensions */}
```

- [ ] **Step 8: Lint and typecheck pass**

Run: `pnpm --filter web exec eslint --max-warnings 0 .`
Expected: exit 0, no output.
Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Check behaviour in the browser**

Start the dev server bound to all interfaces: `pnpm --filter web exec next dev -H 0.0.0.0` and open `http://$(hostname -I | awk '{print $1}'):3000`. Verify, signed in:
- The account menu opens from the sidebar above its trigger, closes on Escape, on the backdrop, on resizing, and on navigating to another page.
- Plan: saving a cap, a goal and a tag each shows one toast and closes its form.
- Charges on a phone-width window: the kind toggles switch the list, and the first non-empty kind is selected on load.
- Ledger: the Apply button's pending state matches the month.

- [ ] **Step 10: Gate CI on web lint**

In `.github/workflows/ci.yml`, after the `Typecheck web` step, add:

```yaml
      - name: Lint web
        run: pnpm --filter web exec eslint --max-warnings 0 .
```

and delete item 1 (`# 1. \`pnpm --filter web lint\`` and its lines) from the `# Gates NOT run by this workflow` comment.

- [ ] **Step 11: Commit**

```bash
npx prettier --write "apps/web/app/(app)/budgets/BudgetsView.tsx" apps/web/components/finance/ApplyRecurringSheet.tsx apps/web/components/finance/RecurringView.tsx apps/web/components/finance/TransactionsView.tsx apps/web/components/layout/AccountMenu.tsx apps/web/components/finance/InstrumentLogo.tsx apps/web/components/magicui/safari.tsx .github/workflows/ci.yml
git add -A apps/web .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
Get web lint to zero and keep it there

Nine React Compiler findings, each a state change made inside an effect or a
ref read during render: the Plan page's action results, the apply sheet's
deselection, the Charges tab, two Apply counts and the account menu. Each is
now derived or set in a callback, with no visible change. The two <img>
elements say why they are not next/image. CI runs lint with no warnings
allowed.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Mobile lint to zero, gated in CI

**Files:**
- Modify: `apps/mobile/src/hooks/useRefreshable.ts`
- Modify: `apps/mobile/src/providers/BiometricLockProvider.tsx:46-80`
- Modify: `apps/mobile/src/providers/QuickAddProvider.tsx:119,139,142`
- Modify: `apps/mobile/src/components/ui/Button.tsx:90,108,111`
- Modify: `apps/mobile/src/components/profile/SecurityCards.tsx:34-36`
- Modify: `apps/mobile/src/app/(tabs)/recurring.tsx:112-126`
- Modify: `apps/mobile/src/app/(tabs)/transactions.tsx:266-268`
- Modify: `apps/mobile/src/app/(tabs)/calendar.tsx:125-127`
- Modify: `apps/mobile/src/app/onboarding.tsx:68`
- Modify: `apps/mobile/src/lib/queries.ts:20,82-83`, `apps/mobile/src/lib/mutations.ts:61-69`, `apps/mobile/src/lib/cn.ts:6`, `apps/mobile/src/providers/LocaleProvider.tsx:10`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `useRefreshable(loader, deps)` keeps its exact signature and return shape; `reload` becomes stable across renders.

- [ ] **Step 1: Record the failing baseline**

Run: `pnpm --filter mobile exec expo lint --max-warnings 0`
Expected: FAIL, `42 problems (11 errors, 31 warnings)`.

- [ ] **Step 2: `useRefreshable` — latest-loader ref, loading derived from a settled key**

Replace the body of `apps/mobile/src/hooks/useRefreshable.ts` from `export function useRefreshable<T>(` down to (not including) `function onRefresh()` with:

```ts
export function useRefreshable<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Re-read this screen's own data. For after a write. */
  onRefresh: () => void;
  /** Re-read, and ask the bank too. For the drag-down gesture. */
  onRefreshAll: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Every call site passes primitives (ids, a year, a month, a data version),
  // so their JSON is a faithful key for "the inputs changed".
  const depsKey = JSON.stringify(deps);
  // The key of the last load that finished. Loading is simply "the current
  // inputs have not finished loading yet", derived rather than flipped in an
  // effect.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== depsKey;
  // Null on the auth and onboarding screens, which render outside the
  // provider. There the gesture is a re-read and nothing more, which is all
  // it can be before anyone is signed in.
  const refreshAll = useRefreshAll();

  // The latest loader, read at call time. Declared before the load effect so
  // it has already been updated when that effect runs.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    try {
      const next = await loaderRef.current();
      setError(null);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loaderRef
      .current()
      .then(
        (next) => {
          if (!cancelled) {
            setError(null);
            setData(next);
          }
        },
        (err: unknown) => {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Something went wrong",
            );
          }
        },
      )
      .finally(() => {
        if (!cancelled) {
          setSettledKey(depsKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [depsKey]);
```

Change the file's first line to `import { useCallback, useEffect, useRef, useState } from "react";`.

This keeps the previous month's data on screen while the next month loads (as before), and a load that is overtaken by a newer one no longer overwrites it.

- [ ] **Step 3: Biometric lock — adjust state during render instead of in effects**

In `apps/mobile/src/providers/BiometricLockProvider.tsx`, delete `const restoredRef = useRef(false);` and replace the two effects:

```tsx
  useEffect(() => {
    if (!session) {
      setLocked(false);
    }
  }, [session]);

  useEffect(() => {
    if (initializing || !ready || restoredRef.current) {
      return;
    }
    restoredRef.current = true;
    if (session && enabled && hardware && enrolled) {
      setLocked(true);
    }
  }, [initializing, ready, session, enabled, hardware, enrolled]);
```

with:

```tsx
  // Signing out unlocks. Adjusted while rendering, the pattern React
  // documents for "reset state when an input changes", instead of an effect
  // that renders twice.
  const [previousSession, setPreviousSession] = useState(session);
  if (session !== previousSession) {
    setPreviousSession(session);
    if (!session) {
      setLocked(false);
    }
  }

  // Lock once at launch, as soon as everything the decision needs is known.
  const [restored, setRestored] = useState(false);
  if (!restored && !initializing && ready) {
    setRestored(true);
    if (session && enabled && hardware && enrolled) {
      setLocked(true);
    }
  }
```

Run: `grep -n "restoredRef" apps/mobile/src/providers/BiometricLockProvider.tsx`
Expected: no output. `useRef` stays imported (`appStateRef`, `autoPromptedRef`).

- [ ] **Step 4: Reanimated shared values — `get()` and `set()`**

Reanimated 4.5 exposes `get()`/`set()` on shared values for React Compiler compatibility.

In `apps/mobile/src/components/ui/Button.tsx` replace `transform: [{ scale: scale.value }],` with `transform: [{ scale: scale.get() }],`, `scale.value = withTiming(0.98, { duration: DURATION.press });` with `scale.set(withTiming(0.98, { duration: DURATION.press }));`, and `scale.value = withTiming(1, { duration: DURATION.press });` with `scale.set(withTiming(1, { duration: DURATION.press }));`.

In `apps/mobile/src/providers/QuickAddProvider.tsx` make the same three replacements, with `0.92` in place of `0.98`.

- [ ] **Step 5: Passkeys panel — first load in the effect's callback**

In `apps/mobile/src/components/profile/SecurityCards.tsx` replace:

```tsx
  useEffect(() => {
    void refresh();
  }, [refresh]);
```

with:

```tsx
  // The first read sets state in the promise's callback, so the effect itself
  // never does. `refresh` stays for after an add or a delete.
  useEffect(() => {
    let cancelled = false;
    void listPasskeys().then((result) => {
      if (cancelled) {
        return;
      }
      setPasskeys(result.passkeys);
      if (result.error) {
        setMessage(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
```

- [ ] **Step 6: Charges and Ledger — stable arrays and the Apply-count effect**

In `apps/mobile/src/app/(tabs)/recurring.tsx` replace:

```tsx
  const templates = data?.templates ?? [];
  const categories = data?.categories ?? [];
```

with:

```tsx
  // Memoised so a render without new data keeps the same arrays, and the
  // memos and effects below do not re-run for nothing.
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);
  const categories = useMemo(
    () => data?.categories ?? [],
    [data?.categories],
  );
```

and replace:

```tsx
  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, templates]);
```

with:

```tsx
  // Asked again whenever the templates change. The answer is set in the
  // promise's callback, so the effect itself never sets state.
  useEffect(() => {
    let cancelled = false;
    void previewApplyRecurringForMonth(year, month).then((result) => {
      if (cancelled || result.error || !result.plan) {
        return;
      }
      const counts = applyRecurringPlanCounts(result.plan);
      setApplyPending(counts.creates + counts.updates > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [month, year, templates]);
```

Keep `refreshApplyPending`: the apply handlers at lines 446 and 472 still await it.

In `apps/mobile/src/app/(tabs)/transactions.tsx` replace the effect `useEffect(() => { void refreshApplyPending(); }, [refreshApplyPending, transactions]);` with the same effect body, with dependencies `[month, year, transactions]`. Keep its `refreshApplyPending` too, for lines 467 and 512.

- [ ] **Step 7: Calendar and onboarding — stable arrays**

In `apps/mobile/src/app/(tabs)/calendar.tsx` replace:

```tsx
  const transactions = data?.transactions ?? [];
  const categories = data?.categories ?? [];
  const templates = data?.templates ?? [];
```

with:

```tsx
  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions],
  );
  const categories = useMemo(
    () => data?.categories ?? [],
    [data?.categories],
  );
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);
```

In `apps/mobile/src/app/onboarding.tsx` replace `const categories = data?.categories ?? [];` with:

```tsx
  const categories = useMemo(
    () => data?.categories ?? [],
    [data?.categories],
  );
```

- [ ] **Step 8: Mechanical warnings**

- `apps/mobile/src/lib/queries.ts`: move the line `export type { MonthlyTrendPoint };` (line 20) to directly below the last import (`import { supabase } from "@/lib/supabase";`). Merge the two lines:

```ts
import type { InvestmentPositionRow } from "@finance/core/investment-positions";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
```

into:

```ts
import type {
  InvestmentPortfolioSummary,
  InvestmentPositionRow,
} from "@finance/core/investment-positions";
```

- `apps/mobile/src/lib/mutations.ts`: delete `import type { WalletId } from "@finance/core/types/database";` and add `WalletId,` to the `import type { CategoryType, Database, RecurringTemplateWithCategory, } from "@finance/core/types/database";` list above it.
- `apps/mobile/src/lib/cn.ts`: change `...classes: Array<string | false | null | undefined>` to `...classes: (string | false | null | undefined)[]`.
- `apps/mobile/src/providers/LocaleProvider.tsx`: change `import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";` to `import { type Locale } from "@finance/core/i18n/locale";`.

- [ ] **Step 9: Lint and typecheck pass**

Run: `pnpm --filter mobile exec expo lint --max-warnings 0`
Expected: exit 0.
Run: `pnpm --filter mobile exec expo customize tsconfig.json && pnpm --filter mobile exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 10: Check behaviour on a phone**

Start Metro with `pnpm dev:mobile` and open the app in Expo Go or a dev build. Verify:
- Every tab loads on first open and after changing month. The previous month stays on screen until the next one arrives.
- Pull to refresh spins and settles.
- With biometric unlock on: backgrounding and returning locks, launching locks once, signing out unlocks.
- Buttons and the quick-add button still shrink on press.
- Profile → Security lists passkeys.

- [ ] **Step 11: Gate CI on mobile lint**

In `.github/workflows/ci.yml`, after the `Typecheck mobile` step, add:

```yaml
      - name: Lint mobile
        run: pnpm --filter mobile exec expo lint --max-warnings 0
```

Delete the now-empty `# Gates NOT run by this workflow` comment block entirely.

- [ ] **Step 12: Commit**

```bash
npx prettier --write apps/mobile/src/hooks/useRefreshable.ts apps/mobile/src/providers/BiometricLockProvider.tsx apps/mobile/src/providers/QuickAddProvider.tsx apps/mobile/src/components/ui/Button.tsx apps/mobile/src/components/profile/SecurityCards.tsx "apps/mobile/src/app/(tabs)/recurring.tsx" "apps/mobile/src/app/(tabs)/transactions.tsx" "apps/mobile/src/app/(tabs)/calendar.tsx" apps/mobile/src/app/onboarding.tsx apps/mobile/src/lib/queries.ts apps/mobile/src/lib/mutations.ts apps/mobile/src/lib/cn.ts apps/mobile/src/providers/LocaleProvider.tsx .github/workflows/ci.yml
git add -A apps/mobile/src .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
Get phone lint to zero and keep it there

The data hook every screen uses now derives "loading" from the inputs it last
finished, and reads the latest loader through a ref, so its dependency list
is a literal and a stale load cannot overwrite a newer one. The biometric
lock adjusts state while rendering, shared values use get and set, and the
rest are import order and duplicate imports. CI runs phone lint with no
warnings allowed.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Editing from the Calendar keeps tags

**Files:**
- Create: `apps/web/lib/actions/tag-field.ts`
- Test: `apps/web/lib/actions/tag-field.test.ts`
- Modify: `apps/web/lib/actions/finance.ts:483-536`
- Modify: `apps/web/components/finance/TransactionForm.tsx:236-256`
- Modify: `apps/web/app/(app)/calendar/page.tsx`
- Modify: `apps/web/components/finance/CalendarView.tsx:45-76,519-537`
- Modify: `apps/mobile/src/app/(tabs)/calendar.tsx`

**Interfaces:**
- Consumes: `getTags(userId): Promise<Tag[]>` and `getTransactionTagMap(userId, year, month): Promise<Record<string, Tag[]>>` from `apps/web/lib/queries/phase4.ts`; mobile `getTags(userId)` from `apps/mobile/src/lib/queries.ts`.
- Produces: `TAGS_FIELD_MARKER: "tagsField"` and `readSubmittedTagIds(formData: FormData): string[] | null` from `apps/web/lib/actions/tag-field.ts`. `CalendarView` gains required props `tags: Tag[]` and `transactionTags: Record<string, Tag[]>`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/actions/tag-field.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readSubmittedTagIds, TAGS_FIELD_MARKER } from "./tag-field";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) {
    data.append(key, value);
  }
  return data;
}

describe("readSubmittedTagIds", () => {
  it("returns null when the form never showed the tags control", () => {
    // The Calendar's form, or any form for a user with no tags: no marker,
    // so the save must leave the transaction's tags alone.
    expect(readSubmittedTagIds(form([["amount", "12"]]))).toBeNull();
  });

  it("ignores stray tag ids when the marker is missing", () => {
    expect(readSubmittedTagIds(form([["tagIds", "t-1"]]))).toBeNull();
  });

  it("returns an empty list when the control was shown and nothing is ticked", () => {
    expect(readSubmittedTagIds(form([[TAGS_FIELD_MARKER, "1"]]))).toEqual([]);
  });

  it("returns every ticked tag when the control was shown", () => {
    expect(
      readSubmittedTagIds(
        form([
          [TAGS_FIELD_MARKER, "1"],
          ["tagIds", "t-1"],
          ["tagIds", "t-2"],
        ]),
      ),
    ).toEqual(["t-1", "t-2"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter web exec vitest run lib/actions/tag-field.test.ts`
Expected: FAIL, `Failed to resolve import "./tag-field"`.

- [ ] **Step 3: Implement**

Create `apps/web/lib/actions/tag-field.ts`:

```ts
/**
 * Whether a transaction form carried its tags, and which.
 *
 * A form that never rendered the tags control posts no `tagIds`, which reads
 * exactly like "every box unticked". The edit action used to take it that
 * way and deleted every tag on the transaction — which is what editing from
 * the Calendar did, because the Calendar's form was never given the tags.
 * The marker is posted alongside the control, so its absence means "not
 * asked", never "none".
 *
 * Not in `finance.ts`: that file is `"use server"`, where every export must
 * be an async action.
 */
export const TAGS_FIELD_MARKER = "tagsField";

export function readSubmittedTagIds(formData: FormData): string[] | null {
  if (formData.get(TAGS_FIELD_MARKER) === null) {
    return null;
  }
  return formData
    .getAll("tagIds")
    .filter((value): value is string => typeof value === "string");
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm --filter web exec vitest run lib/actions/tag-field.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: The edit action replaces tags only when they were submitted**

In `apps/web/lib/actions/finance.ts` add to the imports:

```ts
import { readSubmittedTagIds } from "@/lib/actions/tag-field";
```

In `updateTransaction`, replace:

```ts
  const tagIds = formData
    .getAll("tagIds")
    .filter((value): value is string => typeof value === "string");
```

with:

```ts
  // Null when the form never showed the tags control: leave them alone.
  const tagIds = readSubmittedTagIds(formData);
```

and replace the block from `await supabase.from("transaction_tags").delete()` through the closing `}` of `if (tagIds.length > 0) { … }` with:

```ts
  if (tagIds !== null) {
    const { error: clearError } = await supabase
      .from("transaction_tags")
      .delete()
      .eq("transaction_id", parsed.data.id);
    if (clearError) {
      return { error: clearError.message };
    }

    if (tagIds.length > 0) {
      const { error: tagError } = await supabase
        .from("transaction_tags")
        .insert(
          tagIds.map((tagId) => ({
            transaction_id: parsed.data.id,
            tag_id: tagId,
          })),
        );
      if (tagError) {
        return { error: tagError.message };
      }
    }
  }
```

- [ ] **Step 6: The form posts the marker with the control**

In `apps/web/components/finance/TransactionForm.tsx` add `import { TAGS_FIELD_MARKER } from "@/lib/actions/tag-field";`. Inside `{tags.length > 0 && (` … `<fieldset className="flex flex-col gap-2">`, add as the fieldset's first child:

```tsx
            {/* Says "the tags were on screen", so an empty selection means
                none rather than "not asked". */}
            <input type="hidden" name={TAGS_FIELD_MARKER} value="1" />
```

- [ ] **Step 7: The Calendar page loads tags**

In `apps/web/app/(app)/calendar/page.tsx` add `import { getTags, getTransactionTagMap } from "@/lib/queries/phase4";`, and extend the batch:

```tsx
  const [
    transactions,
    categories,
    recurringTemplates,
    confirmedTransactionIds,
    tags,
    transactionTags,
  ] = await Promise.all([
    getTransactions(user.id, year, month),
    getCategories(user.id),
    getRecurringTemplates(user.id),
    // Which rows settle a recurring charge. Needs nothing else this batch
    // fetches, so it rides along rather than costing a second round trip.
    getConfirmedTransactionIds(user.id),
    // The edit form needs them, or saving an edit from here cannot show,
    // keep or change a transaction's tags.
    getTags(user.id),
    getTransactionTagMap(user.id, year, month),
  ]);
```

and pass `tags={tags}` and `transactionTags={transactionTags}` to `<CalendarView`.

- [ ] **Step 8: The Calendar passes them to both forms**

In `apps/web/components/finance/CalendarView.tsx` add `Tag` to the `import type { … } from "@finance/core/types/database";` list; add to `CalendarViewProps`:

```tsx
  tags: Tag[];
  /** Each transaction's tags, by transaction id, for this month. */
  transactionTags: Record<string, Tag[]>;
```

and to the destructured props. Replace the two forms at the bottom with:

```tsx
      <TransactionForm
        categories={categories}
        tags={tags}
        defaultDate={selectedDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <TransactionForm
        categories={categories}
        tags={tags}
        selectedTagIds={
          editTransaction
            ? (transactionTags[editTransaction.id] ?? []).map((tag) => tag.id)
            : []
        }
        defaultDate={selectedDate}
        open={editTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTransaction(null);
          }
        }}
        transaction={editTransaction}
      />
```

Duplicate now keeps tags too: `handleDuplicate` sends `selectedTagIds`, which the Calendar now fills.

- [ ] **Step 9: The phone's calendar passes tags to its form**

In `apps/mobile/src/app/(tabs)/calendar.tsx`: add `getTags,` to the `@/lib/queries` import and `Tag,` to the `@finance/core/types/database` type import; add at module level `const NO_TAGS: Tag[] = [];`. In the loader, add `tags: [] as Tag[],` to the signed-out object, change the batch to:

```tsx
      const [transactions, categories, templates, confirmed, tags] =
        await Promise.all([
          getTransactions(user.id, year, month),
          getCategories(user.id),
          getRecurringTemplates(user.id),
          // Which rows settle a charge. Needs nothing else the batch fetches,
          // so it rides along rather than costing a second hop.
          getConfirmedTransactionIds(user.id),
          // So a transaction's tags can be changed from here, as on the web.
          getTags(user.id),
        ]);
```

and add `tags` to the returned object. Pass `tags={data?.tags ?? NO_TAGS}` to both `<TransactionFormModal`.

- [ ] **Step 10: Typecheck, lint, test**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint --max-warnings 0 . && pnpm --filter web test`
Expected: all pass.
Run: `pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo lint --max-warnings 0`
Expected: both pass.

- [ ] **Step 11: Check in both clients**

Web: on `/transactions`, tag a transaction, then open it from `/calendar`, change the amount, save. Back on `/transactions` the tag is still there. Open it from the Calendar again, untick the tag, save: the tag is gone. Duplicate from the Calendar: the copy carries the tags.
Phone: open a transaction from the Calendar tab; its tags show as selected chips; toggling one and saving changes it.

- [ ] **Step 12: Commit**

```bash
npx prettier --write apps/web/lib/actions/tag-field.ts apps/web/lib/actions/tag-field.test.ts apps/web/lib/actions/finance.ts apps/web/components/finance/TransactionForm.tsx "apps/web/app/(app)/calendar/page.tsx" apps/web/components/finance/CalendarView.tsx "apps/mobile/src/app/(tabs)/calendar.tsx"
git add apps/web/lib/actions/tag-field.ts apps/web/lib/actions/tag-field.test.ts apps/web/lib/actions/finance.ts apps/web/components/finance/TransactionForm.tsx "apps/web/app/(app)/calendar/page.tsx" apps/web/components/finance/CalendarView.tsx "apps/mobile/src/app/(tabs)/calendar.tsx"
git commit -m "$(cat <<'EOF'
Stop the Calendar deleting tags when a transaction is edited

The Calendar's edit form was never given the tags, so it posted none, and the
save read that as "untick everything". The form now posts a marker with its
tags control and the save only touches tags when the marker is there. The
Calendar loads and passes tags on both clients, so they can be changed from
there, and a duplicate keeps them.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Local Supabase stack, and `savings_goals.starts_on`

**Files:**
- Create: `supabase/migrations/038_goal_start.sql`
- Create: `supabase/tests/038_goal_start.test.sql`
- Modify: `packages/core/src/types/database.ts:515-542`

**Interfaces:**
- Consumes: nothing.
- Produces: column `savings_goals.starts_on date not null` (default: today in Europe/Paris); `SavingsGoal["starts_on"]: string`; Insert/Update accept optional `starts_on?: string`.

- [ ] **Step 1: Start the local stack**

Docker Desktop must be running (`docker info` prints a server version). From the repository root:

Run: `npx supabase start`
Expected: the first run pulls the images (several minutes), then prints `API URL: http://127.0.0.1:54321` and `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

Run: `npx supabase db reset`
Expected: applies `001`–`037` and ends `Finished supabase db reset`.

Run: `docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/036_soft_delete.test.sql`
Expected: a list of `NOTICE:   ok …` lines and exit 0. This proves the harness works before anything new is added.

- [ ] **Step 2: Write the failing assertion script**

Create `supabase/tests/038_goal_start.test.sql`:

```sql
-- What migration 038 has to be true for.
--
--   npx supabase db reset
--   docker exec -i supabase_db_finance-tracker psql -U postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/038_goal_start.test.sql
--
-- Every check raises rather than returns; silence to the final NOTICE is the
-- pass.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'mine@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'theirs@example.test')
on conflict (id) do nothing;

create or replace function test_become(who uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok  %', what;
end;
$$;

select test_assert(
  (select is_nullable = 'NO'
     from information_schema.columns
    where table_name = 'savings_goals' and column_name = 'starts_on'),
  'starts_on exists and is not null'
);

select test_assert(
  (timestamptz '2026-03-15 23:30:00+00' at time zone 'Europe/Paris')::date
    = date '2026-03-16',
  'the backfill expression reads the Paris date, not the UTC one'
);

select test_become('11111111-1111-1111-1111-111111111111');

insert into savings_goals (id, user_id, name, target_amount)
values (
  'cccccccc-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Holidays',
  1200
);

select test_assert(
  (select starts_on from savings_goals
    where id = 'cccccccc-0000-0000-0000-000000000001')
    = (now() at time zone 'Europe/Paris')::date,
  'a goal created without a start counts from today'
);

update savings_goals
   set starts_on = date '2026-01-01'
 where id = 'cccccccc-0000-0000-0000-000000000001';

select test_assert(
  (select starts_on from savings_goals
    where id = 'cccccccc-0000-0000-0000-000000000001') = date '2026-01-01',
  'the owner can move the start'
);

select test_become('22222222-2222-2222-2222-222222222222');

select test_assert(
  (select count(*) from savings_goals) = 0,
  'another user still sees none of it'
);

rollback;

\echo 'migration 038: all checks passed'
```

- [ ] **Step 3: Run it to see it fail**

Run: `docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/038_goal_start.test.sql`
Expected: FAIL with `ERROR:  FAILED: starts_on exists and is not null`.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/038_goal_start.sql`:

```sql
-- 038: a savings goal counts from the day it starts.
--
-- Until now a goal's progress was the current month's savings alone, so a
-- goal filled for a month and emptied on the first. It becomes a running
-- total from a start date. Existing goals start on the day they were
-- created, read in Europe/Paris like every other date in the app; the user
-- can move it.
--
-- Reversible: `alter table savings_goals drop column starts_on;` restores the
-- previous shape, and nothing else refers to the column.

alter table savings_goals add column if not exists starts_on date;

update savings_goals
   set starts_on = (created_at at time zone 'Europe/Paris')::date
 where starts_on is null;

alter table savings_goals
  alter column starts_on set default ((now() at time zone 'Europe/Paris')::date),
  alter column starts_on set not null;

comment on column savings_goals.starts_on is
  'First day whose savings count towards the goal. Backfilled from created_at.';
```

- [ ] **Step 5: Replay the chain and run the checks**

Run: `npx supabase db reset && docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/038_goal_start.test.sql`
Expected: five `NOTICE:   ok …` lines, then `migration 038: all checks passed`.

Also re-run `036_soft_delete.test.sql` the same way. Expected: still passes.

- [ ] **Step 6: Types**

In `packages/core/src/types/database.ts`, in `savings_goals`: add `starts_on: string;` to `Row` after `category_id`, and `starts_on?: string;` to both `Insert` and `Update` after `category_id`.

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter mobile exec tsc --noEmit`
Expected: all pass. No code builds a `savings_goals` row by hand, and `Insert`/`Update` take the column as optional.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/038_goal_start.sql supabase/tests/038_goal_start.test.sql packages/core/src/types/database.ts
git commit -m "$(cat <<'EOF'
Give each savings goal a start date

Additive: existing goals start on the day they were created, in Paris time,
and new ones on the day they are added. Run against a local stack with db
reset; the assertion script beside it checks the default, the backfill
expression, that the owner can move it, and that RLS still scopes it.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Core — goal running totals, as-of date, paging

**Files:**
- Create: `packages/core/src/paging.ts`
- Test: `packages/core/src/paging.test.ts`
- Modify: `packages/core/src/savings-goals.ts`
- Test: `packages/core/src/savings-goals.test.ts` (create)
- Modify: `packages/core/package.json` (`"exports"`)

**Interfaces:**
- Consumes: `templateOccurrenceDates(template, year, month, asOfDate): string[]` from `./budget`; `recurringOccurrenceKey(templateId, occurredOn): string` from `./apply-recurring`; `lastDayIsoOfMonth(year, month): string` and `formatMonthLabel` from `./constants`.
- Produces (all exported):
  - `PAGE_SIZE = 1000`; `allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]>` from `@finance/core/paging`.
  - From `@finance/core/savings-goals`:
    - `interface GoalLedger { transactions: TransactionWithCategory[]; appliedKeys: ReadonlySet<string>; skippedKeys: ReadonlySet<string> }`
    - `EMPTY_GOAL_LEDGER: GoalLedger`
    - `earliestGoalStart(goals: Pick<SavingsGoal, "starts_on">[]): string | null`
    - `goalTotalsAsOf(year: number, month: number, today: string): string`
    - `buildGoalRunningTotals(goals: SavingsGoal[], ledger: GoalLedger, templates: RecurringTemplateWithCategory[], asOf: string): Map<string, number>`
    - `buildSavingsGoalProgress(goals: SavingsGoal[], savedByGoal: ReadonlyMap<string, number>): SavingsGoalProgress[]` (**signature changed**: the second and third parameters `savingsBreakdown, totalSavings` are replaced by `savedByGoal`)
    - `computeGoalPacing` unchanged.

- [ ] **Step 1: Write the failing paging test**

Create `packages/core/src/paging.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allRows, PAGE_SIZE } from "./paging";

/** A fake capped endpoint over `total` numbered rows. */
function endpoint(total: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const rows = Array.from(
      { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
      (_, index) => from + index,
    );
    return { data: rows, error: null };
  };
  return { page, calls };
}

describe("allRows", () => {
  it("reads one short page and stops", async () => {
    const { page, calls } = endpoint(3);
    expect(await allRows(page)).toEqual([0, 1, 2]);
    expect(calls).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it("keeps reading past the server's cap", async () => {
    const { page, calls } = endpoint(PAGE_SIZE * 2 + 5);
    const rows = await allRows(page);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(rows.at(-1)).toBe(PAGE_SIZE * 2 + 4);
    expect(calls).toHaveLength(3);
  });

  it("asks once more after an exactly full page, and stops on the empty one", async () => {
    const { page, calls } = endpoint(PAGE_SIZE);
    expect(await allRows(page)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("throws the endpoint's error", async () => {
    const failure = new Error("boom");
    await expect(
      allRows(async () => ({ data: null, error: failure })),
    ).rejects.toBe(failure);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @finance/core exec vitest run src/paging.test.ts`
Expected: FAIL, `Failed to resolve import "./paging"`.

- [ ] **Step 3: Implement paging**

Create `packages/core/src/paging.ts`:

```ts
/**
 * Every row of a query the server caps.
 *
 * PostgREST answers at most `max_rows` rows (1,000 in `supabase/config.toml`)
 * and says nothing when it stops short, so a total over a long history is
 * silently wrong past that point. This reads page after page until one comes
 * back short. The caller orders the query by a unique column, or rows could
 * repeat or vanish between pages.
 */
export const PAGE_SIZE = 1000;

export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      return rows;
    }
  }
}
```

Add `"./paging": "./src/paging.ts",` to `packages/core/package.json` `"exports"`, in alphabetical position (after `"./outbox"`).

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm --filter @finance/core exec vitest run src/paging.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing goal tests**

Create `packages/core/src/savings-goals.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBudgetSavingsBreakdownWithProjection,
  computeMonthlyBudgetWithProjection,
} from "./budget";
import {
  buildGoalRunningTotals,
  buildSavingsGoalProgress,
  earliestGoalStart,
  EMPTY_GOAL_LEDGER,
  goalTotalsAsOf,
  type GoalLedger,
} from "./savings-goals";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
  SavingsGoal,
  TransactionWithCategory,
} from "./types/database";

let sequence = 0;

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  sequence += 1;
  return {
    id: `goal-${sequence}`,
    user_id: "user-1",
    name: "Holidays",
    target_amount: 1000,
    target_date: null,
    category_id: "cat-holidays",
    starts_on: "2026-01-01",
    created_at: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

function tx({
  on,
  amount,
  categoryId = "cat-holidays",
  type = "savings",
  counts = true,
  templateId = null,
}: {
  on: string;
  amount: number;
  categoryId?: string;
  type?: CategoryType;
  counts?: boolean;
  templateId?: string | null;
}): TransactionWithCategory {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    user_id: "user-1",
    category_id: categoryId,
    recurring_template_id: templateId,
    occurred_on: on,
    amount,
    note: null,
    created_at: `${on}T10:00:00.000Z`,
    categories: { name: categoryId, type, icon: null, counts_toward_summary: counts },
  };
}

function template({
  id,
  amount,
  categoryId = "cat-holidays",
  counts = true,
  dayOfMonth = 5,
  active = true,
}: {
  id: string;
  amount: number;
  categoryId?: string;
  counts?: boolean;
  dayOfMonth?: number;
  active?: boolean;
}): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: categoryId,
    amount,
    day_of_month: dayOfMonth,
    day_of_week: null,
    month_of_year: null,
    recurrence: "monthly",
    active,
    description: null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: null,
    ends_on: null,
    created_at: "2025-01-01T00:00:00.000Z",
    categories: {
      name: categoryId,
      type: "savings",
      icon: null,
      counts_toward_summary: counts,
    },
  };
}

function ledger(
  transactions: TransactionWithCategory[],
  extra: Partial<GoalLedger> = {},
): GoalLedger {
  return {
    transactions,
    appliedKeys: new Set(
      transactions
        .filter((row) => row.recurring_template_id)
        .map((row) => `${row.recurring_template_id}:${row.occurred_on}`),
    ),
    skippedKeys: new Set(),
    ...extra,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildGoalRunningTotals", () => {
  it("adds a linked category across every month from the start to the as-of day", () => {
    const holidays = goal({ starts_on: "2026-01-01" });
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger([
        tx({ on: "2025-12-20", amount: 999 }), // before the start
        tx({ on: "2026-01-10", amount: 100 }),
        tx({ on: "2026-02-10", amount: 150 }),
        tx({ on: "2026-03-10", amount: 200 }),
        tx({ on: "2026-03-20", amount: 999 }), // after the as-of day
        tx({ on: "2026-02-11", amount: 50, categoryId: "cat-other" }),
      ]),
      [],
      "2026-03-15",
    );
    expect(totals.get(holidays.id)).toBe(450);
  });

  it("counts the first month from the start day, not from the first", () => {
    const holidays = goal({ starts_on: "2026-03-10" });
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger([
        tx({ on: "2026-03-03", amount: 40 }),
        tx({ on: "2026-03-12", amount: 60 }),
      ]),
      // Due on the 5th: before the start, so it does not count this month.
      [template({ id: "tpl-1", amount: 80, dayOfMonth: 5 })],
      "2026-03-31",
    );
    expect(totals.get(holidays.id)).toBe(60);
  });

  it("counts all savings for a goal with no category, and takes withdrawals off", () => {
    const buffer = goal({ category_id: null });
    const totals = buildGoalRunningTotals(
      [buffer],
      ledger([
        tx({ on: "2026-01-10", amount: 300, categoryId: "cat-a" }),
        tx({ on: "2026-02-10", amount: 200, categoryId: "cat-b" }),
        // A savings category marked as not counting is money coming back out.
        tx({ on: "2026-02-20", amount: 120, categoryId: "cat-out", counts: false }),
        // Not savings at all.
        tx({ on: "2026-02-21", amount: 70, categoryId: "cat-food", type: "expense" }),
      ]),
      [],
      "2026-02-28",
    );
    expect(totals.get(buffer.id)).toBe(380);
  });

  it("counts occurrences due by the as-of day that were neither applied nor skipped", () => {
    const holidays = goal({ starts_on: "2026-01-01" });
    const monthly = template({ id: "tpl-1", amount: 50, dayOfMonth: 5 });
    const paused = template({ id: "tpl-2", amount: 999, active: false });
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger(
        // January's occurrence was applied, at its own amount.
        [tx({ on: "2026-01-05", amount: 55, templateId: "tpl-1" })],
        { skippedKeys: new Set(["tpl-1:2026-02-05"]) },
      ),
      [monthly, paused],
      "2026-04-04",
    );
    // January applied (55), February skipped, March unapplied (50), April not
    // due until the 5th.
    expect(totals.get(holidays.id)).toBe(105);
  });

  it("adds nothing for a non-counting template to an all-savings goal", () => {
    const buffer = goal({ category_id: null });
    const totals = buildGoalRunningTotals(
      [buffer],
      ledger([]),
      [template({ id: "tpl-out", amount: 40, categoryId: "cat-out", counts: false })],
      "2026-01-31",
    );
    expect(totals.get(buffer.id)).toBe(0);
  });

  it("is zero for a goal that starts after the as-of day", () => {
    const later = goal({ starts_on: "2026-06-01" });
    const totals = buildGoalRunningTotals(
      [later],
      ledger([tx({ on: "2026-05-10", amount: 100 })]),
      [template({ id: "tpl-1", amount: 50 })],
      "2026-05-31",
    );
    expect(totals.get(later.id)).toBe(0);
  });

  it("rounds to the cent", () => {
    const holidays = goal();
    const totals = buildGoalRunningTotals(
      [holidays],
      ledger([
        tx({ on: "2026-01-10", amount: 0.1 }),
        tx({ on: "2026-01-11", amount: 0.2 }),
      ]),
      [],
      "2026-01-31",
    );
    expect(totals.get(holidays.id)).toBe(0.3);
  });

  it("agrees with the monthly summary for a goal that spans the whole month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
    const rows = [
      tx({ on: "2026-03-02", amount: 120, categoryId: "cat-holidays" }),
      tx({ on: "2026-03-08", amount: 30, categoryId: "cat-other" }),
      tx({ on: "2026-03-09", amount: 25, categoryId: "cat-out", counts: false }),
      tx({ on: "2026-03-05", amount: 50, categoryId: "cat-holidays", templateId: "tpl-1" }),
    ];
    const templates = [
      template({ id: "tpl-1", amount: 50, dayOfMonth: 5 }),
      template({ id: "tpl-2", amount: 70, categoryId: "cat-other", dayOfMonth: 15 }),
      template({ id: "tpl-3", amount: 90, categoryId: "cat-other", dayOfMonth: 25 }),
    ];
    const linked = goal({ starts_on: "2026-03-01", category_id: "cat-holidays" });
    const everything = goal({ starts_on: "2026-03-01", category_id: null });

    const totals = buildGoalRunningTotals(
      [linked, everything],
      ledger(rows),
      templates,
      "2026-03-20",
    );

    const breakdown = buildBudgetSavingsBreakdownWithProjection(
      rows,
      templates,
      2026,
      3,
      "current",
    );
    const month = computeMonthlyBudgetWithProjection(
      rows,
      templates,
      2026,
      3,
      "current",
    );
    expect(totals.get(linked.id)).toBe(
      breakdown.find((row) => row.categoryId === "cat-holidays")?.total,
    );
    expect(totals.get(everything.id)).toBe(month.savings);
  });
});

describe("goalTotalsAsOf", () => {
  it("is today for the month in progress", () => {
    expect(goalTotalsAsOf(2026, 9, "2026-09-25")).toBe("2026-09-25");
  });

  it("is the last day of a past month", () => {
    expect(goalTotalsAsOf(2026, 2, "2026-09-25")).toBe("2026-02-28");
  });
});

describe("earliestGoalStart", () => {
  it("is null with no goals", () => {
    expect(earliestGoalStart([])).toBeNull();
  });

  it("is the earliest start", () => {
    expect(
      earliestGoalStart([
        { starts_on: "2026-04-01" },
        { starts_on: "2025-11-15" },
        { starts_on: "2026-01-01" },
      ]),
    ).toBe("2025-11-15");
  });
});

describe("buildSavingsGoalProgress", () => {
  it("reads each goal's running total", () => {
    const holidays = goal({ target_amount: 1000 });
    const [row] = buildSavingsGoalProgress(
      [holidays],
      new Map([[holidays.id, 250]]),
    );
    expect(row).toMatchObject({
      saved: 250,
      remaining: 750,
      ratio: 0.25,
      complete: false,
    });
  });

  it("never draws a negative bar when withdrawals outweigh deposits", () => {
    const buffer = goal({ category_id: null, target_amount: 500 });
    const [row] = buildSavingsGoalProgress([buffer], new Map([[buffer.id, -80]]));
    expect(row.ratio).toBe(0);
    expect(row.remaining).toBe(500);
    expect(row.complete).toBe(false);
  });

  it("treats a goal with no total as nothing saved yet", () => {
    const holidays = goal();
    const [row] = buildSavingsGoalProgress([holidays], new Map());
    expect(row.saved).toBe(0);
  });

  it("is complete at the target", () => {
    const holidays = goal({ target_amount: 300 });
    const [row] = buildSavingsGoalProgress([holidays], new Map([[holidays.id, 300]]));
    expect(row.complete).toBe(true);
    expect(row.ratio).toBe(1);
  });
});

describe("EMPTY_GOAL_LEDGER", () => {
  it("gives every goal zero", () => {
    const holidays = goal();
    expect(
      buildGoalRunningTotals([holidays], EMPTY_GOAL_LEDGER, [], "2026-09-25").get(
        holidays.id,
      ),
    ).toBe(0);
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm --filter @finance/core exec vitest run src/savings-goals.test.ts`
Expected: FAIL, e.g. `buildGoalRunningTotals is not a function` / missing exports.

- [ ] **Step 7: Implement**

Replace the top of `packages/core/src/savings-goals.ts`, from the first line down to and including the closing `}` of `buildSavingsGoalProgress`, with:

```ts
import { recurringOccurrenceKey } from "./apply-recurring";
import { templateOccurrenceDates } from "./budget";
import { formatMonthLabel, lastDayIsoOfMonth } from "./constants";
import type {
  RecurringTemplateWithCategory,
  SavingsGoal,
  TransactionWithCategory,
} from "./types/database";

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  ratio: number;
  complete: boolean;
}

/**
 * What a goal's running total is counted from.
 *
 * Fetched for the window from the earliest goal start to the as-of day. The
 * applied keys cover every applied occurrence in that window whatever its
 * category, so an occurrence applied and then re-filed elsewhere is not
 * counted a second time as still due.
 */
export interface GoalLedger {
  /** Savings transactions in the window, with their category. */
  transactions: TransactionWithCategory[];
  /** `templateId:date` of every applied occurrence in the window. */
  appliedKeys: ReadonlySet<string>;
  /** `templateId:date` of every skipped occurrence in the window. */
  skippedKeys: ReadonlySet<string>;
}

export const EMPTY_GOAL_LEDGER: GoalLedger = {
  transactions: [],
  appliedKeys: new Set(),
  skippedKeys: new Set(),
};

/** The first day any goal counts from, or null when there are no goals. */
export function earliestGoalStart(
  goals: Pick<SavingsGoal, "starts_on">[],
): string | null {
  let earliest: string | null = null;
  for (const goal of goals) {
    if (earliest === null || goal.starts_on < earliest) {
      earliest = goal.starts_on;
    }
  }
  return earliest;
}

/**
 * The day a goal's figures stop at when they are shown beside one month:
 * today for the month in progress, the month's last day for a past one.
 *
 * Both clients use this for the month read, whose stored text is checked
 * against a digest of its facts, so the two must stop on the same day.
 */
export function goalTotalsAsOf(
  year: number,
  month: number,
  today: string,
): string {
  const monthEnd = lastDayIsoOfMonth(year, month);
  return today < monthEnd ? today : monthEnd;
}

function monthsBetween(
  from: string,
  to: string,
): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const lastYear = Number(to.slice(0, 4));
  const lastMonth = Number(to.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function roundToCent(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How much each goal holds on `asOf`, by goal id.
 *
 * The monthly summary's `current` view, summed over every month from the
 * goal's start, with the first month counted from the start day:
 *
 * - a goal linked to a category counts that category's savings transactions,
 *   and the occurrences its active templates called for by `asOf` that were
 *   neither applied nor skipped;
 * - a goal with no category counts every savings transaction, withdrawal
 *   categories (savings marked as not counting) subtracting, and the due
 *   occurrences of active counting savings templates.
 *
 * Deliberately the same rule the monthly summary uses, so a month's goal
 * progress and that month's savings figure can be checked against each
 * other.
 */
export function buildGoalRunningTotals(
  goals: SavingsGoal[],
  ledger: GoalLedger,
  templates: RecurringTemplateWithCategory[],
  asOf: string,
): Map<string, number> {
  const savingsTemplates = templates.filter(
    (template) => template.active && template.categories.type === "savings",
  );
  const totals = new Map<string, number>();

  for (const goal of goals) {
    const from = goal.starts_on;
    if (from > asOf) {
      totals.set(goal.id, 0);
      continue;
    }

    let saved = 0;

    for (const row of ledger.transactions) {
      if (
        row.categories.type !== "savings" ||
        row.occurred_on < from ||
        row.occurred_on > asOf
      ) {
        continue;
      }
      const counts = row.categories.counts_toward_summary !== false;
      const amount = Number(row.amount);
      if (goal.category_id !== null) {
        saved += row.category_id === goal.category_id ? amount : 0;
      } else {
        saved += counts ? amount : -amount;
      }
    }

    const months = monthsBetween(from, asOf);
    for (const template of savingsTemplates) {
      const counts = template.categories.counts_toward_summary !== false;
      const applies =
        goal.category_id !== null
          ? template.category_id === goal.category_id
          : counts;
      if (!applies) {
        continue;
      }
      for (const { year, month } of months) {
        for (const date of templateOccurrenceDates(
          template,
          year,
          month,
          asOf,
        )) {
          const key = recurringOccurrenceKey(template.id, date);
          if (
            date < from ||
            ledger.appliedKeys.has(key) ||
            ledger.skippedKeys.has(key)
          ) {
            continue;
          }
          saved += Number(template.amount);
        }
      }
    }

    totals.set(goal.id, roundToCent(saved));
  }

  return totals;
}

/** Progress for each goal from its running total. */
export function buildSavingsGoalProgress(
  goals: SavingsGoal[],
  savedByGoal: ReadonlyMap<string, number>,
): SavingsGoalProgress[] {
  return goals.map((goal) => {
    const saved = savedByGoal.get(goal.id) ?? 0;
    const target = Number(goal.target_amount);
    const remaining = Math.max(0, target - saved);
    // Floored at zero: withdrawals can take an all-savings goal below
    // nothing, and a bar cannot be drawn backwards.
    const ratio = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;

    return {
      goal,
      saved,
      remaining,
      ratio,
      complete: saved >= target,
    };
  });
}
```

Leave `GoalPacingStatus`, `GoalPacing`, `wholeMonthsUntil` and `computeGoalPacing` below it unchanged.

- [ ] **Step 8: Run the goal tests to see them pass**

Run: `pnpm --filter @finance/core exec vitest run src/savings-goals.test.ts src/paging.test.ts`
Expected: PASS, all tests.

- [ ] **Step 9: Core gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter @finance/core test`
Expected: both pass. Web and mobile typecheck now fail at the four `buildSavingsGoalProgress` call sites; Tasks 7 and 8 fix them.

- [ ] **Step 10: Commit**

```bash
npx prettier --write packages/core/src/paging.ts packages/core/src/paging.test.ts packages/core/src/savings-goals.ts packages/core/src/savings-goals.test.ts packages/core/package.json
git add packages/core/src/paging.ts packages/core/src/paging.test.ts packages/core/src/savings-goals.ts packages/core/src/savings-goals.test.ts packages/core/package.json
git commit -m "$(cat <<'EOF'
Count a savings goal from its start date, by the monthly summary's own rule

buildGoalRunningTotals sums the monthly summary's current view over every
month from the goal's start, first month from the start day, and a test
proves the two agree for a whole month. Progress can no longer draw a
negative bar. allRows reads past PostgREST's 1,000-row cap, which a goal's
history can exceed.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Web — goals show their running total, and a start date

**Files:**
- Modify: `packages/core/src/validations/phase4.ts:34-48`
- Modify: `apps/web/lib/queries/phase4.ts`
- Modify: `apps/web/app/(app)/budgets/page.tsx`
- Modify: `apps/web/app/(app)/budgets/BudgetsView.tsx` (goal form)
- Modify: `apps/web/lib/actions/phase4.ts:263-313`
- Modify: `apps/web/lib/month-read/facts.ts:36-50,64-95,184-188`
- Modify: `packages/core/src/i18n/messages/en.ts`, `fr.ts` (`plan` block)

**Interfaces:**
- Consumes: `allRows` (`@finance/core/paging`); `GoalLedger`, `EMPTY_GOAL_LEDGER`, `earliestGoalStart`, `goalTotalsAsOf`, `buildGoalRunningTotals`, `buildSavingsGoalProgress` (`@finance/core/savings-goals`); `recurringOccurrenceKey` (`@finance/core/apply-recurring`); `getT()` (`@/lib/locale`).
- Produces: `getGoalLedger(userId: string, from: string, to: string): Promise<GoalLedger>` from `apps/web/lib/queries/phase4.ts`; `savingsGoalSchema` gains `startsOn?: string | ""`; i18n keys `plan.goalStartsOn`, `plan.goalStartsOnHint`, `plan.linkCategoriesTitle`, `plan.linkCategoriesHint`, `plan.linkImportTitle`, `plan.linkImportHint`.

- [ ] **Step 1: Goal schema accepts a start date**

In `packages/core/src/validations/phase4.ts`, in `savingsGoalSchema`, add after `targetDate`:

```ts
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate")
    .optional()
    .or(z.literal("")),
```

- [ ] **Step 2: Messages**

In `packages/core/src/i18n/messages/en.ts`, in the `plan` block after `goalTargetDateOptional`, add:

```ts
    goalStartsOn: "Counting from",
    goalStartsOnHint: "Savings from this day on count towards the goal.",
    linkCategoriesTitle: "Categories",
    linkCategoriesHint: "Where money is allowed to go",
    linkImportTitle: "Import a statement",
    linkImportHint: "A CSV, when there is no bank feed",
```

In `fr.ts`, in the `plan` block at the same position:

```ts
    goalStartsOn: "Compter à partir du",
    goalStartsOnHint: "L'épargne à partir de ce jour compte pour l'objectif.",
    linkCategoriesTitle: "Catégories",
    linkCategoriesHint: "Là où l'argent a le droit d'aller",
    linkImportTitle: "Importer un relevé",
    linkImportHint: "Un CSV, quand il n'y a pas de connexion bancaire",
```

- [ ] **Step 3: The ledger query**

In `apps/web/lib/queries/phase4.ts` add imports:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { allRows } from "@finance/core/paging";
import type { GoalLedger } from "@finance/core/savings-goals";
import type {
  Database,
  TransactionWithCategory,
} from "@finance/core/types/database";
```

and add below `getSavingsGoals`:

```ts
/**
 * Everything a goal's running total is counted from, between two days.
 *
 * Three reads, each paged past the 1,000-row cap: the savings transactions,
 * the applied occurrences of any type (so a re-filed one is not counted as
 * still due), and the skips. Soft-deleted transactions are already hidden by
 * RLS.
 *
 * Takes the caller's client when there is one: the phone's month-read route
 * authenticates with a bearer token, and the cookie client has no session
 * there.
 */
export async function getGoalLedger(
  userId: string,
  from: string,
  to: string,
  client?: SupabaseClient<Database>,
): Promise<GoalLedger> {
  const supabase = client ?? (await createClient());
  const [transactions, applied, skipped] = await Promise.all([
    allRows<TransactionWithCategory>((start, end) =>
      supabase
        .from("transactions")
        .select("*, categories!inner(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .eq("categories.type", "savings")
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("id")
        .range(start, end)
        .then(({ data, error }) => ({
          data: data as TransactionWithCategory[] | null,
          error,
        })),
    ),
    allRows<{ recurring_template_id: string | null; occurred_on: string }>(
      (start, end) =>
        supabase
          .from("transactions")
          .select("recurring_template_id, occurred_on")
          .eq("user_id", userId)
          .not("recurring_template_id", "is", null)
          .gte("occurred_on", from)
          .lte("occurred_on", to)
          .order("id")
          .range(start, end),
    ),
    allRows<{ template_id: string; occurred_on: string }>((start, end) =>
      supabase
        .from("recurring_skips")
        .select("template_id, occurred_on")
        .eq("user_id", userId)
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("id")
        .range(start, end),
    ),
  ]);

  return {
    transactions,
    appliedKeys: new Set(
      applied.flatMap((row) =>
        row.recurring_template_id
          ? [recurringOccurrenceKey(row.recurring_template_id, row.occurred_on)]
          : [],
      ),
    ),
    skippedKeys: new Set(
      skipped.map((row) =>
        recurringOccurrenceKey(row.template_id, row.occurred_on),
      ),
    ),
  };
}
```

- [ ] **Step 4: The Plan page computes running totals and translates its link cards**

In `apps/web/app/(app)/budgets/page.tsx`:

Change imports: replace

```tsx
import { getBudgets, getSavingsGoals, getTags } from "@/lib/queries/phase4";
```

with

```tsx
import {
  getBudgets,
  getGoalLedger,
  getSavingsGoals,
  getTags,
} from "@/lib/queries/phase4";
```

replace the `buildSavingsGoalProgress, computeGoalPacing` import with:

```tsx
import {
  buildGoalRunningTotals,
  buildSavingsGoalProgress,
  computeGoalPacing,
  earliestGoalStart,
  EMPTY_GOAL_LEDGER,
} from "@finance/core/savings-goals";
```

and change `import { getLocale } from "@/lib/locale";` to `import { getLocale, getT } from "@/lib/locale";`.

Replace:

```tsx
  const goalProgress = buildSavingsGoalProgress(
    goals,
    summary.savingsBreakdown,
    summary.savings,
  ).map((row) => ({
```

with:

```tsx
  // A running total from each goal's start, not this month alone. Asked for
  // after the batch because the window depends on the goals it fetched.
  const goalStart = earliestGoalStart(goals);
  const goalLedger = goalStart
    ? await getGoalLedger(user.id, goalStart, today)
    : EMPTY_GOAL_LEDGER;
  const goalProgress = buildSavingsGoalProgress(
    goals,
    buildGoalRunningTotals(goals, goalLedger, templates, today),
  ).map((row) => ({
```

Add `const t = await getT();` directly below `const categoryNames = …`. Replace the link-card array:

```tsx
            {[
              {
                href: "/categories",
                title: "Categories",
                hint: "Where money is allowed to go",
              },
              {
                href: "/import",
                title: "Import a statement",
                hint: "A CSV, when there is no bank feed",
              },
            ].map(({ href, title, hint }) => (
```

with:

```tsx
            {[
              {
                href: "/categories",
                title: t("plan.linkCategoriesTitle"),
                hint: t("plan.linkCategoriesHint"),
              },
              {
                href: "/import",
                title: t("plan.linkImportTitle"),
                hint: t("plan.linkImportHint"),
              },
            ].map(({ href, title, hint }) => (
```

- [ ] **Step 5: The goal form has a start date**

In `apps/web/app/(app)/budgets/BudgetsView.tsx` add `import { todayIsoLocal } from "@finance/core/constants";`. In the goal form, directly after the `goal-date` field's `<div className="flex flex-col gap-2">…</div>`, add:

```tsx
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-starts">
                  {t("plan.goalStartsOn")}
                </FormLabel>
                <Input
                  id="goal-starts"
                  name="startsOn"
                  type="date"
                  aria-describedby="goal-starts-hint"
                  defaultValue={editingGoal?.starts_on ?? todayIsoLocal()}
                />
                <p
                  id="goal-starts-hint"
                  className="text-xs text-muted-foreground"
                >
                  {t("plan.goalStartsOnHint")}
                </p>
              </div>
```

- [ ] **Step 6: The action saves it**

In `apps/web/lib/actions/phase4.ts` `upsertSavingsGoal`, add to the `safeParse` input:

```ts
    startsOn: formData.get("startsOn") || undefined,
```

and replace the `payload` object with:

```ts
  const payload = {
    name: parsed.data.name,
    target_amount: parsed.data.targetAmount,
    target_date: parsed.data.targetDate || null,
    category_id: parsed.data.categoryId ?? null,
    // Absent means "keep what it was" on an edit and "today" on a new goal,
    // which is the column's default.
    ...(parsed.data.startsOn ? { starts_on: parsed.data.startsOn } : {}),
  };
```

- [ ] **Step 7: The month read's goal figures stop at the month it reads**

In `apps/web/lib/month-read/facts.ts`:

Replace `import { buildSavingsGoalProgress } from "@finance/core/savings-goals";` with:

```ts
import {
  buildGoalRunningTotals,
  buildSavingsGoalProgress,
  earliestGoalStart,
  EMPTY_GOAL_LEDGER,
  goalTotalsAsOf,
} from "@finance/core/savings-goals";
```

and `import { getBudgets, getSavingsGoals } from "@/lib/queries/phase4";` with `import { getBudgets, getGoalLedger, getSavingsGoals } from "@/lib/queries/phase4";`.

In the doc comment above `gatherMonthFacts`, replace the paragraph starting `No new queries. Every figure here is one the Month page has on screen anyway` with:

```ts
 * Every figure here is one another surface already has on screen — goal
 * progress is the Plan page's running total, stopped at the end of the month
 * being read — which is the property that makes the read checkable: a
 * reader can look at that surface and see the same number.
```

After the line `const cash = isCurrentMonth ? … : null;` block, add:

```ts
  // Goal progress as it stood at the end of this month, or today for the
  // month in progress. The phone computes the same figure the same way.
  const goalsAsOf = goalTotalsAsOf(year, month, today);
  const goalStart = earliestGoalStart(goals);
  const goalLedger =
    goalStart && goalStart <= goalsAsOf
      ? await getGoalLedger(userId, goalStart, goalsAsOf, client)
      : EMPTY_GOAL_LEDGER;
```

and replace:

```ts
    goals: buildSavingsGoalProgress(
      goals,
      summary.savingsBreakdown,
      summary.savings,
    ),
```

with:

```ts
    goals: buildSavingsGoalProgress(
      goals,
      buildGoalRunningTotals(goals, goalLedger, templates, goalsAsOf),
    ),
```

Most other reads in `gatherMonthFacts` (`getMonthlySummary`, `getSavingsGoals`, `getRecurringTemplates` and others) ignore `client` and use the cookie client. That client has no session on the phone's bearer-token route. This is a pre-existing defect outside this task. Do not widen the task to fix it: it is recorded in the app guide (Task 12) and raised with the user.

- [ ] **Step 8: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter @finance/core test && pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint --max-warnings 0 . && pnpm --filter web test && pnpm check:reachability`
Expected: all pass. (`check:reachability` fails if a new key is unused.)

- [ ] **Step 9: Check in the browser against the local stack**

Point the dev server at the local stack: in `apps/web/.env.local` temporarily set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the `anon key` from `npx supabase status`. Keep a copy of the original values and restore them after this step. Start `pnpm --filter web exec next dev -H 0.0.0.0` and open `http://$(hostname -I | awk '{print $1}'):3000`. Sign up, create a savings category, add savings transactions in three different months, and add a goal on that category starting before the first one. Expected:
- Plan shows the sum of all three.
- Moving the start date past the first transaction lowers it by that amount.
- The two link cards read in French when the language is French.
- The start-date hint is announced with the field (inspect `aria-describedby`).

- [ ] **Step 10: Commit**

```bash
npx prettier --write packages/core/src/validations/phase4.ts packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts apps/web/lib/queries/phase4.ts "apps/web/app/(app)/budgets/page.tsx" "apps/web/app/(app)/budgets/BudgetsView.tsx" apps/web/lib/actions/phase4.ts apps/web/lib/month-read/facts.ts
git add packages/core/src/validations/phase4.ts packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts apps/web/lib/queries/phase4.ts "apps/web/app/(app)/budgets/page.tsx" "apps/web/app/(app)/budgets/BudgetsView.tsx" apps/web/lib/actions/phase4.ts apps/web/lib/month-read/facts.ts
git commit -m "$(cat <<'EOF'
Show each savings goal's running total on the web

Plan counts a goal from its start date instead of this month alone, and the
goal form says where counting starts. The month read's goal facts stop at the
end of the month it reads, the same way the phone will. The Plan page's two
link cards are translated.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Phone — goals show their running total, and a start date

**Files:**
- Modify: `apps/mobile/src/lib/queries.ts` (after `getSavingsGoals`, line ~459)
- Modify: `apps/mobile/src/lib/mutations.ts:1241-1281`
- Modify: `apps/mobile/src/app/(tabs)/planning.tsx:126-128,180-230,261-277,535-556`
- Modify: `apps/mobile/src/lib/bearing-panel.ts:520-551`

**Interfaces:**
- Consumes: everything Task 6 produces; `plan.goalStartsOn`, `plan.goalStartsOnHint` from Task 7.
- Produces: mobile `getGoalLedger(userId: string, from: string, to: string): Promise<GoalLedger>`; mobile `upsertSavingsGoal` input gains `startsOn?: string`.

- [ ] **Step 1: The ledger query on the phone**

In `apps/mobile/src/lib/queries.ts` add imports (with the other core imports at the top):

```ts
import { allRows } from "@finance/core/paging";
import type { GoalLedger } from "@finance/core/savings-goals";
```

(`recurringOccurrenceKey` and `TransactionWithCategory` are already imported.) Add below `getSavingsGoals`:

```ts
/**
 * Everything a goal's running total is counted from, between two days.
 *
 * The web's `getGoalLedger`, read the same way, because the month read
 * compares the two clients' facts by digest.
 */
export async function getGoalLedger(
  userId: string,
  from: string,
  to: string,
): Promise<GoalLedger> {
  const [transactions, applied, skipped] = await Promise.all([
    allRows<TransactionWithCategory>((start, end) =>
      supabase
        .from("transactions")
        .select("*, categories!inner(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .eq("categories.type", "savings")
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("id")
        .range(start, end)
        .then(({ data, error }) => ({
          data: data as TransactionWithCategory[] | null,
          error,
        })),
    ),
    allRows<{ recurring_template_id: string | null; occurred_on: string }>(
      (start, end) =>
        supabase
          .from("transactions")
          .select("recurring_template_id, occurred_on")
          .eq("user_id", userId)
          .not("recurring_template_id", "is", null)
          .gte("occurred_on", from)
          .lte("occurred_on", to)
          .order("id")
          .range(start, end),
    ),
    allRows<{ template_id: string; occurred_on: string }>((start, end) =>
      supabase
        .from("recurring_skips")
        .select("template_id, occurred_on")
        .eq("user_id", userId)
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("id")
        .range(start, end),
    ),
  ]);

  return {
    transactions,
    appliedKeys: new Set(
      applied.flatMap((row) =>
        row.recurring_template_id
          ? [recurringOccurrenceKey(row.recurring_template_id, row.occurred_on)]
          : [],
      ),
    ),
    skippedKeys: new Set(
      skipped.map((row) =>
        recurringOccurrenceKey(row.template_id, row.occurred_on),
      ),
    ),
  };
}
```

- [ ] **Step 2: The mutation saves a start date**

In `apps/mobile/src/lib/mutations.ts` `upsertSavingsGoal`, add `startsOn?: string;` to the input type and replace `payload` with:

```ts
  const payload = {
    name: parsed.data.name,
    target_amount: parsed.data.targetAmount,
    target_date: parsed.data.targetDate || null,
    category_id: parsed.data.categoryId ?? null,
    // Absent means "keep what it was" on an edit and "today" on a new goal.
    ...(parsed.data.startsOn ? { starts_on: parsed.data.startsOn } : {}),
  };
```

- [ ] **Step 3: Plan on the phone computes running totals**

In `apps/mobile/src/app/(tabs)/planning.tsx`:
- Extend the `@finance/core/savings-goals` import with `buildGoalRunningTotals, earliestGoalStart, EMPTY_GOAL_LEDGER`.
- Add `getGoalLedger,` to the `@/lib/queries` import.
- Directly after the `await Promise.all([...])` batch, add:

```tsx
      // A running total from each goal's start. Asked for after the batch
      // because the window depends on the goals it fetched.
      const goalStart = earliestGoalStart(goals);
      const goalLedger = goalStart
        ? await getGoalLedger(user.id, goalStart, today)
        : EMPTY_GOAL_LEDGER;
```

- Replace:

```tsx
        goalProgress: buildSavingsGoalProgress(
          goals,
          summary.savingsBreakdown,
          summary.savings,
        ),
```

with:

```tsx
        goalProgress: buildSavingsGoalProgress(
          goals,
          buildGoalRunningTotals(goals, goalLedger, templates, today),
        ),
```

- [ ] **Step 4: The phone's goal form has a start date**

In `planning.tsx`, below `const [goalTargetDate, setGoalTargetDate] = useState("");` add:

```tsx
  const [goalStartsOn, setGoalStartsOn] = useState(() => todayIsoLocal());
```

(`todayIsoLocal` is already imported.) In `handleAddGoal`, add `startsOn: goalStartsOn,` to the `upsertSavingsGoal({ … })` argument, and after `setGoalTargetDate("");` add `setGoalStartsOn(todayIsoLocal());`. In the form, directly after the target-date field (the `DateField` bound to `goalTargetDate`), add:

```tsx
              <Text variant="label">{t("plan.goalStartsOn")}</Text>
              <DateField value={goalStartsOn} onChange={setGoalStartsOn} />
              <Text variant="muted" className="text-xs">
                {t("plan.goalStartsOnHint")}
              </Text>
```

`DateField` takes `value`, `onChange`, `placeholder`, `clearable` and `className` only. It is not `clearable` here, because a goal always has a start. The hint sits directly below the field, so a screen reader reads it next.

- [ ] **Step 5: The phone's month read uses the same as-of day**

In `apps/mobile/src/lib/bearing-panel.ts`:
- Extend the `@finance/core/savings-goals` import with `buildGoalRunningTotals, earliestGoalStart, EMPTY_GOAL_LEDGER, goalTotalsAsOf`.
- Add `getGoalLedger,` to its `@/lib/queries` import.
- Ensure `todayIsoLocal` is imported from `@finance/core/constants`.
- In the month-read detail function, after the `await Promise.all([...])` that fetches `goals`, add:

```ts
  // Stopped where the web stops it, or the stored read's digest differs
  // between the two clients.
  const goalsAsOf = goalTotalsAsOf(year, month, todayIsoLocal());
  const goalStart = earliestGoalStart(goals);
  const goalLedger =
    goalStart && goalStart <= goalsAsOf
      ? await getGoalLedger(userId, goalStart, goalsAsOf)
      : EMPTY_GOAL_LEDGER;
```

- Replace:

```ts
    goals: buildSavingsGoalProgress(
      goals,
      figures.summary.savingsBreakdown,
      figures.summary.savings,
    ),
```

with:

```ts
    goals: buildSavingsGoalProgress(
      goals,
      buildGoalRunningTotals(goals, goalLedger, figures.templates, goalsAsOf),
    ),
```

- [ ] **Step 6: Gates**

Run: `pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo lint --max-warnings 0`
Expected: both pass.

- [ ] **Step 7: Check on a phone against the local stack**

Point the app at the local stack: `EXPO_PUBLIC_SUPABASE_URL=http://<WSL IP>:54321` and `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>` in `apps/mobile/.env.local`, restoring the originals afterwards. Use the account from Task 7. Expected:
- Plan's goal ring shows the same total as the web.
- A goal added on the phone with a start date in the past counts savings since then.
- Open this month's read panel on the Bearing: it does not say the stored read is out of date when the web wrote it.

- [ ] **Step 8: Commit**

```bash
npx prettier --write apps/mobile/src/lib/queries.ts apps/mobile/src/lib/mutations.ts "apps/mobile/src/app/(tabs)/planning.tsx" apps/mobile/src/lib/bearing-panel.ts
git add apps/mobile/src/lib/queries.ts apps/mobile/src/lib/mutations.ts "apps/mobile/src/app/(tabs)/planning.tsx" apps/mobile/src/lib/bearing-panel.ts
git commit -m "$(cat <<'EOF'
Show each savings goal's running total on the phone

The phone reads the same ledger window and counts it with the same core
function as the web, so Plan agrees across clients and the month read's facts
digest matches. A new goal can say where counting starts.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Income recurring templates can be opened from Charges

**Files:**
- Modify: `apps/web/components/finance/RecurringView.tsx:47-64,213,232,489`
- Modify: `apps/mobile/src/app/(tabs)/recurring.tsx:51-68`
- Modify: `apps/mobile/src/components/RecurringFormModal.tsx:68-71`
- Modify: `packages/core/src/i18n/messages/en.ts`, `fr.ts` (`charges` block)

**Interfaces:**
- Consumes: `allocation.income` (exists), `rollUpRecurring` (unchanged).
- Produces: i18n key `charges.perMonthSuffix`. Group type is now `CategoryType` on both clients.

- [ ] **Step 1: Messages**

In `en.ts`, in the `charges` block after `perMonth: "Per month",`, add:

```ts
    /** After a group's monthly figure: "€1,240 / mo". */
    perMonthSuffix: " / mo",
```

In `fr.ts`, in the `charges` block at the same position:

```ts
    perMonthSuffix: " / mois",
```

- [ ] **Step 2: Web — an Income group, first**

In `apps/web/components/finance/RecurringView.tsx`, replace:

```tsx
type AllocType = Exclude<CategoryType, "income">;

const GROUP_ORDER: AllocType[] = ["expense", "savings", "investment"];
```

with:

```tsx
/**
 * Income first: it is what the other three are paid from, and the header
 * reads the same way — income, then what is committed and set aside.
 */
const GROUP_ORDER: CategoryType[] = [
  "income",
  "expense",
  "savings",
  "investment",
];
```

Change `groupLabels` to return `Record<CategoryType, string>` with an added first entry `income: t("allocation.income"),`, and update its doc comment's "three kinds" to "four kinds". Replace every remaining `AllocType` in the file with `CategoryType` (`GroupCard`'s `type` prop, `defaultTab`, `tabOverride`). In `GroupCard`, replace `<span className="text-xs"> / mo</span>` with:

```tsx
            <span className="text-xs">{t("charges.perMonthSuffix")}</span>
```

and add `const t = useT();` at the top of `GroupCard`. On the desktop grid, change `md:grid-cols-2 lg:grid-cols-3` to `md:grid-cols-2`, so four groups sit two by two.

- [ ] **Step 3: Phone — an Income group, and income selectable in the form**

In `apps/mobile/src/app/(tabs)/recurring.tsx`, replace:

```tsx
/** Recurring only covers allocations; income has no recurring template. */
type AllocType = Exclude<CategoryType, "income">;

const GROUP_ORDER: AllocType[] = ["expense", "savings", "investment"];
```

with:

```tsx
/** Income first, as on the web: it is what the other three are paid from. */
const GROUP_ORDER: CategoryType[] = [
  "income",
  "expense",
  "savings",
  "investment",
];
```

Give `groupLabels` the return type `Record<CategoryType, string>` and add `income: t("allocation.income"),` first. Replace the remaining `AllocType` uses with `CategoryType`.

In `apps/mobile/src/components/RecurringFormModal.tsx` replace:

```tsx
  const groups = useMemo(
    () => groupCategoriesByType(categories, { excludeTypes: ["income"] }),
    [categories],
  );
```

with:

```tsx
  // Income included, as on the web: a salary is a recurring template too,
  // and one opened from the Income group has to find its category here.
  const groups = useMemo(
    () => groupCategoriesByType(categories),
    [categories],
  );
```

- [ ] **Step 4: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint --max-warnings 0 . && pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo lint --max-warnings 0 && pnpm check:reachability`
Expected: all pass.

- [ ] **Step 5: Check in both clients**

Web `/recurring`: with an income template (create one with an income category), an Income card appears first on desktop and the Income toggle first on a narrow window. Pressing the income row opens the form with the income category selected; saving an amount change updates the Income tile. The group figure's suffix reads "/ mois" in French.
Phone: the Income chip is first; its template opens in the form with its category shown; saving works.

- [ ] **Step 6: Commit**

```bash
npx prettier --write apps/web/components/finance/RecurringView.tsx "apps/mobile/src/app/(tabs)/recurring.tsx" apps/mobile/src/components/RecurringFormModal.tsx packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts
git add apps/web/components/finance/RecurringView.tsx "apps/mobile/src/app/(tabs)/recurring.tsx" apps/mobile/src/components/RecurringFormModal.tsx packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts
git commit -m "$(cat <<'EOF'
List income recurring templates in Charges, first

A salary could be created as a recurring template and was counted in the
header, but no group listed it, so it could never be opened again. Income is
now the first group on both clients, and the phone's form offers income
categories. The per-month suffix is translated.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Web — a reset link leads to choosing a new password

**Files:**
- Create: `apps/web/lib/auth/next-path.ts`
- Test: `apps/web/lib/auth/next-path.test.ts`
- Modify: `apps/web/app/auth/callback/route.ts:9-21`
- Create: `apps/web/app/auth/confirm/route.ts`
- Modify: `packages/core/src/validations/finance.ts:198-201`
- Test: `packages/core/src/validations/password.test.ts` (create)
- Create: `apps/web/app/(auth)/reset/new/page.tsx`
- Create: `apps/web/components/auth/NewPasswordForm.tsx`
- Modify: `apps/web/app/(auth)/reset/page.tsx`, `apps/web/components/auth/ResetPasswordForm.tsx`
- Modify: `packages/core/src/i18n/messages/en.ts`, `fr.ts` (`auth` and `errors` blocks)

**Interfaces:**
- Consumes: `createClient()` (`@/lib/supabase/server`, server) and `createClient()` (`@/lib/supabase/client`, browser); `getAuthUser()` (`@/lib/auth/get-user`); `supabase.auth.verifyOtp({ type: "recovery", token_hash })` (supabase-js 2.108, `VerifyTokenHashParams`); `supabase.auth.updateUser({ password })`.
- Produces:
  - `sanitizeNextPath(raw: string | null, fallback: string): string` and `confirmRedirect(input: { verified: boolean; next: string | null }): string` from `apps/web/lib/auth/next-path.ts`.
  - `newPasswordSchema` (`{ password, confirm }`) and `resetRequestSchema` (`{ email }`) from `@finance/core/validations/finance`.
  - Routes `/auth/confirm` and `/reset/new`.
  - i18n keys under `auth`: `newPasswordHeading`, `newPasswordBody`, `newPassword`, `confirmNewPassword`, `saveNewPassword`, `savingNewPassword`, `passwordChanged`, `openLedger`, `resetLinkExpired`, `resetNeedsLink`, `resetFinishOnWeb` (the last one used by Task 11). Under `errors`: `passwordsDiffer`, `invalidEmail`.

Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before Step 5.

- [ ] **Step 1: Write the failing redirect tests**

Create `apps/web/lib/auth/next-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { confirmRedirect, sanitizeNextPath } from "./next-path";

describe("sanitizeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(sanitizeNextPath("/reset/new", "/bearing")).toBe("/reset/new");
  });

  it.each([
    ["missing", null],
    ["protocol-relative", "//evil.example"],
    ["absolute", "https://evil.example/reset"],
    ["backslash", "/\\evil.example"],
    ["relative", "reset/new"],
  ])("falls back for a %s path", (_label, raw) => {
    expect(sanitizeNextPath(raw, "/bearing")).toBe("/bearing");
  });
});

describe("confirmRedirect", () => {
  it("sends a verified recovery to the new-password page by default", () => {
    expect(confirmRedirect({ verified: true, next: null })).toBe("/reset/new");
  });

  it("honours a safe next path", () => {
    expect(confirmRedirect({ verified: true, next: "/reset/new" })).toBe(
      "/reset/new",
    );
  });

  it("sends an expired or reused link back to the reset form, saying so", () => {
    expect(confirmRedirect({ verified: false, next: "/reset/new" })).toBe(
      "/reset?error=link_expired",
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter web exec vitest run lib/auth/next-path.test.ts`
Expected: FAIL, `Failed to resolve import "./next-path"`.

- [ ] **Step 3: Implement**

Create `apps/web/lib/auth/next-path.ts`:

```ts
/**
 * Where an auth link may send the reader next.
 *
 * Only a same-origin path ("/foo"), never "//host", an absolute URL or a
 * backslash trick, so a crafted link cannot bounce a freshly signed-in reader
 * to somebody else's site.
 */
export function sanitizeNextPath(raw: string | null, fallback: string): string {
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
  ) {
    return raw;
  }
  return fallback;
}

/**
 * Where the confirm route sends a reset link.
 *
 * A verified link goes on to choosing a new password. One that has expired or
 * was already used goes back to the reset form with a sentence saying so,
 * rather than to the sign-in page, whose "link expired" message offers no way
 * to ask for another.
 */
export function confirmRedirect({
  verified,
  next,
}: {
  verified: boolean;
  next: string | null;
}): string {
  if (!verified) {
    return "/reset?error=link_expired";
  }
  return sanitizeNextPath(next, "/reset/new");
}
```

- [ ] **Step 4: Run them to see them pass; point the callback at the shared helper**

Run: `pnpm --filter web exec vitest run lib/auth/next-path.test.ts`
Expected: PASS.

In `apps/web/app/auth/callback/route.ts` delete the local `sanitizeNextPath` function, add `import { sanitizeNextPath } from "@/lib/auth/next-path";`, and change `const next = sanitizeNextPath(searchParams.get("next"));` to `const next = sanitizeNextPath(searchParams.get("next"), "/bearing");`.

- [ ] **Step 5: The confirm route**

Create `apps/web/app/auth/confirm/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmRedirect } from "@/lib/auth/next-path";

/**
 * Where a password-reset email lands.
 *
 * The email carries a one-time token hash rather than a PKCE code, so the
 * link works in any browser on any device — including one that never asked
 * for it, which is where people usually read their mail. Verifying it signs
 * the reader in for this one purpose; the next page asks for the new
 * password.
 *
 * Needs the Supabase "Reset password" email template to link here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/new
 * Until it does, links still arrive through /auth/callback, which forwards
 * to the same page when opened in the browser that asked.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  let verified = false;
  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    verified = !error;
    if (error) {
      console.error("Recovery link could not be verified", error.message);
    }
  }

  return NextResponse.redirect(
    `${origin}${confirmRedirect({ verified, next: searchParams.get("next") })}`,
  );
}
```

- [ ] **Step 6: Write the failing schema tests**

Create `packages/core/src/validations/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newPasswordSchema, resetRequestSchema } from "./finance";

describe("newPasswordSchema", () => {
  it("accepts two identical passwords of six or more characters", () => {
    expect(
      newPasswordSchema.safeParse({ password: "abcdef", confirm: "abcdef" })
        .success,
    ).toBe(true);
  });

  it("names the short password", () => {
    const result = newPasswordSchema.safeParse({
      password: "abc",
      confirm: "abc",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.passwordTooShort");
  });

  it("names a mismatch, on the second field", () => {
    const result = newPasswordSchema.safeParse({
      password: "abcdef",
      confirm: "abcdeg",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.passwordsDiffer");
    expect(result.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("resetRequestSchema", () => {
  it("trims and accepts an email", () => {
    expect(resetRequestSchema.parse({ email: " me@example.com " }).email).toBe(
      "me@example.com",
    );
  });

  it("names an address that is not one", () => {
    const result = resetRequestSchema.safeParse({ email: "nope" });
    expect(result.error?.issues[0]?.message).toBe("errors.invalidEmail");
  });
});
```

Run: `pnpm --filter @finance/core exec vitest run src/validations/password.test.ts`
Expected: FAIL, `newPasswordSchema` is not exported.

- [ ] **Step 7: Implement the schemas**

In `packages/core/src/validations/finance.ts`, below `authSchema`, add:

```ts
/** Choosing a new password: the same floor as signing up, typed twice. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(6, "errors.passwordTooShort"),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "errors.passwordsDiffer",
    path: ["confirm"],
  });

/** Asking for a reset link. */
export const resetRequestSchema = z.object({
  email: z.string().trim().email("errors.invalidEmail"),
});
```

Run: `pnpm --filter @finance/core exec vitest run src/validations/password.test.ts`
Expected: PASS.

- [ ] **Step 8: Messages**

In `en.ts`, in the `auth` block, replace `resetBody` with:

```ts
    resetBody:
      "Enter your email address and we will send you a link to choose a new password.",
```

and add after `backToSignIn`:

```ts
    /** The page a reset link leads to. */
    newPasswordHeading: "Choose a new password",
    newPasswordBody:
      "It replaces the old one everywhere you sign in with your email.",
    newPassword: "New password",
    confirmNewPassword: "The same again",
    saveNewPassword: "Save the new password",
    savingNewPassword: "Saving…",
    passwordChanged: "Your password is changed.",
    openLedger: "Open Pluclair",
    resetLinkExpired:
      "That link has expired or was already used. Ask for a new one below.",
    resetNeedsLink:
      "This page opens from the link in a reset email. Ask for a new one if yours has expired.",
    /** On the phone, after asking: the new password is chosen on the web page the email opens. */
    resetFinishOnWeb:
      "Open the link on any device to choose a new password, then sign in here with it.",
```

In `en.ts`, in the `errors` block after `passwordTooShort`, add:

```ts
    passwordsDiffer: "The two passwords are not the same",
    invalidEmail: "That is not an email address",
```

In `fr.ts`, in the `auth` block, replace `resetBody` with:

```ts
    resetBody:
      "Saisissez votre adresse e-mail et nous vous enverrons un lien pour choisir un nouveau mot de passe.",
```

and add after `backToSignIn`:

```ts
    newPasswordHeading: "Choisir un nouveau mot de passe",
    newPasswordBody:
      "Il remplace l'ancien partout où vous vous connectez avec votre e-mail.",
    newPassword: "Nouveau mot de passe",
    confirmNewPassword: "Le même, encore une fois",
    saveNewPassword: "Enregistrer le nouveau mot de passe",
    savingNewPassword: "Enregistrement…",
    passwordChanged: "Votre mot de passe est modifié.",
    openLedger: "Ouvrir Pluclair",
    resetLinkExpired:
      "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous.",
    resetNeedsLink:
      "Cette page s'ouvre depuis le lien d'un e-mail de réinitialisation. Demandez-en un nouveau si le vôtre a expiré.",
    resetFinishOnWeb:
      "Ouvrez le lien sur n'importe quel appareil pour choisir un nouveau mot de passe, puis connectez-vous ici avec lui.",
```

In `fr.ts`, in the `errors` block after `passwordTooShort`, add:

```ts
    passwordsDiffer: "Les deux mots de passe ne sont pas identiques",
    invalidEmail: "Ce n'est pas une adresse e-mail",
```

- [ ] **Step 9: The new-password page**

Create `apps/web/app/(auth)/reset/new/page.tsx`:

```tsx
import { getAuthUser } from "@/lib/auth/get-user";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

/**
 * Choosing a new password, after a reset link signed the reader in.
 *
 * Without a session there is nothing to change, so the form explains where
 * this page is opened from instead of failing on submit.
 */
export default async function NewPasswordPage() {
  const user = await getAuthUser();
  return <NewPasswordForm signedIn={user !== null} />;
}
```

Create `apps/web/components/auth/NewPasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { createClient } from "@/lib/supabase/client";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";
import { newPasswordSchema } from "@finance/core/validations/finance";

export function NewPasswordForm({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "errors.invalidInput");
      return;
    }

    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setChanged(true);
  }

  return (
    <Card.Bezel
      className="w-full max-w-md md:max-w-lg"
      innerClassName="p-6 md:p-8"
    >
      <h1 className="text-center font-head text-2xl md:text-3xl">
        {t("auth.newPasswordHeading")}
      </h1>

      {!signedIn ? (
        <>
          <Text className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.resetNeedsLink")}
          </Text>
          <p className="mt-4 text-center text-sm">
            <Link href="/reset" className="font-medium underline">
              {t("auth.sendResetLink")}
            </Link>
          </p>
        </>
      ) : changed ? (
        <>
          <Text
            role="status"
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            {t("auth.passwordChanged")}
          </Text>
          <Button
            variant="pill"
            size="lg"
            className="mt-6 w-full justify-between"
            render={<Link href="/bearing" />}
          >
            {t("auth.openLedger")}
            <ButtonNub>
              <ArrowRight size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {t("auth.newPasswordBody")}
          </p>
          <form onSubmit={save} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="new-password">
                {t("auth.newPassword")}
              </FormLabel>
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="text-base"
              />
            </div>
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="confirm-password">
                {t("auth.confirmNewPassword")}
              </FormLabel>
              <Input
                id="confirm-password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="text-base"
              />
            </div>
            {error ? (
              <Text role="alert" className="text-center text-sm text-destructive">
                {resolveMessage(t, error)}
              </Text>
            ) : null}
            <Button
              type="submit"
              variant="pill"
              size="lg"
              className="w-full justify-between"
              disabled={pending}
            >
              {pending ? t("auth.savingNewPassword") : t("auth.saveNewPassword")}
              <ButtonNub>
                <ArrowRight size={ICON.md} weight="bold" />
              </ButtonNub>
            </Button>
          </form>
        </>
      )}
    </Card.Bezel>
  );
}
```

`Button` is a base-ui button whose `render` prop swaps the element, the way `app/not-found.tsx` renders a `Link` as a button.

- [ ] **Step 10: The reset form says when a link has expired, and asks to come back to the new page**

In `apps/web/components/auth/ResetPasswordForm.tsx`:
- Add `import { useSearchParams } from "next/navigation";`.
- Inside the component add `const expired = useSearchParams().get("error") === "link_expired";`.
- Change the `redirectTo` to `` `${window.location.origin}/auth/callback?next=/reset/new` `` and replace the comment above it with:

```tsx
      // The confirm route (token hash) is where the email template sends
      // people; until the template changes, the callback forwards to the same
      // new-password page when the link is opened in this browser.
```

- Directly above the `{sent ? (` block, add:

```tsx
      {expired && !sent ? (
        <Text role="alert" className="mt-4 text-center text-sm text-destructive">
          {t("auth.resetLinkExpired")}
        </Text>
      ) : null}
```

In `apps/web/app/(auth)/reset/page.tsx`, wrap the form in `Suspense` (`useSearchParams` needs a boundary), matching the login page:

```tsx
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
```

`apps/web/lib/supabase/middleware.ts` needs no change: its auth routes are `/login` and `/signup` only, so a signed-in reader reaches `/reset/new`.

- [ ] **Step 11: Gates**

Run: `pnpm --filter @finance/core exec tsc --noEmit && pnpm --filter @finance/core test && pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint --max-warnings 0 . && pnpm --filter web test`
Expected: all pass. `pnpm check:reachability` may report `auth.resetFinishOnWeb` unused until Task 11; run it after Task 11.

- [ ] **Step 12: Check against the local stack**

The local stack's emails go to Inbucket (Mailpit) at `http://<WSL IP>:54324`. To test the token-hash template locally, add to `supabase/config.toml`:

```toml
[auth.email.template.recovery]
subject = "Reset your Pluclair password"
content_path = "./supabase/templates/recovery.html"
```

and create `supabase/templates/recovery.html`:

```html
<h2>Reset your password</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/new">
    Choose a new password
  </a>
</p>
```

Then:
1. Run `npx supabase stop && npx supabase start`.
2. With the web dev server on the local stack (Task 7 Step 9), request a reset for the test account.
3. Open the email in Mailpit, copy the link, and open it in a *different* browser. Expected: `/reset/new` shows the form. Mismatched passwords show "The two passwords are not the same". Saving shows the success state, and signing in with the new password works.
4. Open the same link again. Expected: `/reset` with "That link has expired or was already used".
5. Open `/reset/new` signed out. Expected: the "opens from the link" sentence and a link to `/reset`.

Keep the `config.toml` template section and `supabase/templates/recovery.html` in the commit. They make the local stack behave like production once the dashboard template changes.

- [ ] **Step 13: Commit**

```bash
npx prettier --write apps/web/lib/auth/next-path.ts apps/web/lib/auth/next-path.test.ts apps/web/app/auth/callback/route.ts apps/web/app/auth/confirm/route.ts packages/core/src/validations/finance.ts packages/core/src/validations/password.test.ts "apps/web/app/(auth)/reset/new/page.tsx" apps/web/components/auth/NewPasswordForm.tsx "apps/web/app/(auth)/reset/page.tsx" apps/web/components/auth/ResetPasswordForm.tsx packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts supabase/templates/recovery.html
git add apps/web/lib/auth apps/web/app/auth/callback/route.ts apps/web/app/auth/confirm/route.ts packages/core/src/validations/finance.ts packages/core/src/validations/password.test.ts "apps/web/app/(auth)/reset" apps/web/components/auth/NewPasswordForm.tsx apps/web/components/auth/ResetPasswordForm.tsx packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts supabase/config.toml supabase/templates/recovery.html
git commit -m "$(cat <<'EOF'
Make a password reset ask for the new password

The reset link used to sign people in and drop them on the Bearing with the
old password still in place. It now goes through /auth/confirm, which
verifies a one-time token hash and so works on any device, to a page that
asks for the new password twice and saves it. An expired or reused link says
so on the reset form, and the old callback path lands on the same page.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Phone — "Forgot password?"

**Files:**
- Modify: `apps/mobile/src/providers/AuthProvider.tsx:21-31,64-…`
- Modify: `apps/mobile/src/components/auth/AuthForm.tsx:26-50,~186`
- Modify: `apps/mobile/src/app/(auth)/login.tsx`
- Create: `apps/mobile/src/app/(auth)/reset.tsx`

**Interfaces:**
- Consumes: `resetRequestSchema` (`@finance/core/validations/finance`); i18n `auth.forgotPassword`, `auth.resetHeading`, `auth.resetBody`, `auth.sendResetLink`, `auth.sendingResetLink`, `auth.resetSent`, `auth.resetFinishOnWeb`, `auth.backToSignIn`, `auth.email`, `auth.emailAddress`.
- Produces: `AuthContextValue.requestPasswordReset(email: string): Promise<{ error?: string }>`; `AuthFormProps.forgotHref?: Href`; route `(auth)/reset`.

- [ ] **Step 1: The auth provider can ask for a reset**

In `apps/mobile/src/providers/AuthProvider.tsx`, add to `AuthContextValue`:

```tsx
  /**
   * Sends the reset email. The link opens the web page that sets the new
   * password; the phone's PKCE verifier could never reach that browser, so
   * the email carries a token hash instead (see the web's /auth/confirm).
   */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
```

and to the `useMemo` value object, next to `signIn`:

```tsx
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        return error ? { error: error.message } : {};
      },
```

- [ ] **Step 2: The sign-in form links to it**

In `apps/mobile/src/components/auth/AuthForm.tsx`, add to `AuthFormProps`:

```tsx
  /** Where "Forgot password?" leads. Sign-in only. */
  forgotHref?: Href;
```

and to the destructured props. Directly after the password field's closing `</View>` (the `<View className="gap-1.5">` wrapping label, input and reveal button), add:

```tsx
            {forgotHref ? (
              <Link href={forgotHref} asChild>
                <Pressable
                  accessibilityRole="link"
                  hitSlop={8}
                  className="min-h-11 justify-center self-end"
                >
                  <Text className="text-sm underline">
                    {t("auth.forgotPassword")}
                  </Text>
                </Pressable>
              </Link>
            ) : null}
```

In `apps/mobile/src/app/(auth)/login.tsx`, add `forgotHref="/reset"` to `<AuthForm`.

- [ ] **Step 3: The reset screen**

Create `apps/mobile/src/app/(auth)/reset.tsx`:

```tsx
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { Orb } from "@/components/Orb";
import { Blur } from "@/components/ui/Blur";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { RADIUS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { resolveMessage } from "@finance/core/i18n/t";
import { resetRequestSchema } from "@finance/core/validations/finance";

/**
 * Asking for a way back in, on the phone.
 *
 * The same neutral confirmation as the web whether or not the address has an
 * account, so the form cannot be used to learn who is registered. The new
 * password is chosen on the web page the email opens; this screen says so.
 */
export default function ResetScreen() {
  const t = useT();
  const colors = useThemeColors();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send() {
    setMessage(null);
    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "errors.invalidInput");
      return;
    }
    setPending(true);
    const result = await requestPasswordReset(parsed.data.email);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setSentTo(parsed.data.email);
  }

  return (
    <Screen showPrivacyToggle={false} showAccountMenu={false} showLogo={false}>
      <KeyboardAvoidingView
        className="flex-1 justify-center"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="items-center gap-3 pb-8">
          <Orb size="login" />
          <Text className="font-logo text-4xl text-foreground">Pluclair</Text>
        </View>

        <Blur
          style={{
            borderRadius: RADIUS.card,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <View className="items-stretch gap-4 p-5">
            <Text accessibilityRole="header" className="text-center text-2xl font-bold">
              {t("auth.resetHeading")}
            </Text>

            {sentTo ? (
              <View className="gap-3">
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-center text-muted-foreground"
                >
                  {t("auth.resetSent", { email: sentTo })}
                </Text>
                <Text className="text-center text-muted-foreground">
                  {t("auth.resetFinishOnWeb")}
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-center text-muted-foreground">
                  {t("auth.resetBody")}
                </Text>
                <View className="gap-1.5">
                  <Text variant="label">{t("auth.email")}</Text>
                  <Input
                    accessibilityLabel={t("auth.emailAddress")}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    returnKeyType="send"
                    onSubmitEditing={() => void send()}
                    invalid={message !== null}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                {message ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="text-center text-destructive"
                  >
                    {resolveMessage(t, message)}
                  </Text>
                ) : null}
                <Button
                  label={pending ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
                  disabled={pending || !email}
                  onPress={send}
                />
              </>
            )}

            <View className="flex-row justify-center">
              <Link href="/login">
                <Text className="font-bold underline">
                  {t("auth.backToSignIn")}
                </Text>
              </Link>
            </View>
          </View>
        </Blur>
      </KeyboardAvoidingView>
    </Screen>
  );
}
```

The `placeholder="you@example.com"` is copied from `AuthForm`, where it is also a literal; it is an example address, not copy.

The route guard in `apps/mobile/src/app/_layout.tsx` already lets a signed-out reader stay anywhere in `(auth)`, so no change is needed.

- [ ] **Step 4: Gates**

Run: `pnpm --filter mobile exec tsc --noEmit && pnpm --filter mobile exec expo lint --max-warnings 0 && pnpm check:reachability`
Expected: all pass (`auth.resetFinishOnWeb` is now read).

- [ ] **Step 5: Check on a phone against the local stack**

Signed out, open the app. Expected:
- "Forgot password?" sits under the password field and is easy to hit.
- It opens the reset screen. An invalid address shows "That is not an email address".
- A real one shows the neutral confirmation and the "open the link on any device" line.
- The email arrives in Mailpit. Opening its link in a desktop browser leads to `/reset/new`, and the new password then works on the phone.
- VoiceOver/TalkBack reads the heading, the field label, and the confirmation when it appears.

- [ ] **Step 6: Commit**

```bash
npx prettier --write apps/mobile/src/providers/AuthProvider.tsx apps/mobile/src/components/auth/AuthForm.tsx "apps/mobile/src/app/(auth)/login.tsx" "apps/mobile/src/app/(auth)/reset.tsx"
git add apps/mobile/src/providers/AuthProvider.tsx apps/mobile/src/components/auth/AuthForm.tsx "apps/mobile/src/app/(auth)/login.tsx" "apps/mobile/src/app/(auth)/reset.tsx"
git commit -m "$(cat <<'EOF'
Let people who forgot their password ask for a link from the phone

The phone had no way back in for a forgotten password. Sign-in now links to a
reset screen that sends the same email as the web, with the same neutral
confirmation, and says the new password is chosen from the link.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Close Plan 0.1

**Files:**
- Modify: `docs/how-pluclair-works.md` (Known issues, Last updated)

**Interfaces:**
- Consumes: everything above.
- Produces: an up-to-date app guide and a green branch.

- [ ] **Step 1: Every gate on the branch**

Run, from the repository root:

```bash
pnpm --filter @finance/core exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter mobile exec expo customize tsconfig.json && pnpm --filter mobile exec tsc --noEmit
pnpm --filter @finance/core test
pnpm --filter web test
pnpm --filter web exec eslint --max-warnings 0 .
pnpm --filter mobile exec expo lint --max-warnings 0
pnpm check:reachability
npx supabase db reset
for f in supabase/tests/036_soft_delete.test.sql supabase/tests/038_goal_start.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -v ON_ERROR_STOP=1 < "$f" || exit 1; done
```

Expected: every command exits 0.

- [ ] **Step 2: Update the guide's known issues**

In `docs/how-pluclair-works.md`, delete the four lines ending "(fixed in Plan 0.1, …)", and add:

```markdown
- Until the Supabase dashboard's "Reset password" email template links to
  `/auth/confirm` with the token hash, a reset link only works in the browser
  that asked for it, and never from the phone.
- Linting is gated at zero warnings on both apps; a React Compiler finding is
  fixed or suppressed inline with a reason, never wholesale.
- On the phone's month-read route (`POST /api/month-read`, bearer token),
  `gatherMonthFacts` reads most facts with the cookie client, which has no
  session there, so a read asked for from the phone is likely written from
  empty figures. Only `getGoalLedger`, `readCashBalance` and
  `getFulfilledKeys` take the bearer client.
```

Change `Last updated:` to `Phase 0, Plan 0.1 — closed (<today's date>)`.

- [ ] **Step 3: Commit**

```bash
git add docs/how-pluclair-works.md
git commit -m "$(cat <<'EOF'
Close Plan 0.1 in the app guide

The four trust defects are fixed; what remains is the dashboard template
change the password reset depends on.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Hand back**

Report to the user, leading with what they will see:
- Calendar edits keep tags, and the phone calendar edits them.
- Goals show running totals and have a start date.
- Salary-type templates appear first in Charges.
- A reset link asks for a new password, and the phone has "Forgot password?".

Say what is deliberately unchanged: every other figure, every AI output, no flags yet. Then give:
- **The dashboard step only they can do:** in Supabase → Authentication → Emails → "Reset password", set the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/new`, and add `https://pluclair.com/auth/confirm` to Redirect URLs.
- That migration `038` must be applied to the hosted project when merging.
- That Plan 0.2 (feature flags and tag management) is next.

Offer the usual integration choice, leading with merging to `main` and pushing.
