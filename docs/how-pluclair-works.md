# How Pluclair works

The working guide to the app as it is today: what each part is, where each
figure is computed, and what is known to be wrong. Written for whoever works
on the repository next, human or agent. Every phase of
`docs/plans/PLUCLAIR_UPGRADE_PLAN.md` updates it before it closes.

Last updated: quality plan Phase 2, one codebase (2026-10-02;
`docs/plans/QUALITY_SYNC_ENGAGEMENT_PLAN.md`).

## Shape

| Part            | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`      | Next.js 16.2 App Router. Server components read Supabase with the user's cookie session; server actions write.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/mobile`   | Expo 57 with expo-router and NativeWind, dark only. Reads and writes Supabase directly under RLS; calls the web app for the month read (`POST /api/month-read`) and a bank refresh (`POST /api/bank/refresh`) with a bearer token.                                                                                                                                                                                                                                                                                      |
| `packages/core` | Pure TypeScript shared by both apps and shipped to them as source: every calculation, every zod schema, every string (`src/i18n/messages/en.ts`, `fr.ts`).                                                                                                                                                                                                                                                                                                                                                              |
| `packages/data` | The Supabase reads and writes both apps make, written once and handed the caller's client (`Db`): recurring templates and occurrences, transactions (`ledger`, `month-ledger`, `history`), deletes and their undo (`deletions`), categories and their seeding, fulfilment, the month close, the month's balance, the bank's balance, the review inbox (`bank-inbox`), positions and wallet plans, instrument readings, savings accounts, preferences, the weekly recap, delete-all. `pnpm --filter @finance/data test`. |
| `supabase/`     | Migrations `001`–`048`, assertion scripts in `tests/`, one edge function (`delete-account`).                                                                                                                                                                                                                                                                                                                                                                                                                            |

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
| Plan                   | `/plan`                                 | `(tabs)/planning`                                                        |
| Wallets — positions    | `/investments`                          | `(tabs)/investments`                                                     |
| Wallets — look-through | `/investments/look-through`             | none                                                                     |
| Categories             | `/categories`                           | `categories`                                                             |
| Import (CSV)           | `/import`                               | `import`                                                                 |
| Welcome                | `/welcome`                              | `onboarding`                                                             |
| Profile                | `/profile`                              | `(tabs)/profile`                                                         |
| Sign in, sign up       | `/login`, `/signup`                     | `(auth)/login`, `(auth)/signup`                                          |
| Password reset         | `/reset`, `/auth/confirm`, `/reset/new` | `(auth)/reset` (the new password is set on the web page the email opens) |

## Conventions for a write

- **Where it lives.** A read or write both apps make goes in `packages/data`,
  taking `db` (the caller's Supabase client) and `userId`, validating its own
  input with core's zod schemas. Each app keeps a thin wrapper under its old
  name: `asUser` in `apps/web/lib/actions/as-user.ts` (who is asking, the
  write, then `revalidateApp()` on success) and its twin in the phone's
  `lib/mutations.ts` (no redraw to ask for: the client's fetch announces the
  write).
- **What it returns.** `ActionResult<T>` from `@finance/core/action-result`:
  `success` with an optional `message` and whatever the write reports, or an
  `error` — always a catalogue key or a sentence already in the reader's
  words. Database refusals go through `dbError` (`@finance/data/errors`) and
  auth failures through `signInErrorKey`/`signUpErrorKey`
  (`@finance/core/auth-errors`); Postgres' and Supabase's own English never
  reaches a toast.
- **Types.** The schema's types are generated (`pnpm gen:types` after a
  migration is applied locally) and narrowed in
  `packages/core/src/types/database.ts`.
- **Deletes can be taken back.** A transaction or a category deleted is
  marked (`deleted_at`, migration `036`) and the select policies hide it;
  the delete returns an undo token (`@finance/data/deletions`) that the toast's
  Undo spends through `restore_deletion`, on both apps
  (`useDeletedToast`). Undo also lifts the skip a charge's delete wrote. The
  nightly `/api/cron/sweep` deletes for good what is still marked after 30
  days. Without migration `036` a delete is final and no Undo is offered.
- **Feedback.** Every committed write answers: a toast, and on the phone a
  haptic — success for a save, warning for a delete. Rows a web delete
  removes leave at once (`useOptimistic`) and come back if it fails.

## How every surface stays current

Neither app keeps a client cache; each screen reads what it shows, and a
write anywhere has to reach every screen that shows it.

