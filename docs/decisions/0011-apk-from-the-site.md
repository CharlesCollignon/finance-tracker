# 0011. The Android app is an APK from the site; iPhone uses the home screen

- **Date:** 2026-10-12 (Android), 2026-10-25 (iPhone)
- **Status:** Accepted
- **See also:** `docs/store/README.md`, `docs/operations.md` « Releasing the Android app »

## Context

The owner has no Apple developer account and didn't want the store process.
Apple's EU web distribution still needs requirements a private individual
can't meet.

## Decision

- **Android:** a public APK, « open beta », downloaded from
  `pluclair.com/android` (a redirect to the latest GitHub release) and the
  `/telecharger` page. Released with `scripts/release-android.mjs`. An in-app update
  (download and install a newer APK from inside the app) is merged and waits
  for the next published APK; 1.5.0 is the latest published as of
  2026-11-16.
- **iPhone:** add the web app to the home screen now; TestFlight once an
  Apple account exists (`IOS_TESTFLIGHT_URL` switches `/ios` and the page);
  the App Store later.
- Store listings stay ready in `docs/store/` for later.

## Consequences

- No over-the-air updates: a phone change reaches people only with the next
  APK. Phone « Nouveautés » entries wait for that APK
  ([0015](0015-nouveautes-never-behind.md)).
- The Firebase key in `google-services.json` ships in every APK. It is
  public by design: restrict it, don't rotate it.
