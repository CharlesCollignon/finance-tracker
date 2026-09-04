# Pluclair

Personal finance app (EUR-centric) — [pluclair.com](https://pluclair.com).
Next.js web client + Expo (React Native) mobile app, sharing one Supabase
backend and domain logic in `packages/core`.

The git monorepo folder may still be named `finance-tracker`; the product
brand is **Pluclair**.

## Monorepo layout

```
finance-tracker/          (repo root)
├── apps/
│   ├── web/          Next.js 16 (desktop + mobile web)
│   └── mobile/       Expo SDK 57 (Android / iOS via Expo Go)
├── packages/
│   └── core/         Shared TypeScript (budget, recurrence, validations…)
└── supabase/         Postgres migrations and RLS policies
```

## Prerequisites

- **Node.js** 20+ (22 recommended for Supabase)
- **pnpm** 11 (`npm install -g pnpm`)
- A **Supabase** project ([supabase.com](https://supabase.com))
- **Mobile only:** [Expo Go](https://expo.dev/go) on your phone (SDK 57)

Apply the database schema once on your Supabase project (SQL editor or
CLI) using the files in `supabase/migrations/`, in order (`001` → `025`).
Optional account deletion from mobile also needs the
`delete-account` Edge Function in `supabase/functions/`.

---

## 1. Install dependencies

From the repository root:

```bash
pnpm install
```

This repo uses a **hoisted** pnpm layout (`nodeLinker: hoisted` in
`pnpm-workspace.yaml`) so Metro and Expo autolinking work correctly.
Do not change that unless you know what you are doing.

---

## 2. Environment variables

### Web (`apps/web`)

Copy the example file and fill in your Supabase values (Dashboard →
Project Settings → API):

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` in dev; `https://pluclair.com` in production |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | “Delete account” on web, and the daily cron jobs |
| `APPLE_TEAM_ID` | optional | Passkeys on iOS — Apple Team ID for AASA |
| `ANDROID_SHA256_FINGERPRINTS` | optional | Passkeys on Android — colon-hex SHA-256 fingerprints |

Google OAuth is configured in the **Supabase dashboard**, not in env files.

### Mobile (`apps/mobile`)

Same Supabase project; **public keys only** (never put the service role
key in the mobile app):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

| Variable | Required | Notes |
|----------|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Same project as the web app |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `EXPO_PUBLIC_WEB_APP_URL` | optional | The web app's origin. Anything needing a server secret — asking the bank for new movements, writing a month read — goes through it. Without it the phone still works; those two buttons are simply absent. |

After changing `.env`, restart Expo with a cleared cache (`-c`).

Deep link scheme: `pluclair://` (see `apps/mobile/app.json`).

---

## 3. Desktop / web

Start the Next.js dev server:

```bash
pnpm dev:web
# or: pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000).

Other web commands (from root):

```bash
pnpm --filter web build    # production build
pnpm --filter web start    # serve production build
pnpm --filter web lint
pnpm --filter web check:supabase   # smoke-check env + categories table
```

### Deploy on Vercel

The Next.js app lives in **`apps/web`**, not the repo root.

In Vercel → Project Settings → Build and Deployment:

- **Root Directory:** `apps/web`
- Enable **Include files outside of the root directory** (for the
  workspace lockfile and `packages/core`).

Set the same env vars as in `apps/web/.env.local`, and for **Production**:

- `NEXT_PUBLIC_SITE_URL=https://pluclair.com`

Domain: attach `pluclair.com` (and optionally `www`) under Project → Domains,
then point Namecheap DNS at the records Vercel shows (usually A `@` →
`10.0.1.2` and CNAME `www` → `cname.vercel-dns.com`).

### Background jobs (Vercel cron)

Five daily jobs are declared in `apps/web/vercel.json`, four of them pointed
at the same refresh route. All run under the service role, so all need
`SUPABASE_SERVICE_ROLE_KEY`, and all refuse to run without `CRON_SECRET` —
Vercel sends it as `Authorization: Bearer <secret>`.

| Route | When | What it does |
|-------|------|--------------|
| `/api/cron/refresh` | 07:00 | Reprices not-yet-due occurrences, then pulls and syncs the bank |
| `/api/cron/notify` | 08:00 | Sends the day's web push digest |
| `/api/cron/refresh` | 12:00, 17:00, 21:00 | Pulls and syncs the bank only |

**Refreshing** is everything that brings the ledger up to date from outside
it. Hobby allows a hundred cron jobs per project but insists each runs at most
once a day, so four separate daily entries at four different hours is how the
app is current four times a day rather than once. Vercel sends the firing
schedule as `x-vercel-cron-schedule`, and the route reads it to decide how
much to do: only the 07:00 run reprices, because quoting every user's
templates against the market is slow and prices move on a scale of days,
while the statement is worth re-reading. A hand-run `curl` sends no such
header and gets the full job.

The two halves fail independently: an unreachable bank does not stop quotes
refreshing, and a rate-limited quote source does not stop the statement being
read.

*Repricing* brings occurrences that are applied but still dated ahead back in
line with their instrument's quote, and refreshes each template's stored
price. It never touches a date that has passed and never creates a
transaction. This is what stops "Apply recurring" from asking about a DCA
every time the market moves.

*The bank sync* asks the bank for anything new, then reads the statement,
files what the user's own history already answers for, and leaves the rest in
the review inbox. It pushes only when the run left something needing a
decision, keyed by the day so it is said once. Needs
`OPEN_BANKING_CREDENTIALS` and `OPEN_BANKING_OWNER_USER_ID`; without them the
step is skipped and the refresh still reprices.

Both answer `200` with a JSON summary of what they did, so a run can be
checked by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://pluclair.com/api/cron/refresh
```

**Notifying** says at most one useful thing a day — a new month, a breached
budget — and needs the VAPID keys as well; without them it no-ops.

### Asking the bank, and how often

Two different calls hide behind the word "sync", and only one of them has a
limit.

Reading open-banking.io's stored statement (`getAccounts`, `getTransactions`)
is a read of our own copy. It reaches no bank, costs nothing, and can be done
as often as anyone likes — but it is only as current as whatever the provider
last fetched on its own schedule.

*Pulling* — the SDK's `syncAll` — is the call that reaches the bank. Its
ceiling is regulatory rather than commercial: under PSD2 an account
information service may read an account **four times a day when the user is
not present**, and **without limit when they are**. So the two kinds are
counted separately:

| Kind | Who | Limit |
|------|-----|-------|
| Attended | Someone pressed refresh | None, beyond a 90-second cooldown so a double-tap is not two round trips |
| Unattended | The cron | Four a day, which is why there are four refresh schedules |

The tally lives in `bank_pulls` (migration 022), one row per user per day,
because a serverless function remembers nothing between invocations and an
in-memory guard would reset on every cold start. The decision itself is in
`packages/core/src/bank-pull.ts` and is unit-tested; `apps/web/lib/bank/pull.ts`
is the plumbing around it.

A refused pull is an ordinary outcome, not an error: the stored statement is
still read, and every screen says how old the figures are. Without migration
022 applied, attended refreshes still work and the unattended run simply does
not pull — which is exactly what it did before any of this existed.

### Closing a month

The app tracks flows — money it was told about — so it cannot see the spending
nobody enters: the restaurant, the round of drinks, the thing bought on the way
home. One balance a month closes that gap. From the previous close, the
recorded movements and the balance now, the app works out what it never heard
about, and what the month actually kept.

The balance is read on a fixed **reading day** of the following month
(the 5th by default, changeable on the Planning/Budgets screen), not on the
last of the month. With a deferred-debit card the month's card spending has
not reached the account by the 31st, so a balance read then flatters the month
and saddles the next one with the bill. Reading it a few days later catches
the debit; keeping the day fixed makes whatever distortion remains the same
every month, which is what lets one close be compared with the next. Against
calendar-month transactions this is an approximation of a few days at each
end — good enough for the trend, which is the part worth trusting.

Nothing here needs configuring or deploying. A close is a row the user writes;
skipping months costs nothing beyond having nothing to compare.

### A month, in words

The Month page can carry a short written read of the month: a headline, up to
four observations, and up to three suggestions. It is written on request — a
button on the card — never on page load, and stored, so opening the page costs
nothing.

Set `MISTRAL_API_KEY` to enable it (`MISTRAL_MODEL` is optional and defaults
to `mistral-small-latest`). Without the key the card is simply absent, the way
the bank buttons are absent without bank credentials. The key is server-side
only; the phone reaches the feature through the web app's
`POST /api/month-read` with its Supabase session as a bearer token, which is
the same route the bank refresh takes.

**The model never writes a number.** It is given a set of named figures — the
labels, values and directions in `packages/core/src/month-facts.ts` — and
answers in prose containing references like `{{fact:unrecorded}}`, which the
app replaces with its own formatted value at render time. That is what lets
the currency toggle and the privacy blur work on a written paragraph, and it
means a figure nobody computed cannot reach the screen: `verifyMonthRead`
refuses any answer citing a datum that was never sent, and drops any single
claim that writes a number of its own. The severities are deliberate — an
invented figure is fatal, whereas a claim thirty characters too long, or one
suggestion too many, is trimmed and the rest of the read survives, because
spending someone's allowance to show them nothing is the wrong price for a
wrapping problem. All of it is pure and unit-tested, with a fake source that
asserts no network happened.

Reads are capped at five a month per user, with a minute's cooldown and a
reservation taken *before* the call so two presses cannot both spend the last
one. The counters live in `month_reads` (migration 024) behind `security
definer` functions, for the same reason the bank tally does: a serverless
function remembers nothing, and a counter a client may write is a counter a
client may reset. Without migration 024 the feature is off rather than
uncapped.

Migration 025 is not optional. A `security definer` function is only as good
as the check on who may call it, and the ones in 022 and 024 shipped with two
mistakes that compound: Postgres grants EXECUTE to PUBLIC by default, so the
explicit grant restricted nothing, and the guard trusted any caller with no
`auth.uid()` — written for the service role, which has none because it is not
a person, but equally true of `anon`, which has none for the opposite reason.
025 revokes the default grant and makes the guard name the service role
instead of inferring it from an absence.

What goes over the wire is aggregates only — totals, rates, category sums, the
close figures. No merchant names, no individual transactions, no balances, no
IBANs, no account holder. Switch on the training opt-out in Mistral's console
before using the key in earnest; that is a console setting, not something this
repo can do for you.

The read is rendered against the figures as they stand *now*, not the ones
stored with it, so a number in the prose can never contradict the card above
it. What can age is the judgement: when a figure it rests on has moved, the
card says which and how long ago it was written. A month still in progress is
never called stale — its figures change whenever anything is recorded, and a
warning that is always on is one nobody reads.

### Supabase auth URLs (production)

In Supabase → Authentication → URL configuration:

- **Site URL:** `https://pluclair.com`
- **Redirect URLs:** include  
  `https://pluclair.com/**` and  
  `https://pluclair.com/auth/callback`

### Passkeys (WebAuthn) — dashboard

In Supabase → Authentication → Passkeys. **Do not save the
`example.com` placeholders.** Passkeys are bound to the Relying Party
ID; changing it later invalidates every enrolled credential.

| Field | Value |
|-------|--------|
| Enable Passkey authentication | on |
| Relying Party Display Name | `Pluclair` |
| Relying Party ID | `pluclair.com` (bare domain, no `https://`) |
| Relying Party Origins | `https://pluclair.com` and, after you have the Android signing cert, `android:apk-key-hash:<base64url-sha256>` |

The Android origin is **not** the colon-hex fingerprint used in
`assetlinks.json`. From the same SHA-256 hex (no colons):

```bash
echo -n '<hex without colons>' | xxd -r -p | openssl base64 -A | tr '+/' '-_' | tr -d '='
```

Prefix the result with `android:apk-key-hash:`.

Localhost web passkeys will not work against RP ID `pluclair.com`. Test
on the production domain (or a tunnel to it). Native passkeys and Face
ID unlock require an **EAS development/production build**, not Expo Go.

Domain association files are served from the web app:

- `https://pluclair.com/.well-known/apple-app-site-association`
- `https://pluclair.com/.well-known/assetlinks.json`

Set these server env vars on Vercel (and in `apps/web/.env.local`):

| Variable | Notes |
|----------|--------|
| `APPLE_TEAM_ID` | 10-character Apple Team ID for the AASA `webcredentials` entry |
| `ANDROID_SHA256_FINGERPRINTS` | Comma-separated colon-hex SHA-256 cert fingerprints (`eas credentials`) |

iOS bundle ID: `com.salutcharles.pluclair`. Android package:
`com.salut_charles.pluclair`.

---

## 4. Mobile (Expo Go)

Start the Metro bundler:

```bash
pnpm dev:mobile
# or: pnpm --filter mobile start
```

Scan the QR code with **Expo Go** on your phone (same Wi‑Fi as your
machine).

### WSL2 / phone cannot reach your PC

If Expo Go shows `Failed to download remote update`, use tunnel mode:

```bash
pnpm --filter mobile exec expo start -c --tunnel
```

`-c` clears the Metro cache (needed after config or `.env` changes).

### Other mobile commands

```bash
pnpm --filter mobile exec expo start --android   # Android emulator
pnpm --filter mobile exec expo start --ios       # iOS simulator (macOS)
pnpm --filter mobile exec expo start --web       # Expo web preview (not the main web app)
```

### EAS (optional)

Run all EAS commands from **`apps/mobile`** (not the repo root).
Display name is **Pluclair**; Expo slug is `pluclair`.

```bash
npx eas-cli login
cd apps/mobile
npx eas-cli build --platform android --profile preview   # installable APK for testing
```

Use **`preview`** for local testing; **`production`** when you are ready
for the Play Store. Google OAuth deep links should use `pluclair://`
(and work more reliably in a development build than in Expo Go).

Android package id: `com.salut_charles.pluclair`. iOS bundle id:
`com.salutcharles.pluclair`.

Passkeys and Face ID / fingerprint unlock need a **development
build** (`eas build --profile development`), not Expo Go.

---

## 5. Shared package (`@finance/core`)

Domain logic (budget math, recurrence, Zod schemas, types) lives in
`packages/core` and is imported as `@finance/core/...` from both apps.

After editing core, restart the web or mobile dev server. No separate
build step is required (TypeScript source is consumed directly).

---

## Branding

- Wordmark: **Pluclair** in Orbit (Maxence Duterne Regular)
  - Web: `apps/web/public/fonts/OrbitMaxenceDuterne-Regular.otf`
  - Mobile: `apps/mobile/assets/fonts/OrbitMaxenceDuterne-Regular.otf`

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Vercel `frozen-lockfile` / lockfile mismatch | Run `pnpm install` at repo root and commit `pnpm-lock.yaml` |
| Vercel build finds no Next.js app | Set Root Directory to `apps/web` |
| Expo Go cannot load the bundle | `expo start -c --tunnel` |
| Styles missing after NativeWind changes | Restart with `-c` |
| Supabase auth errors on web | Check `.env.local` / `NEXT_PUBLIC_SITE_URL` and restart |
| Supabase auth errors on mobile | Check `apps/mobile/.env` and restart Expo with `-c` |

---

## Scripts (root)

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Next.js dev server |
| `pnpm dev:mobile` | Expo / Metro dev server |
