# How Pluclair works

The working guide to the app as it is today: what each part is, where each
figure is computed, and what is known to be wrong. Written for whoever works
on the repository next, human or agent. Every phase of
`docs/plans/PLUCLAIR_UPGRADE_PLAN.md` updates it before it closes.

Last updated: Plan du quotidien, phase 1 (2026-10-08;
`docs/plans/EVERYDAY_PLAN.md`).

## Shape

| Part            | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`      | Next.js 16.2 App Router. Server components read Supabase with the user's cookie session; server actions write.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/mobile`   | Expo 57 with expo-router and NativeWind, dark only. Reads and writes Supabase directly under RLS; calls the web app for the month read (`POST /api/month-read`) and a bank refresh (`POST /api/bank/refresh`) with a bearer token.                                                                                                                                                                                                                                                                                                                                 |
| `packages/core` | Pure TypeScript shared by both apps and shipped to them as source: every calculation, every zod schema, every string (`src/i18n/messages/en.ts`, `fr.ts`).                                                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/data` | The Supabase reads and writes both apps make, written once and handed the caller's client (`Db`): recurring templates and occurrences, transactions (`ledger`, `month-ledger`, `history`), deletes and their undo (`deletions`), categories and their seeding, fulfilment, the month close, the month's balance, the bank's balance, the review inbox (`bank-inbox`), positions and wallet plans, instrument readings, savings accounts, properties and their loans (`properties`), preferences, the weekly recap, delete-all. `pnpm --filter @finance/data test`. |
| `supabase/`     | Migrations `001`–`058`, assertion scripts in `tests/`, one edge function (`delete-account`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Vocabulary is fixed by `CONTEXT.md`; product commitments by
`apps/web/PRODUCT.md`; visual rules by `apps/web/DESIGN.md` and
`apps/mobile/DESIGN.md`.

## Sections

| Section                | Web route                                | Phone screen                                                             |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Bearing                | `/bearing`                               | `(tabs)/index`                                                           |
| Ledger — list          | `/transactions`                          | `(tabs)/transactions`                                                    |
| Ledger — calendar      | `/calendar`                              | `(tabs)/calendar`                                                        |
| Ledger — by category   | `/history`                               | none                                                                     |
| Charges                | `/recurring`                             | `(tabs)/recurring`                                                       |
| Plan                   | `/plan`                                  | `(tabs)/planning`                                                        |
| Wallets — positions    | `/investments`                           | `(tabs)/investments`                                                     |
| Wallets — look-through | `/investments/look-through`              | none                                                                     |
| Property — list        | `/property` (flag `property.track`)      | `(tabs)/property` (same flag)                                            |
| Property — one         | `/property/[id]` (flag `property.track`) | `property/[id]`, pushed over the tabs                                    |
| Categories             | `/categories`                            | `categories`                                                             |
| Import (CSV, OFX)      | `/import`                                | `import`                                                                 |
| Welcome                | `/welcome`                               | `onboarding`                                                             |
| Profile                | `/profile`                               | `(tabs)/profile`                                                         |
| Sign in, sign up       | `/login`, `/signup`                      | `(auth)/login`, `(auth)/signup`                                          |
| Password reset         | `/reset`, `/auth/confirm`, `/reset/new`  | `(auth)/reset` (the new password is set on the web page the email opens) |

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

| Kind        | What                                                                                                      | Sent by                   | Key                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `recap`     | Monday: last week, the month so far, still to come                                                        | notify cron, Mondays      | `recap:<monday>`                                                                                                            |
| `overdraft` | The balance dips below zero on a day ahead                                                                | notify cron               | `overdraft:<month>`                                                                                                         |
| `close`     | The reading day; a month a bank closed                                                                    | notify cron; refresh cron | `close:` / `closed:`                                                                                                        |
| `bigCharge` | Tomorrow, a charge over twice the usual, or yearly                                                        | notify cron               | `big-charge:<tomorrow>`                                                                                                     |
| `arrived`   | Movements that look like a planned charge arrived                                                         | notify cron               | `arrived:<day>`                                                                                                             |
| `review`    | New bank rows waiting for a category                                                                      | refresh cron              | `bank-review:<day>`                                                                                                         |
| `milestone` | A new milestone passed since the last one celebrated                                                      | notify cron               | `milestone:<amount>`                                                                                                        |
| `property`  | Half a loan repaid, its last payment, half a home the user's; a home's new estimate after a DVF half-year | notify cron; market cron  | `property:half:<loan>`, `property:last:<loan>`, `property:equity-half:<property>`, `property:market:<property>:<half-year>` |
| `monthOpen` | A new month has opened                                                                                    | notify cron               | `month-open:<month>`                                                                                                        |
| `bank`      | The connection needs renewing or has stopped                                                              | notify cron               | `bank-consent:`, `bank-expired:`, `bank-paused:`                                                                            |

The messages are built in `packages/core/src/push-messages.ts`,
`push-digest.ts` and `weekly-recap.ts`; the figures behind them come from the
same `@finance/data` reads the screens use (`month-balance`, `weekly-recap`,
`month-close`), so a push and the screen it opens agree. The overdraft
warning only speaks on a balance read from the bank or carried from a close.

Permission is offered once, in context: on the toast that confirms the
first transaction saved from the add sheet, while the browser or the phone
has not been asked yet (`shouldOfferPush` in `lib/push-client.ts`,
`shouldOfferReminders` in the phone's `lib/notifications.ts`). Profile, and
the phone's Récurrents, still turn it on by hand.

A phone with a push token gets everything from the server and schedules
nothing itself; one without (Expo Go, no project id) falls back to local
reminders for its charges and the month opening, under the same switches
(`bigCharge` and `monthOpen`).

A property's moments (`property-moments.ts`) are a change, not a state: a
loan's half, its last payment and half a home the user's (its loans owing
half its value or less, through the payments, at today's estimate) count
for a month after the day, so a loan
that passed half before the app knew it is not news, and a new estimate only
when a reading's last sale reaches a half-year the reading before did not —
twice a year at most, since DVF grows twice a year. The market cron runs on
Mondays at 09:00 UTC, after the quiet hours: a held estimate would be lost,
since the next reading is no longer new. The `property` switch is shown only
to an account with `property.track` (`shownNotificationKinds`), and a tapped
one opens the property on the phone too (`push-routes.ts`). On the loan's
card, the moment is a gold pill that pops the first time a device sees it
(`use-moment-seen.ts` on the web, `lib/moments.ts` on the phone).

The recap says, of last week, what changed in the subscriptions too: a price
that went up, a new one, one that stopped, two of a kind
(`watchSubscriptions`, worked out from the year of rows the recap already
reads, no push of its own). Récurrents lists them all under « Abonnements »,
with what they cost a month and a year.

The recap is also a card on Le point, Monday to Wednesday, until « Vu »
(`dismissed_prompts`, `recap:<monday>`); the `recap` switch hides both. On
the web the card offers the Monday push to a browser that has not taken
notifications yet. The milestone already celebrated on the Plan is the
account's (`user_preferences.milestone_seen`), so every device agrees; the
push for a new one (`@finance/data/plan-wealth`, the Plan's own figure at
today's prices) leaves it unmarked, so the Plan still shows it as new.

## Where each figure is computed

| Figure                                                                                                      | Core module                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Monthly summary and its `current` / `month_end` views                                                       | `monthly-summary.ts`, `budget.ts`                                                                              |
| « Il vous reste » (left to spend) until the next pay day, and per day                                       | `left-to-spend.ts`; read by `@finance/data/left-to-spend` (next month's line too when the pay day falls in it) |
| « Puis-je me permettre ? »                                                                                  | `afford.ts`                                                                                                    |
| Le point's setup cards, one at a time                                                                       | `setup-steps.ts`                                                                                               |
| The Journal's search: words in a note or a category name, or an amount                                      | `ledger-search.ts`; every month through `@finance/data/ledger-search`                                          |
| Subscriptions: what is paid every month or year, a price up, a new one, one stopped, two of a kind          | `subscription-watch.ts`; read by `@finance/data/subscriptions`, and in the recap (`weekly-recap.ts`)           |
| Month close, Kept, Unrecorded spending                                                                      | `month-close.ts` (closes in `month_closes`; reading day in `month_close_settings.close_day`, default 5)        |
| Forward projection, runway                                                                                  | `projection.ts`                                                                                                |
| Plan: what if, milestones, cushion, long view (2026 French tax)                                             | `future-plan.ts` (rates in `FRENCH_TAX_2026`; revisit each January and August)                                 |
| Savings accounts: balance, rate, interest, ceilings (2026)                                                  | `savings-accounts.ts` (rates in `FRENCH_SAVINGS_2026`; revisit each February and August)                       |
| Bearing cards and tiles                                                                                     | `bearing-cards.ts`, `bearing-tiles.ts`, `bearing-facts.ts`                                                     |
| Category findings                                                                                           | `category-findings.ts`                                                                                         |
| PEA ceiling and five-year date                                                                              | `pea.ts`                                                                                                       |
| A loan's schedule, outstanding principal, cost                                                              | `loan-schedule.ts`                                                                                             |
| A property's estimated value, net value, gain, principal repaid                                             | `property.ts` (and `valueSourceLine`, the sentence that says where a value comes from)                         |
| Net worth; a property at the long view's horizon (2026 tax on a sale's gain); the loans still running       | `property-future.ts` (rates in `FRENCH_PROPERTY_GAINS_2026`; revisit each January)                             |
| A property's market reading (DVF sales, 500 m or the commune)                                               | `market-reading.ts` (rules in `MARKET_RULES`)                                                                  |
| A let property's month: rent, charges, loans, what it leaves, gross and net yield; the DPE letting calendar | `rental.ts` (dates in `FRENCH_LETTING_2026`; revisit each January)                                             |
| A let property's asking rents (ANIL « Carte des loyers »)                                                   | `rent-reference.ts` (cautions in `ANIL_RULES`)                                                                 |
| The Notaires–INSEE index, and which series carries a place                                                  | `price-index.ts` (series in `seriesFor`)                                                                       |
| Fund costs, look-through, target trades                                                                     | `fund-costs.ts`, `look-through.ts`, `look-through-target.ts`                                                   |
| Money-weighted return                                                                                       | `xirr.ts`, `investment-returns.ts`                                                                             |

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

## Property value

A property's estimated value is the user's own figure when they gave one;
else its market reading times its area; else its purchase price carried by
the Notaires–INSEE index; else its purchase price (`estimatedValue`). The
reading is made on the web server (`lib/property-market/read.ts`) from
Etalab's DVF files for the commune — three years, widened to five for a thin
one — and kept on the property's own row (`property_market_readings`,
migration 050; per property rather than shared by place, so no session can
learn where others own homes). It is read when a property is added or
changed on the web (with an 8-second wait, after which the cron's to
read), when the phone asks `POST /api/property/market`, and weekly by
`/api/cron/market` (Mondays 09:00 UTC), which also refreshes the index
(`housing_price_index`, readable by every signed-in session, written only by
the service role) and re-reads readings a month old. Addresses are found
through the IGN geocoder from the server (`/api/property/addresses` for the
phone), so IGN never sees a user's IP.

A loan's payment is one recurring template holding the payment and its
insurance — or two, when its insurance is debited apart
(`property_loans.insurance_separate` and `insurance_template_id`, migration
052): one for each debit, so each bank movement confirms its own. On the
loan's card each debit says whether its template follows the schedule
(a euro of room, and the loan's end) and offers the user's monthly expense
templates of about its amount to link — « C'est celle-ci ? », five per cent
or a euro and a half, as a bank movement is matched (`templatesLike`). « La
mettre à jour » sets each to its own amount and the loan's end. The loan's
cost, the payment's split and a let property's month count the insurance
once, from the schedule.

A let property (usage let unfurnished or furnished) has a « Location »
section. Its rent is the income templates attached to it — « Ajouter le
loyer » writes one, monthly, under « Loyers perçus » — its charges the
expense ones, and its loans their schedule, so a loan's payment counts once
(`rentalFigures`). Its asking rents are read with its sales, from the ANIL's
« Carte des loyers » on data.gouv.fr (the latest edition's national table,
kept a day in the server's memory), and kept on its own row
(`property_rent_references`, migration 051) only where the ANIL's cautions
allow: 30 listings in the commune and an adjusted R² of 0.5. Its DPE class
(`properties.energy_class`) gives the letting calendar (`lettingRule`).

On the Plan, with `property.track`, two cards sit beside the savings and
investments and never in them: net worth today (the long view's accounts,
plus the properties' estimated value, less what their loans owe, and when
each loan ends), and the homes at the long view's horizon (each grown at its
`properties.yearly_growth`, 2 % when unset, less what is still owed and the
tax a sale would pay; `propertyGainTax`). The milestones and the long view's
monthly income leave property out.

## Le point, first

« Il vous reste » is one line of the month in progress's balance card, on
both apps, between its two figures and its curve (`LeftToSpendLine`): what
the Courant accounts hold, less the charges due before the next pay day, at
the lowest point until then, less the marge's share of those days. The pay
day is the next payment of the largest recurring income; with none, the
month's end. Tapping the line opens « Puis-je me permettre ? », which saves
nothing, with « Comment c'est calculé ? » under it.

It needs a balance. Without a bank or a close, the setup card asks for one:
typed once, it is a reading (`balance_readings`, migration 057) that anchors
the month until a close is newer (`readMonthBalance`), and the overdraft
warning speaks on it. The cards come one at a time — the bank where it can
be connected, else the balance, the salary, the charges, the first close —
and « Plus tard » puts one away for good (`dismissed_prompts`, `setup:<step>`;
the bank's own `bank-invite:bearing`). The salary and charges cards open the
welcome steps on their own (`/welcome?from=` on the web,
`/onboarding?from=` on the phone). A first visit shows the card, not a row of
empty cards: the balance card waits for something recorded, the spent card
for spending, the card of what is to come for a recurring template.

On the phone, a long press of the icon offers « Ajouter une dépense » and
« Le point » (`plugins/with-quick-actions.js`). Android's open their
`pluclair://` address; on iOS, `modules/quick-actions` hands the pressed one
from the app delegate to the router. `/add` opens the add sheet over Le point
(`?add=1`, read by `QuickAddProvider`). Checked through prebuild and
autolinking only, not on a device yet.

