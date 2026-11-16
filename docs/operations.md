# Operations

How Pluclair runs in production: environments, environment variables,
deploys, scheduled jobs, the bank, notifications, dashboards, releases, and
what to do when something breaks. Setting up a development machine is in the
root `README.md`. Rules for changing the code are in `AGENTS.md`.

## Where it runs

| Piece          | Where                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Web app + API  | Vercel project `pluclair`, root directory `apps/web`, region `cdg1` (Paris)                                       |
| Database, auth | Supabase, `eu-central-1` (Frankfurt), Free plan (no backups)                                                      |
| Domain, DNS    | `pluclair.com` at Namecheap                                                                                       |
| Auth e-mails   | Resend SMTP (`noreply@pluclair.com`), set in the Supabase dashboard                                               |
| Bank e-mails   | `…@releves.pluclair.com` through an inbound-mail service (see « Inbound bank e-mails »)                           |
| Android app    | APK on GitHub releases (`android-<version>`), served through `pluclair.com/android`; built on EAS (`apps/mobile`) |
| AI             | Each person's own OpenRouter account (Pluclair has no key)                                                        |
| Bank data      | open-banking.io, for the owner's account only                                                                     |

## Environment variables

Every web variable is server-side unless it starts with `NEXT_PUBLIC_`. Set
them in `apps/web/.env.local` for development (copy
`apps/web/.env.local.example`) and in Vercel for Production and Preview.

### Web (`apps/web`)

| Variable                                                             | Needed for                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | Everything. The URL must contain `supabase.co` (`lib/supabase/env.ts`)       |
| `NEXT_PUBLIC_SITE_URL`                                               | Links in e-mails, canonical URLs. `https://pluclair.com` in Production       |
| `SUPABASE_SERVICE_ROLE_KEY`                                          | Crons, account deletion, the demo, Entraide's moderation queue               |
| `CRON_SECRET`                                                        | Every cron refuses to run without it (Vercel sends it as a bearer token)     |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push to browsers. Phones need no key (Expo push)                         |
| `AI_SECRETS_KEY` (+ `AI_SECRETS_KEY_PREVIOUS` while rotating)        | 32 random bytes, base64. Seals each person's AI account key                  |
| `BANK_SECRETS_KEY` (+ `BANK_SECRETS_KEY_PREVIOUS`)                   | 32 random bytes, base64. Seals each bank credentials file                    |
| `OPEN_BANKING_OWNER_USER_ID`                                         | The one account the bank connection is open to (ADR 0009)                    |
| `OPEN_BANKING_CREDENTIALS`                                           | The owner's credentials bundle, until they upload their own file             |
| `STATEMENT_INBOUND_SECRET`, `BREVO_API_KEY`                          | Forwarded bank e-mails (see « Inbound bank e-mails »)                        |
| `DEMO_EMAIL`, `DEMO_PASSWORD`                                        | `/demo` and the nightly rebuild                                              |
| `ANDROID_APK_URL`                                                    | Where `/android` sends people. Unset, `/android` is a 404                    |
| `ANDROID_APK_VERSION`                                                | Overrides the version read from the latest GitHub release                    |
| `IOS_TESTFLIGHT_URL`, `APP_STORE_URL`, `PLAY_STORE_URL`              | Store links. Unset, the site offers the APK and the iPhone home-screen guide |
| `APPLE_TEAM_ID`, `ANDROID_SHA256_FINGERPRINTS`                       | Passkeys in the apps (`/.well-known/…`)                                      |
| `FEEDBACK_EMAIL`                                                     | « Envoyer un retour » in Profil                                              |

Google sign-in is configured in the Supabase dashboard, not in env files.

### Phone (`apps/mobile`)

Public keys only. Never put the service role key in the phone app. Copy
`apps/mobile/.env.example` to `apps/mobile/.env`, then restart Expo with `-c`.

| Variable                                                    | Needed for                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Everything. Same project as the web                                                     |
| `EXPO_PUBLIC_WEB_APP_URL`                                   | Anything that needs a server secret (AI, bank, statements). Without it those are hidden |
| `EXPO_PUBLIC_FEEDBACK_EMAIL`                                | « Envoyer un retour »                                                                   |

## Deploying

A push to `main` deploys Production on Vercel. A pushed branch gets a
Preview, behind Vercel Authentication (the owner can share a bypass secret
for automated checks).

Vercel settings: root directory `apps/web`, « Include files outside of the
root directory » on (the workspace lockfile and `packages/`). Vercel skips a
commit that doesn't touch the web app, so an empty commit won't redeploy.

After a merge, **check that a deployment for the commit exists and turns
green**: `gh api repos/CharlesCollignon/finance-tracker/commits/<sha>/statuses`
(context « Vercel »), or `vercel ls pluclair`. Then look at
`https://pluclair.com/demo`.

When a deploy fails:

