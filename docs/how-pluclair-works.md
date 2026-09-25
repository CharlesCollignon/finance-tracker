# How Pluclair works

The working guide to the app as it is today: what each part is, where each
figure is computed, and what is known to be wrong. Written for whoever works
on the repository next, human or agent. Every phase of
`docs/plans/PLUCLAIR_UPGRADE_PLAN.md` updates it before it closes.

Last updated: Phase 0, Plan 0.1 — closed (2026-09-25).

## Shape

| Part            | What it is                                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`      | Next.js 16.2 App Router. Server components read Supabase with the user's cookie session; server actions write.                                                                                                                     |
| `apps/mobile`   | Expo 57 with expo-router and NativeWind, dark only. Reads and writes Supabase directly under RLS; calls the web app for the month read (`POST /api/month-read`) and a bank refresh (`POST /api/bank/refresh`) with a bearer token. |
| `packages/core` | Pure TypeScript shared by both apps and shipped to them as source: every calculation, every zod schema, every string (`src/i18n/messages/en.ts`, `fr.ts`).                                                                         |
| `supabase/`     | Migrations `001`–`038`, assertion scripts in `tests/`, one edge function (`delete-account`).                                                                                                                                       |

Vocabulary is fixed by `CONTEXT.md`; product commitments by
`apps/web/PRODUCT.md`; visual rules by `apps/web/DESIGN.md` and
`apps/mobile/DESIGN.md`.

## Sections

| Section                | Web route                               | Phone screen                                                             |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Bearing                | `/bearing`                              | `(tabs)/index`                                                           |
| Ledger — list          | `/transactions`                         | `(tabs)/transactions`                                                    |
| Ledger — calendar      | `/calendar`                             | `(tabs)/calendar`                                                        |
| Ledger — by category   | `/history`                              | none                                                                     |
| Charges                | `/recurring`                            | `(tabs)/recurring`                                                       |
| Plan                   | `/budgets`                              | `(tabs)/planning`                                                        |
| Wallets — positions    | `/investments`                          | `(tabs)/investments`                                                     |
| Wallets — look-through | `/investments/look-through`             | none                                                                     |
| Categories             | `/categories`                           | `categories`                                                             |
| Import (CSV)           | `/import`                               | `import`                                                                 |
| Welcome                | `/welcome`                              | `onboarding`                                                             |
| Profile                | `/profile`                              | `(tabs)/profile`                                                         |
| Sign in, sign up       | `/login`, `/signup`                     | `(auth)/login`, `(auth)/signup`                                          |
| Password reset         | `/reset`, `/auth/confirm`, `/reset/new` | `(auth)/reset` (the new password is set on the web page the email opens) |

## Where each figure is computed

| Figure                                                | Core module                                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Monthly summary and its `current` / `month_end` views | `monthly-summary.ts`, `budget.ts`                                                                                                            |
| Month close, Kept, Unrecorded spending                | `month-close.ts` (closes in `month_closes`; reading day in `month_close_settings.close_day`, default 5)                                      |
| Forward projection, runway                            | `projection.ts`                                                                                                                              |
| Bearing cards and tiles                               | `bearing-cards.ts`, `bearing-tiles.ts`, `bearing-facts.ts`                                                                                   |
| Savings goal progress                                 | `savings-goals.ts` — a running total from the goal's `starts_on` to today, by the same counting rule as the monthly summary's `current` view |
| Spending caps                                         | `budget-limits.ts`                                                                                                                           |
| Category findings                                     | `category-findings.ts`                                                                                                                       |
| PEA ceiling and five-year date                        | `pea.ts`                                                                                                                                     |
| Fund costs, look-through, target trades               | `fund-costs.ts`, `look-through.ts`, `look-through-target.ts`                                                                                 |
| Money-weighted return                                 | `xirr.ts`, `investment-returns.ts`                                                                                                           |

## AI features

Mistral, called only from the web server (the phone goes through
`/api/month-read`). The model never writes a figure: it names a fact by id and
the app substitutes its own value; `verify*` functions in core reject or trim
anything else. One model for every feature (`MISTRAL_MODEL`, else
`mistral-medium-latest`).

| Feature                                             | Web entry                               | Quota                                              |
| --------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| Month read                                          | `lib/month-read/`                       | 5 per month written about                          |
| Category read                                       | `lib/category-read/`                    | 10 per calendar month                              |
| Finding ordering                                    | `lib/category-selection/`               | 5 per calendar month                               |
| Wallet read                                         | `lib/wallet-read/`                      | 5 per calendar month, refused when nothing changed |
| Instrument reading (web search, then transcription) | `lib/instrument-reading/`, nightly cron | 40 per calendar month                              |

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
- Migration `038` (`savings_goals.starts_on`) has not yet been executed against a local stack; it must pass `supabase/tests/038_goal_start.test.sql` after `supabase db reset` before this branch merges or reaches the hosted project.
- Sign-in and sign-up still show Supabase's own error text, which is English; the reset-request and new-password screens map error codes to catalogue keys (`packages/core/src/auth-errors.ts`, `apps/web/lib/auth/new-password-error.ts`).
- `writesAFigure` (`packages/core/src/month-read.ts`) knows English number words only; a French spelled-out quantity would pass. Digits are always caught.
- The Wallets page's fund-cost card and the look-through page can show different annual costs: only the look-through falls back to the shortlist's charge hints.
- `packages/core/src/types/database.ts` is maintained by hand and does not list `deleted_at` (migration `036`).
- Dead schema: `user_preferences.bearing_pins` and the `bearing_arrangements` table have no readers.
- The `delete-account` edge function deletes a fixed list of older tables and relies on `on delete cascade` for the rest.
- The phone has no By category view, no look-through and no wallet read.