## Audience measurement

Whether the app is used, never what it is used on (migration 058).
`record_activity`, called as the signed-in user, keeps one row per person and
day under a salted SHA-256 of the account (`insights.activity_days`; the salt
and the rows are in a schema the API does not expose), with how many
transactions were added, months closed and « Puis-je me permettre ? » asked
that day. Nothing for an account that turned « Mesure d'audience » off in
Profile (`user_preferences.measure_audience`). The web records a visit from
the app layout, after the response (`after`); the phone when the tabs open
and on each return to the front. Thirteen months, swept by the nightly
cron (`sweep_activity`); deleting the account deletes its rows (a trigger on
`auth.users`). The owner reads `select * from insights.figures;` for day-30
retention, the share of the week's users opening on three days or more, and
the share who closed a month.

## Bank feed

Built and reachable by one account per deployment: the one whose id is
`OPEN_BANKING_OWNER_USER_ID` (`apps/web/lib/bank/client.ts`). Everyone else
enters balances and transactions by hand or imports a CSV. Rows the matcher
would not file wait in the review inbox at `?review=inbox`.

Connecting is a four-step wizard on both apps (`ConnectBankSheet`): the
account at open-banking.io with its price, the bank connected there, the
credentials file downloaded — with the « Clé de chiffrement » trap drawn —
and the file given to Pluclair with the consent. The step reached is kept
for the account among the prompts put away (`bank-wizard:<step>`, only the
latest), so a setup carries on from another device. A refused file goes back
to the step where it is put right (`bankWizardStepFor`): a wrong file to the
download, an account with no bank yet to connecting one.