| Symptom                                                                 | Cause and fix                                                                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fails on code that built in a preview                                   | Suspect the environment first. Redeploy.                                                                                                            |
| No build log, `errorCode: git_info_fail` in the deployment's API record | Vercel couldn't fetch the commit. `npx vercel redeploy <dpl_id> --target production`                                                                |
| No deployment at all for the commit                                     | The webhook was missed. Create it from git: `POST https://api.vercel.com/v13/deployments` with `gitSource` `{type: github, repoId, ref: main, sha}` |
| `frozen-lockfile` / lockfile mismatch                                   | `pnpm install` at the root and commit `pnpm-lock.yaml`                                                                                              |
| « No Next.js app found »                                                | Root directory must be `apps/web`                                                                                                                   |
| Font errors from `next/font/google`                                     | Fonts are self-hosted on purpose (ADR 0027). Don't bring Google fonts back                                                                          |

## Scheduled jobs

Declared in `apps/web/vercel.json`. Vercel's schedules are in **UTC**. All
run under the service role and refuse to run without `CRON_SECRET`. Each
answers `200` with a JSON summary, so a run can be checked by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://pluclair.com/api/cron/refresh
```

| Route                        | Schedule (UTC)            | What it does                                                                                                                                  |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/cron/sweep`            | 03:00 daily               | Deletes for good what was deleted 30 days ago; expires Ask conversations, old audience days, Entraide authorship after a year, statement mail |
| `/api/cron/demo`             | 03:30 daily               | Rebuilds the demo account's nine months                                                                                                       |
| `/api/cron/read-instruments` | 04:00 daily               | Re-reads a few aging instruments, on their owners' AI accounts                                                                                |
| `/api/cron/refresh`          | 07:00 daily               | Fills the month's standing charges, reprices share-priced ones, reads the bank, pushes what needs a decision                                  |
| `/api/cron/notify`           | 08:00 daily               | The day's notifications (recap, warnings, close, DCA, milestones, statement reminder…)                                                        |
| `/api/cron/refresh`          | 12:00, 17:00, 21:00 daily | Reads the bank only                                                                                                                           |
| `/api/cron/market`           | 09:00 Mondays             | The INSEE housing index, then property market readings older than a month                                                                     |

The Hobby plan allows each cron entry to run at most once a day, so the
refresh has four entries. The route reads `x-vercel-cron-schedule` to know
which run it is: only the 07:00 run fills and reprices. A hand-run `curl`
sends no such header and gets the full job. Each step fails on its own: an
unreachable bank doesn't stop repricing.

**Filling** writes every occurrence whose day has come (this month and last)
for people whose Journal isn't fed by a bank. Occurrences after today are
never stored: the apps draw them from the templates. Both apps also fill when
they open.

**Repricing** brings occurrences already written but dated ahead in line
with their instrument's quote. It never touches a past date and never
creates a transaction.

**Reading instruments** has its own entry because a search-backed reading
takes tens of seconds. One instrument per person, a few people per run.

## The bank

Two different calls hide behind « sync », and only one of them has limits.

- **Reading** open-banking.io's stored copy (`getAccounts`,
  `getTransactions`) reaches no bank and can be done as often as wanted. It
  is only as fresh as the last pull. This is what the cron does.
- **Pulling** (`syncAll`) reaches the bank. Pluclair does it **only when a
  person presses Refresh**: PSD2 reserves unattended access to licensed
  account-information providers, which Pluclair is not. `pullFromBank`
  refuses an unattended pull. An attended pull has a 90-second cooldown. The
  tally is `bank_pulls`. The rule is in `packages/core/src/bank-pull.ts`.

The connection is open to `OPEN_BANKING_OWNER_USER_ID` only (ADR 0009). If
the owner sees « no bank connected » while Profil says connected, check that
variable on Vercel first, then redeploy.

## Notifications

Sent by the web server only, through `apps/web/lib/push/deliver.ts`:
browsers over Web Push (VAPID keys), phones through Expo (an Expo push token,
which needs a real build, not Expo Go). A deployment without VAPID keys still
notifies phones. Quiet hours are 21:00–08:00 Paris time: a notification
held then is sent on the next run. `notification_log` keys what was sent per
person, so « once » means once across a laptop and a phone. The kinds are in
`docs/feature-map.md` « Notifications ».

The phone also schedules **reminders** on the device (a charge tomorrow)
from its templates, with no server involved.

## Inbound bank e-mails

Each person can have an address `<token>@releves.pluclair.com`
(`statement_inboxes`). On `main`, mail goes through Brevo's inbound parsing
to `/api/statements/inbound`, which checks the `x-pluclair-inbound` header
against `STATEMENT_INBOUND_SECRET`. `scripts/statement-inbox-setup.mjs`
creates the webhook (`BREVO_API_KEY=… STATEMENT_INBOUND_SECRET=… node
scripts/statement-inbox-setup.mjs`).

Brevo never received mail in practice. The unmerged branch
`statements-email-setup` moves this to Mailgun (EU), and waits on the owner's
Mailgun account and DNS. See `docs/plans/STATEMENTS_PLAN.md` Phase 4.