- **Web.** Every server action ends in `revalidateApp()`
  (`lib/revalidate-paths.ts`), which revalidates the `(app)` route group as a
  layout: every app page, including ones added later, and none of the
  marketing pages. `LiveRefresh` in the app layout covers writes made
  elsewhere: a layout render it did not ask for means this tab wrote, which it
  announces on a BroadcastChannel so other tabs redraw; and a tab coming back
  into view or focus after more than a minute away redraws, which is how the
  phone's and the bank cron's writes reach an open browser.
- **Phone.** The Supabase client and `callWebApi` go through
  `announcingFetch` (`lib/data-version.ts`): a successful write announces the
  data area of the table or route it wrote to. Screens load with
  `useRefreshable(loader, deps, { reads })`; a write to an area a screen reads
  reloads it in place if it is in view, and marks it stale otherwise until it
  is shown again. Coming back from the background, a notification arriving or
  tapped, and the month turning over reload what is in view
  (`hooks/useAppForeground.ts`, `MonthProvider`).
- **Both.** Every query that can pass the server's 1,000-row cap goes through
  `allRows` (`packages/core/src/paging.ts`).

## Notifications

Sent from the web server to browsers (Web Push, VAPID) and phones (Expo
push), by `apps/web/lib/push/deliver.ts`: it drops the kinds the user turned
off (`user_preferences.notification_prefs`, every kind on unless set to
`false`), holds everything in the quiet hours (21:00–08:00 Paris) without
logging it so the next run sends it, and logs each key in `notification_log`
before sending, so nothing is said twice.

| Kind        | What                                               | Sent by                   | Key                                              |
| ----------- | -------------------------------------------------- | ------------------------- | ------------------------------------------------ |
| `recap`     | Monday: last week, the month so far, still to come | notify cron, Mondays      | `recap:<monday>`                                 |
| `overdraft` | The balance dips below zero on a day ahead         | notify cron               | `overdraft:<month>`                              |
| `close`     | The reading day; a month a bank closed             | notify cron; refresh cron | `close:` / `closed:`                             |
| `bigCharge` | Tomorrow, a charge over twice the usual, or yearly | notify cron               | `big-charge:<tomorrow>`                          |
| `arrived`   | Movements that look like a planned charge arrived  | notify cron               | `arrived:<day>`                                  |
| `review`    | New bank rows waiting for a category               | refresh cron              | `bank-review:<day>`                              |
| `monthOpen` | A new month has opened                             | notify cron               | `month-open:<month>`                             |
| `bank`      | The connection needs renewing or has stopped       | notify cron               | `bank-consent:`, `bank-expired:`, `bank-paused:` |

The messages are built in `packages/core/src/push-messages.ts`,
`push-digest.ts` and `weekly-recap.ts`; the figures behind them come from the
same `@finance/data` reads the screens use (`month-balance`, `weekly-recap`,
`month-close`), so a push and the screen it opens agree. The overdraft
warning only speaks on a balance read from the bank or carried from a close.

A phone with a push token gets everything from the server and schedules
nothing itself; one without (Expo Go, no project id) falls back to local
reminders for its charges and the month opening, under the same switches
(`bigCharge` and `monthOpen`).

The recap is also a card on Le point, Monday to Wednesday, until « Vu »
(`dismissed_prompts`, `recap:<monday>`); the `recap` switch hides both. On
the web the card offers the Monday push to a browser that has not taken
notifications yet. The milestone already celebrated on the Plan is the
account's (`user_preferences.milestone_seen`), so every device agrees.

## Where each figure is computed

| Figure                                                          | Core module                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Monthly summary and its `current` / `month_end` views           | `monthly-summary.ts`, `budget.ts`                                                                       |
| Month close, Kept, Unrecorded spending                          | `month-close.ts` (closes in `month_closes`; reading day in `month_close_settings.close_day`, default 5) |
| Forward projection, runway                                      | `projection.ts`                                                                                         |
| Plan: what if, milestones, cushion, long view (2026 French tax) | `future-plan.ts` (rates in `FRENCH_TAX_2026`; revisit each January and August)                          |
| Savings accounts: balance, rate, interest, ceilings (2026)      | `savings-accounts.ts` (rates in `FRENCH_SAVINGS_2026`; revisit each February and August)                |
| Bearing cards and tiles                                         | `bearing-cards.ts`, `bearing-tiles.ts`, `bearing-facts.ts`                                              |
| Category findings                                               | `category-findings.ts`                                                                                  |
| PEA ceiling and five-year date                                  | `pea.ts`                                                                                                |
| Fund costs, look-through, target trades                         | `fund-costs.ts`, `look-through.ts`, `look-through-target.ts`                                            |
| Money-weighted return                                           | `xirr.ts`, `investment-returns.ts`                                                                      |

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

