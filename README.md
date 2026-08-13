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
CLI) using the files in `supabase/migrations/`, in order (`001` → `013`).
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
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Only for “Delete account” on web |
| `APPLE_TEAM_ID` | optional | Passkeys on iOS — Apple Team ID for AASA |
| `ANDROID_SHA256_FINGERPRINTS` | optional | Passkeys on Android — colon-hex SHA-256 fingerprints |

Google OAuth is configured in the **Supabase dashboard**, not in env files.

### Mobile (`apps/mobile`)

Same Supabase project; **public keys only** (never put the service role
key in the mobile app):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

| Variable | Required |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes |

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