## Supabase dashboard

Settings that live only in the dashboard, not in the repository:

- **URL configuration:** Site URL `https://pluclair.com`; redirect URLs
  `https://pluclair.com/**` and `https://pluclair.com/auth/callback`.
- **SMTP:** Resend, `smtp.resend.com:465`, user `resend`, sender
  `noreply@pluclair.com`, name « Pluclair ». The domain's records (DKIM TXT
  `resend._domainkey`, CNAMEs `send` and `rsend`) are copied from Resend's
  page, never from memory. For an auth e-mail problem, check Resend first:
  domain verified, the username, its e-mail log.
- **E-mail templates:** `supabase/templates/` (confirmation and recovery,
  French or English from `user_metadata.locale`). Paste them, subjects
  included, after every change. They show the icon from
  `pluclair.com/icon-192.png`.
- **Passkeys:** Relying Party ID `pluclair.com` (bare domain). Changing it
  later invalidates every passkey. Origins: `https://pluclair.com` and
  `android:apk-key-hash:<base64url sha256>`. The Android origin is not the
  colon-hex fingerprint used in `assetlinks.json`; convert it:

  ```bash
  echo -n '<hex without colons>' | xxd -r -p | openssl base64 -A | tr '+/' '-_' | tr -d '='
  ```

  Localhost passkeys don't work against `pluclair.com`. Native passkeys and
  biometric unlock need an EAS build, not Expo Go.

- **Google sign-in:** the OAuth client lives in the Google Cloud project for
  the web; the Firebase project `pluclair-fdfe6` holds the Android client key.

## Running a migration on the hosted database

The owner runs it, by hand, in the SQL editor, in number order. Before a
migration that rewrites data, export first: the Free plan has no backups.
The code is written to work before the migration runs (`AGENTS.md`), so
merging first is safe. Each merge message names the migrations to run.

## Releasing the Android app

There are no stores and no over-the-air updates. Every phone change waits
for the next APK.

1. On a clean, up-to-date `main`, make a `phone-<version>` branch with the
   phone « Nouveautés » entries for everything since the last **published**
   APK. Skip anything behind a flag that is off. Merge it at the owner's word.
2. With the owner's go-ahead:
   `node scripts/release-android.mjs [minor|patch|major] [--dry-run] [--draft]`.
   It bumps `app.json`, builds the `preview` profile on EAS (from
   `apps/mobile`), pushes `main`, and publishes `android-<version>` on GitHub
   with notes made from the entries the previous release didn't list.
3. To publish a draft later:
   `gh release edit android-<version> --draft=false --latest`, and rewrite
   its notes with `--notes-file` if more landed since.
4. The site reads the version from the latest release (`/nouveautes/feed.json`,
   `/telecharger`), so phones are offered the update.

Run EAS only from `apps/mobile` (`npx eas …`). Package
`com.salut_charles.pluclair`; iOS bundle `com.salutcharles.pluclair`; scheme
`pluclair://`.

## The iPhone

No App Store yet. `/telecharger` shows iPhone visitors how to add the web
app to the home screen. Once there is an Apple developer account: TestFlight,
then set `IOS_TESTFLIGHT_URL` (the page and `/ios` switch to it). Steps in
`docs/store/README.md`.

## Brand assets

- Wordmark: « Pluclair » in Orbit (Maxence Duterne), in
  `apps/web/public/fonts/` and `apps/mobile/assets/fonts/`.
- Text faces on the web: self-hosted in `apps/web/app/fonts/` with their OFL
  licences.
- The phone's two Fraunces files are static instances (`opsz 48`, `wght` 400
  and 600), because React Native can't set variation axes. To regenerate
  one: `curl -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@48,600"`
  and download the `.ttf` it points at.
- App icons, splash and favicons: `node scripts/build-brand-icons.mjs`
  regenerates every PNG from the orb's colours.

## Scripts

| Script                              | What it does                                                       |
| ----------------------------------- | ------------------------------------------------------------------ |
| `scripts/changelog-draft.mjs`       | Lists what landed since the newest « Nouveautés » entry; `--stats` |
| `scripts/changelog-guard.mjs`       | The hook that refuses a merge into `main` without its entry        |
| `scripts/docs-check.mjs`            | `pnpm check:docs`: the feature map against the code                |
| `scripts/gen-db-types.mjs`          | `pnpm gen:types`: database types from the local schema             |
| `scripts/release-android.mjs`       | Builds and publishes an APK                                        |
| `scripts/seed-demo.mjs`             | Builds the demo account once                                       |
| `scripts/statement-inbox-setup.mjs` | Creates the inbound-mail webhook                                   |
| `scripts/history-refresh.mjs`       | Refreshes the Plan's market history data                           |
| `scripts/anonymise-statement.mjs`   | Anonymises a bank export to use as a test fixture                  |
| `scripts/build-brand-icons.mjs`     | Regenerates the app icons                                          |
