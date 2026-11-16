# Pluclair

A free personal-finance app for French users —
[pluclair.com](https://pluclair.com). A Next.js web app and an Expo phone
app share one Supabase backend and two TypeScript packages that hold every
rule and every query.

The repository folder may still be called `finance-tracker`; the product is
**Pluclair**.

## Find your way

| You want to…                                               | Read                         |
| ---------------------------------------------------------- | ---------------------------- |
| Change the code (rules for humans and agents)              | `AGENTS.md`                  |
| Find which doc covers what                                 | `docs/README.md`             |
| See which page shows which feature, and the code behind it | `docs/feature-map.md`        |
| Understand how it works                                    | `docs/how-pluclair-works.md` |
| Know why it is the way it is                               | `docs/decisions/README.md`   |
| Deploy, configure, release, fix production                 | `docs/operations.md`         |
| Learn the words                                            | `CONTEXT.md`                 |

## Layout

```
finance-tracker/
├── apps/
│   ├── web/          Next.js 16: the web app, its API and the public site (Vercel)
│   └── mobile/       Expo SDK 57: the phone app (Android APK)
├── packages/
│   ├── core/         Pure TypeScript: calculations, rules, zod schemas, strings (FR/EN)
│   └── data/         The Supabase reads and writes both apps make
├── supabase/         Migrations, SQL tests, auth e-mail templates, one edge function
├── scripts/          Release, changelog, docs check, demo, types, brand icons
└── docs/             Feature map, how it works, decisions, operations, plans, legal
```

## Set up

You need Node 22 (CI uses 22; 20 works locally), pnpm 11
(`npm install -g pnpm`), and Docker for the local database. For the phone:
Expo Go (SDK 57) or a development build.

```bash
pnpm install
```

The workspace uses a hoisted layout (`nodeLinker: hoisted` in
`pnpm-workspace.yaml`) so Metro and Expo autolinking work. Keep it.

### The database

Develop against a **local** Supabase, never against the hosted project:

```bash
pnpm dlx supabase@2.119.0 start
pnpm dlx supabase@2.119.0 status -o json   # URL and keys
```

The local stack applies `supabase/migrations/` on first start. After a new
migration, see `supabase/AGENTS.md`.

### Environment

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Fill them with the local Supabase values. Every variable is described in
`docs/operations.md` « Environment variables ». The phone takes public keys
only.

### Run the web app

```bash
pnpm dev:web          # http://localhost:3000
```

### Run the phone app

```bash
pnpm dev:mobile       # scan the QR code with Expo Go
```

On WSL2, or when Expo Go shows `Failed to download remote update`:
`pnpm --filter mobile exec expo start -c --tunnel` (`-c` clears Metro's
cache, needed after a `.env` or NativeWind change). Push notifications,
passkeys, biometric unlock, the widget and the bank-notification listener
need an EAS build, not Expo Go.

## Check before a commit

The full list, in the same order as CI, is in `AGENTS.md` « Checks before
every commit ». The short version:

```bash
pnpm check:reachability   # unused strings and exports
pnpm check:docs           # the feature map matches the code
pnpm test                 # core, data and web tests
```

plus the typecheck and lint of each package (`AGENTS.md`).

## Scripts

| Command                   | What it does                           |
| ------------------------- | -------------------------------------- |
| `pnpm dev:web`            | Next.js dev server                     |
| `pnpm dev:mobile`         | Expo dev server                        |
| `pnpm test`               | Core, data and web tests               |
| `pnpm check:reachability` | Unused i18n keys and knip              |
| `pnpm check:docs`         | `docs/feature-map.md` against the code |
| `pnpm gen:types`          | Database types from the local schema   |

Other scripts in `scripts/` are listed in `docs/operations.md`.

## Troubleshooting

| Issue                                      | Try                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Expo Go can't load the bundle              | `expo start -c --tunnel`                                             |
| Styles missing after a NativeWind change   | Restart Expo with `-c`                                               |
| Auth errors on the web                     | Check `apps/web/.env.local` and `NEXT_PUBLIC_SITE_URL`, then restart |
| Auth errors on the phone                   | Check `apps/mobile/.env`, then restart Expo with `-c`                |
| Mobile typecheck can't find `@/global.css` | `pnpm --filter mobile exec expo customize tsconfig.json`             |
| A deploy fails                             | `docs/operations.md` « Deploying »                                   |
