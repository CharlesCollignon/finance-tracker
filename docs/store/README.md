# Pluclair in the stores

## For now: an APK, from the site

The stores are set aside (the owner, 2026-10-09: no Apple account, no
iPhone to test on). The Android app is an APK anyone can download from the
site — no store, no review — in open beta (owner's call, 2026-10-12). The
landing's « Sur votre téléphone » and the about page (`/a-propos#android`)
offer it once `ANDROID_APK_URL` is set; every button goes through
`/android`, which redirects to the file, so a new build never breaks a link
already shared.

1. On expo.dev, project `salutcharless-team/pluclair`, set the **preview**
   environment's variables, which the `preview` profile reads:
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_WEB_APP_URL` — the hosted project's public values only —
   and `EXPO_PUBLIC_FEEDBACK_EMAIL`, the address « Envoyer un retour » in
   Profile writes to (`FEEDBACK_EMAIL` on Vercel does the same on the web,
   and the about page's « M'écrire »). It is in the APK, so anyone can read it.
2. Build: `cd apps/mobile && eas build --platform android --profile preview`.
   The first build asks to create the signing key; let EAS keep it, so
   every later APK installs over the one before. Never let it make a new
   one: a phone refuses an update signed with another key.
3. Publish the file as a GitHub release of this (public) repository, named
   `pluclair.apk` and not marked as a pre-release, so the address below
   always means the latest one:

   ```sh
   cp ~/Downloads/<the build>.apk pluclair.apk
   gh release create android-1.0.0-beta.1 pluclair.apk \
     --title "Pluclair Android 1.0.0 bêta 1" --notes "…"
   ```

   GitHub shows each file's SHA-256 beside it on the release page.
4. Once, on Vercel: `ANDROID_APK_URL` =
   `https://github.com/CharlesCollignon/finance-tracker/releases/latest/download/pluclair.apk`,
   then a redeploy (Vercel reads new variables only on a new deployment).
   Any HTTPS address ending in `.apk` is taken (`lib/store-links.ts`);
   anything else leaves the download hidden.
5. Once, for what a standalone app does differently from Expo Go:
   - **Google sign-in** comes back to `pluclair://auth/callback`: Supabase
     → Authentication → URL Configuration → Redirect URLs must allow
     `pluclair://**`.
   - **Passkeys** need the APK's signing certificate in
     `ANDROID_SHA256_FINGERPRINTS` on Vercel (`eas credentials -p android`
     prints its SHA-256), then a redeploy — `/.well-known/assetlinks.json`
     is built from it.
6. The widget: a long press on the home screen → Widgets → Pluclair,
   « Il vous reste ». Expo Go cannot show it; the APK can.

A change to the app reaches people with a new build and a new release:
they install the new APK over the old one, and their data stays (it lives
in Supabase). An APK does not update itself, so the app says when there is
a newer one (« Une nouvelle version est disponible » on Le point), and
after an update shows « Quoi de neuf » once. Both rest on the version, and
one command does a whole release — steps 2 and 3 above included:

```sh
node scripts/release-android.mjs          # 1.0.0 → 1.1.0; `patch`, `major`
node scripts/release-android.mjs --dry-run
node scripts/release-android.mjs --draft  # build now, publish later
```

Until the legal pages are final (below), a release is staged with
`--draft`: unpublished, invisible to anyone but the owner and to the site.
Publishing it is `gh release edit android-<version> --draft=false --latest`,
then `ANDROID_APK_URL` on Vercel the first time.

It raises `version` in `apps/mobile/app.json` and commits it, builds the
APK on EAS (the `preview` profile raises the build number by itself, so
every APK installs over the one before), pushes `main`, and publishes the
release `android-<version>` with `pluclair.apk` and notes from the phone's
« Nouveautés » entries. The site reads the version from that release's tag
(`latestApkVersion`, within ten minutes), so there is nothing to set on
Vercel after the first `ANDROID_APK_URL`; `ANDROID_APK_VERSION` there would
override the tag. The entries themselves are written with the changes, as
always (`AGENTS.md`).

### Before 2027: register with Google

Distributing outside Google Play is legal, but Google is making certified
Android phones refuse apps from developers it has not verified — installs
from a website included. It applies since 30 September 2026 in Brazil,
Indonesia, Singapore and Thailand, and is planned for everywhere else,
France included, in 2027 (support.google.com/android-developer-console,
answer 16561738). Unregistered, the APK would need Android's "advanced
flow" (a day's wait, then biometrics) — most people would stop there.

- An **Android Developer Console** account with full distribution (25 $
  once, an identity check; an organisation needs a D-U-N-S number). The free
  "limited distribution" account covers 20 devices: not a public download.
- Register the package, `com.salut_charles.pluclair`, with the signing
  certificate's SHA-256 (`eas credentials -p android`).
- No closed test with 12 testers: that is Google Play's rule, not this one.

### Before the public download: the legal pages

Done on 2026-10-13: `LEGAL_DRAFT` is `false`
(`apps/web/components/marketing/legal-status.ts`), so the privacy policy,
the terms and the mentions légales are served in production, with no blank
left. The owner chose not to have them read by a lawyer and to take the
most careful option wherever one was open (`docs/legal/`). The terms say
Pluclair is an open beta and that the APK comes from pluclair.com only.
What is left for the public download is publishing the release and
setting `ANDROID_APK_URL` (above).

That exception keeps the home address off the site only if the host has
the publisher's identification details — name, home address and phone
(LCEN art. 1-1, II and I). Check that Vercel's account holds them (the
billing details, on a paid plan), or publish the address instead.