What goes over the wire: aggregates and names the user typed (category and
holding names), the month's category totals, and for the
month in progress the total the day-to-day accounts hold. Never merchants or
individual payments. Instrument reading sends the name, symbol and ISIN of a
held instrument.

## Bank feed

Built and reachable by one account per deployment: the one whose id is
`OPEN_BANKING_OWNER_USER_ID` (`apps/web/lib/bank/client.ts`). Everyone else
enters balances and transactions by hand or imports a CSV. Rows the matcher
would not file wait in the review inbox at `?review=inbox`.

## Feature flags

Evaluated in Postgres by `evaluated_feature_flags()` (migration `039`), so
both clients get the same answer: an account's override wins; otherwise a
flag is on when `enabled_by_default` is true or the account was created at or
after `enabled_from`. No session can read the flag tables. The web asks once
per request (`apps/web/lib/flags.ts`); the phone reads no flag of its own
today (its bank invitation asks the web, which checks `bank.connect`), so it
has no flag reader — add one beside the first flag it needs. A flag the
database does not return, or a key this build
does not list (`packages/core/src/flags.ts`), is off.

| Flag           | Gates                                                      | Default |
| -------------- | ---------------------------------------------------------- | ------- |
| `bank.connect` | Connecting a bank with an open-banking.io credentials file | off     |

Switched with SQL (the dashboard's SQL editor, or the service role):

```sql
-- On for one account
insert into user_feature_flags (user_id, flag_key, enabled)
values ('<account id>', 'bank.connect', true)
on conflict (user_id, flag_key) do update set enabled = excluded.enabled;

-- On for every account created from now on
update feature_flags set enabled_from = now() where key = 'bank.connect';

-- On for everyone
update feature_flags set enabled_by_default = true where key = 'bank.connect';
```

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

Migrations: `npx supabase start`, `npx supabase db reset`, then every
assertion script:
`for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_finance-tracker psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" || break; done`.

## Known issues

- Until the Supabase dashboard's "Reset password" email template links to
  `/auth/confirm` with the token hash, a reset link only works in the browser
  that asked for it, and never from the phone.
- Linting is gated at zero warnings on both apps; a React Compiler finding is
  fixed or suppressed inline with a reason, never wholesale.
- On the phone's month-read route (`POST /api/month-read`, bearer token),
  `gatherMonthFacts` reads most facts with the cookie client, which has no
  session there, so a read asked for from the phone is likely written from
  empty figures. Only `readCashBalance` and `getFulfilledKeys` take the
  bearer client.
- `writesAFigure` (`packages/core/src/month-read.ts`) knows English number words only; a French spelled-out quantity would pass. Digits are always caught.
- The Wallets page's fund-cost card and the look-through page can show different annual costs: only the look-through falls back to the shortlist's charge hints.
- Dead schema: `user_preferences.bearing_pins` and the `bearing_arrangements` table have no readers.
- The `delete-account` edge function deletes a fixed list of older tables and relies on `on delete cascade` for the rest.
- The phone has no By category view, no look-through and no wallet read.
- Budgets, savings goals and tags were removed from both apps in October
  2026; the `budgets`, `savings_goals`, `tags` and `transaction_tags` tables
  and the `tags.manage` flag row stay, unread. Stored month and category
  reads that cited a budget or goal figure show it as gone.
- `/auth/confirm` verifies the recovery token on GET, so a mail provider's
  link scanner can use it up before the reader clicks (Supabase's documented
  pattern; a "Continue" interstitial is the known fix).
- `allRows` (`packages/core/src/paging.ts`) assumes the server's `max_rows`
  is at least 1,000 (the local config and the hosted default); a lower cap
  would truncate silently.
- The web's offline outbox sends one tab at a time, but the server has no
  idempotency key: a tab closed between a save succeeding and the entry
  leaving the queue would send it again on the next drain.
- "Delete all data" first restores every pending deletion (a hidden
  transaction would otherwise keep its category from going), then deletes transactions, templates, categories, positions,
  savings accounts, skips, tags, budgets, goals and wallet transfers. It
  leaves month closes and their settings, the review inbox's bank rows,
  confirmed and refused fulfilments, wallet plans, AI reads and proposal
  dismissals. Whether a wipe should take those too is the owner's call.
- The SQL assertion scripts in `supabase/tests/` are run by hand against a
  local stack; CI does not run them.
- A new milestone is celebrated on the Plan but not pushed: saying it from
  the server would mean pricing every wallet there.
