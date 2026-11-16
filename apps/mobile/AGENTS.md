# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# The phone app (`apps/mobile`)

Expo SDK 57, expo-router, NativeWind, Reanimated. Dark only, French first.
The root `AGENTS.md` applies too. This file adds what is particular to the
phone.

## Shape

- Screens live in `src/app/` (expo-router). The bar's tabs are in
  `src/app/(tabs)/`, and screens pushed over them sit beside it. The
  route ↔ feature table is in `docs/feature-map.md`.
- `src/lib/queries.ts` reads and `src/lib/mutations.ts` writes. Both call
  `@finance/data` with the phone's own client (`src/lib/supabase.ts`).
- Anything that needs a server secret (AI, the bank, the market, receipts,
  Entraide writes) goes through the web app: `src/lib/web-api.ts`
  (`callWebApi`, with the session as a bearer token). Those routes are listed
  in `docs/feature-map.md` « API routes ».
- State that spans screens lives in `src/providers/` (month, owner/space,
  design, privacy, locale, currency, quick add…).

## Keeping screens current

There is no client cache. A screen loads with
`useRefreshable(loader, deps, { reads })` (`src/hooks/useRefreshable.ts`).
`announcingFetch` (`src/lib/data-version.ts`) sees every successful write and
announces the data area of the table or route it wrote to. Screens that read
that area reload in place, or are marked stale until they are shown again.

- **A new table or a new web route needs its area** in `TABLE_AREAS` /
  `ROUTE_AREAS`. Without one it falls back to `ALL_AREAS`, which redraws
  every tab. Entraide's freezes came from exactly that.
- A route that maps to no area (statements) must announce the change itself
  after it succeeds.

## Rules learned here

- **Never run `prettier --write` over `src/`.** Edit in the surrounding
  style, and check `git diff --stat` for files you didn't mean to touch.
- **`cn` is a plain join.** NativeWind settles class conflicts by stylesheet
  order, not by argument order. Add a prop for a variant; never try to
  override one class with another.
- **Reanimated shared values:** use `.get()` / `.set()`. The React Compiler
  lint rejects `.value =`.
- **Arrivals fade:** `FADE_IN` / `FADE_OUT` / `LAYOUT` from
  `src/components/motion/fade.ts`. No spring, slide or stagger on arrival.
  Gestures, haptics and count-ups are welcome.
- **Every committed write answers:** a toast plus a haptic (`src/lib/haptics.ts`),
  success for a save and warning for a delete.
- **Entry sheets** are built on `src/components/sheet/EntrySheet.tsx`
  (`FigureInput`, `Field`, `SaveButton`, `DangerAction`). Don't build a new
  sheet frame.
- **Designs** (Nuit, Papier, Bento, Console) shape blocks through
  `src/theme/design-blocks.ts` and `DesignProvider`. Phone radii don't change
  per design; the web's do. The logo never changes.
- **Native modules only load where they exist.** The Android widget
  (`src/widget/`) and the notification listener
  (`modules/notification-listener`) must not crash Expo Go, which has neither.
- **Flags** come from `useFlag` (`src/hooks/useFlag.ts`), same keys as the
  web's (`@finance/core/flags`).

## Seeing it run

The phone can't be checked visually on the development machine: the Expo web
build needs about 4 GB and has crashed the terminal. So:

- check logic with tests in `@finance/core`, and data with a throwaway vitest
  against the local Supabase;
- say plainly in the merge message and in « Nouveautés » notes that the
  screen was not seen running;
- the real check is a device with the next APK.

Run EAS from `apps/mobile` (`npx eas …`), never from the repository root.
That links the empty root `app.json` to the wrong project.

## Releasing an APK

There are no stores and no over-the-air updates. A phone change reaches
people only with the next APK, downloaded from `pluclair.com/android` or
offered by the in-app update (`src/lib/apk-update.ts`).

1. Branch `phone-<version>` from a clean `main`. Add the phone
   « Nouveautés » entries for everything since the last published APK. Skip
   anything behind a flag that is off.
2. After the owner's go-ahead: `node scripts/release-android.mjs [minor|patch]`.
   It bumps `app.json`, builds the `preview` profile on EAS, pushes `main` and
   publishes the `android-<version>` GitHub release. `--draft` stages it
   without publishing.
3. Publishing an existing draft:
   `gh release edit android-<version> --draft=false --latest`.

Details in `docs/operations.md` « Releasing the Android app ».