## On iPhone: the home screen, then TestFlight

An iPhone installs nothing Apple has not signed, so there is no file to
hand out. Apple's EU Web Distribution (iOS 17.5 and later) lets an app be
downloaded from its developer's own site, but even under the terms of
1 October 2026 it asks for one of: a Dun & Bradstreet risk score, a stock
listing, venture funding, an audited company, a 1 M$ stand-by letter of
credit, or a million installs a year. A private individual publishing a
free app has none of them (developer.apple.com/support/web-distribution-eu,
read on 2026-10-25). So, in order:

1. **Now: the web app on the home screen.** `/telecharger#iphone` shows the
   three gestures — Safari, Partager, « Sur l'écran d'accueil » — and an
   iPhone sees them first; the landing's hero and the about page send an
   iPhone there. What opens is the web app (`app/manifest.ts`,
   `appleWebApp` in `app/layout.tsx`), with its notifications once it is on
   the home screen (iOS 16.4 and later). No Face ID, quick actions or
   widget: those are the phone app's.
2. **With an Apple Developer account (99 € a year): the beta on
   TestFlight**, the iPhone's counterpart of the APK.
   1. On expo.dev, the **production** environment's variables (« 2. Before
      the first build » below).
   2. `cd apps/mobile && eas build --platform ios --profile production`.
      EAS builds and signs in the cloud, so no Mac is needed; let it create
      the certificate and the provisioning profile. Then
      `eas submit --platform ios --latest`. This first build is also the
      first time the Swift in `modules/quick-actions` is compiled.
   3. App Store Connect → the app → TestFlight → a group of external
      testers → add the build. The first build of each version goes
      through Beta App Review, where Sign in with Apple (« 5. Before review »
      below) may already come up. Then turn the group's public link on.
   4. On Vercel, `IOS_TESTFLIGHT_URL` = that link
      (`https://testflight.apple.com/join/…`; anything else is ignored,
      `lib/store-links.ts`), then a redeploy. `/ios` sends to it,
      `/telecharger` adds « La bêta iPhone » above the home-screen steps,
      and an iPhone's hero button becomes « Rejoindre la bêta iPhone ».
   5. A build stops opening 90 days after it is uploaded: a new one at
      least every quarter. Up to 10 000 testers.

   The phone's « Une nouvelle version est disponible » is Android's only
   (`NewVersionBanner.tsx`): TestFlight tells its testers itself.
3. **Then the App Store**, below. Once `APP_STORE_URL` is set, `/ios` sends
   there instead.

## Later: the stores

Phase 3 of `docs/plans/EVERYDAY_PLAN.md`: the phone app on the App Store
and Google Play. What the repository could prepare is here and in
`apps/mobile/app.json`; the rest needs the owner's accounts, a build and a
person at the consoles. In the order it happens:

- `listing.fr.md`, `listing.en.md` — the text of both listings, within each
  console's limits. The descriptions are wrapped for reading: join each
  paragraph's lines when pasting.
- `privacy-labels.md` — Apple's App Privacy and Google's Data safety, read
  from the privacy policy, with what is left to decide marked [[…]].

### 1. Accounts

- **Apple Developer Program** (99 $ a year). Apple asks apps in « banking
  and financial services » to come from a legal entity rather than an
  individual (App Review Guideline 5.1.1(ix)). A budgeting app usually
  passes as an individual's, a bank connection makes that less sure: an
  organisation account (it needs a D-U-N-S number) is the safer choice.
- **Google Play Console** (25 $ once). A personal account created since
  November 2023 must run a closed test with at least 12 testers for 14 days
  before it may publish to everyone; an organisation account does not.

### 2. Before the first build

1. The EAS project is `salutcharless-team/pluclair` (`app.json`,
   `extra.eas.projectId`). On expo.dev, set the **production** environment's
   variables, which `eas.json` reads: `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_APP_URL` (the hosted
   project's public values only — never the service role key).
2. `eas.json` → `submit.production`, once the apps exist in the consoles:
   - iOS: `ascAppId` (App Store Connect → the app → App Information → Apple
     ID) and `appleTeamId`.
   - Android: `serviceAccountKeyPath` (a Play Console service account's
     JSON key, kept out of git) and `"track": "internal"` for the first
     upload.
3. Sign-in on the phone: see « Before review » below — Sign in with Apple
   may have to come first.

### 3. Build and send

```sh
cd apps/mobile
eas build --platform all --profile production
eas submit --platform ios --latest
eas submit --platform android --latest
```

`appVersionSource` is `remote` and production builds `autoIncrement`: the
build numbers look after themselves; the version shown (`1.0.0`) is
`app.json`'s.

The first Android upload must be made by hand in the Play Console (an
internal test release), after which `eas submit` can follow.

### 4. Screenshots

Taken on a build against a **demo account** with made-up figures — never
real data. Le point first, since it is what the listing promises.

1. Le point: « Il vous reste 412 € jusqu'au 28 ».
2. The add sheet, a shop typed and its category found.
3. The Journal, « Passé · À venir ».
4. The month close and what slipped through.
5. Récurrents: the month's charges.
6. Placements: a PEA and what its funds hold.
7. Android only: the widget on a home screen.
8. « Votre année ».

Sizes: App Store — iPhone 6.9" (1320 × 2868), which covers the others;
no iPad, the app is iPhone-only (`supportsTablet` unset). Google Play — at
least two phone screenshots (9:16), the 512 × 512 icon and a 1024 × 500
feature graphic.

### 5. Before review

- **A demo account for the reviewers.** Both stores need one to get past
  the sign-in: an email and password, with figures in it, on the hosted
  project. The owner creates it — nothing here writes to hosted data.
- **Sign in with Apple.** The phone offers « Continuer avec Google ». Apple
      asks an app that signs in with a third party to offer an equivalent that
      keeps the email private (Guideline 4.8) — in practice Sign in with Apple
      on iOS. Without it, expect a rejection. [[Owner's call: add Sign in with
      Apple on iOS, or hide Google on iOS.]]
- **Paid services the app sends people to.** The bank connection (the
  person's own open-banking.io account) and the AI (their own OpenRouter
  account) are paid to those services, never to Pluclair, and nothing is
  sold in the app. Say so in the review notes, so they are not read as
  purchases made outside the store (Guideline 3.1). Suggested note:

  > Pluclair is free and sells nothing. Two optional features use the
  > person's own account at another service, paid directly to it: a
  > read-only bank connection (open-banking.io) and written reads by an AI
  > model (OpenRouter). Pluclair receives no payment or commission from
  > either. Demo account: [[email]] / [[password]].

- **Account deletion** is in the app (Profil → Supprimer le compte), as
  both stores require.

### 6. Once published

Set `APP_STORE_URL` and `PLAY_STORE_URL` in the web app's environment
(Vercel), then redeploy: Vercel reads new variables only on a new
deployment. The landing then takes « L'application mobile » out of
« Bientôt » and shows the store links — one alone is enough for it to move.
