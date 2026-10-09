# Pluclair in the stores

Phase 3 of `docs/plans/EVERYDAY_PLAN.md`: the phone app on the App Store
and Google Play. What the repository could prepare is here and in
`apps/mobile/app.json`; the rest needs the owner's accounts, a build and a
person at the consoles. In the order it happens:

- `listing.fr.md`, `listing.en.md` — the text of both listings, within each
  console's limits. The descriptions are wrapped for reading: join each
  paragraph's lines when pasting.
- `privacy-labels.md` — Apple's App Privacy and Google's Data safety, read
  from the privacy policy, with what is left to decide marked [[…]].

## 1. Accounts

- **Apple Developer Program** (99 $ a year). Apple asks apps in « banking
  and financial services » to come from a legal entity rather than an
  individual (App Review Guideline 5.1.1(ix)). A budgeting app usually
  passes as an individual's, a bank connection makes that less sure: an
  organisation account (it needs a D-U-N-S number) is the safer choice.
- **Google Play Console** (25 $ once). A personal account created since
  November 2023 must run a closed test with at least 12 testers for 14 days
  before it may publish to everyone; an organisation account does not.

## 2. Before the first build

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

## 3. Build and send

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

## 4. Screenshots

Taken on a build against a **demo account** with made-up figures — never
real data. Le point first, since it is what the listing promises.

1. Le point: « Il vous reste 412 € jusqu'au 28 ».
2. The add sheet, a shop typed and its category found.
3. « Puis-je me permettre ? ».
4. The month close and what slipped through.
5. Récurrents with « Abonnements ».
6. Placements: a PEA and what its funds hold.
7. Android only: the widget on a home screen.
8. « Votre année ».

Sizes: App Store — iPhone 6.9" (1320 × 2868), which covers the others;
no iPad, the app is iPhone-only (`supportsTablet` unset). Google Play — at
least two phone screenshots (9:16), the 512 × 512 icon and a 1024 × 500
feature graphic.

## 5. Before review

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

## 6. Once published

Set `APP_STORE_URL` and `PLAY_STORE_URL` in the web app's environment
(Vercel). The landing then takes « L'application mobile » out of
« Bientôt » and shows the store links — one alone is enough for it to move.