## Import

A bank's export, CSV or OFX, read on the device and nothing written until
every row is reviewed (`/import`, the phone's `import`). The file is read as
bytes (`decodeStatement`): UTF-8 when valid, Windows-1252 otherwise, which is
what many French banks write. `readStatement` finds a CSV's header as the
first row naming a date and an amount, dropping the account lines some banks
put above it, under whichever delimiter finds one; an OFX's transactions come
in as date, label and signed amount. There are no presets per bank yet: each
waits for a real export, anonymised with `scripts/anonymise-statement.mjs`
and kept in `packages/core/fixtures/statements/`.

## Search

The Journal's search filters the month on screen and, under it, lists the
rows of every other month the same query finds (`searchAllMonths`, a
hundred at most, after a 300 ms pause in the typing). A query looks in the
note — where a bank puts the shop — and the category's name, and, when it
reads as an amount (« 12,30 »), at the amount too. A row from another month
opens that month with the query kept (`?q=` on the web).

## Feature flags

Evaluated in Postgres by `evaluated_feature_flags()` (migration `039`), so
both clients get the same answer: an account's override wins; otherwise a
flag is on when `enabled_by_default` is true or the account was created at or
after `enabled_from`. No session can read the flag tables. The web asks once
per request (`apps/web/lib/flags.ts`); the phone asks the same function
when the account changes and each time it comes back to the foreground
(`hooks/useFlag.ts`; its bank invitation still asks the web, which checks
`bank.connect`). The phone's write announcer treats that RPC as a read
(`READ_RPCS` in `lib/data-version.ts`), or every screen would reload. A flag the
database does not return, or a key this build
does not list (`packages/core/src/flags.ts`), is off.

| Flag             | Gates                                                                                                        | Default |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| `bank.connect`   | Connecting a bank with an open-banking.io credentials file                                                   | off     |
| `property.track` | The Immobilier tab: properties, their loans and their value; on the Plan, net worth and the homes' long view | off     |

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
- The phone's Immobilier screens were run in the Expo web build (adding a
  property with its loan, the list, a property's screen, the chip in
  Récurrents), not on a device. That build needs three local changes to
  start — `"output": "single"`, and a guard each on
  `Appearance.setColorScheme` and `useLastNotificationResponse`, both
  native-only — and draws no button fill, no screen margin and no
  shrinking tab label, on every screen alike; those three are the device's
  to confirm.
- A page with a `loading.tsx` streams, so `notFound()` from it — the
  property pages for an account without `property.track` — draws the app's
  « Page introuvable » under a 200 rather than a 404.
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
  savings accounts, properties and their loans, skips, tags, budgets, goals
  and wallet transfers. It
  leaves month closes and their settings, the review inbox's bank rows,
  confirmed and refused fulfilments, wallet plans, AI reads and proposal
  dismissals. Whether a wipe should take those too is the owner's call.
- The SQL assertion scripts in `supabase/tests/` are run by hand against a
  local stack; CI does not run them.
- The phone's quick actions and their iOS module have not run on a device:
  the Swift in `modules/quick-actions` is compiled only by a native build.
