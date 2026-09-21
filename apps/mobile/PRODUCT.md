# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

The app ships to both stores — an iOS bundle with Face ID and an Android
package with biometric and notification permissions — from one Expo codebase.
Today it presents a single dark design language on both, and its `Platform.OS`
branches cover native affordances rather than a different look: the date
picker's inline-versus-default display, keyboard avoidance, toast placement,
and Android's predictive back gesture. Recorded as `adaptive` so that iOS and
Android conventions are both checked in future work, rather than one platform
silently inheriting the other's.

## Users

One individual managing their own money, in euro. Not a household, not a
shared account, not an adviser looking at someone else's figures: every
surface answers to one person's ledger, and the repository's `CONTEXT.md`
states that scope as "one person's money".

The audience is euro-zone individuals broadly. French banking is the case the
app currently covers best — the `pea`, `cto`, `av` and `per` wallets are French
wrappers, and the reading day exists because a deferred-debit card has not
landed by the last of the month — but France is one case rather than the
target. Future work should treat France-only assumptions as things to
generalise, not as the shape of the product.

On mobile specifically, the user is standing up: adding a row on the way home,
checking what is left before deciding something, glancing at where the month
stands. The long deliberate work — mapping a CSV, closing the month — is
possible here but is not what the phone is picked up for.

## Product Purpose

Record what came in, what went out, what was set aside and what is invested,
and reconcile it month by month against the account's real balance.

The app exists because arithmetic over the rows can only ever describe the rows.
Cash from a machine, a card the feed does not cover, a month the sync missed —
none of it is recoverable by summing what was recorded. A closing balance is,
which is why the month close is the figure that checks all the others, and why
unrecorded spending is measured rather than remembered.

Success is that a month can be described accurately, and that the figures on
screen survive being checked against the bank.

## Positioning

The month close. A neighbouring app can categorise a statement feed and draw
the same charts; what it cannot truthfully copy is proving what its own records
missed, because that requires asking the user for a balance and then being
willing to publish the gap. Unrecorded spending is the output of that, and the
forward projection is allowed to subtract it precisely because it was measured.

Three commitments, binding on all future work:

- **It does not move money.** Bank access is read-only and there is no version
  of it that could initiate a payment.
- **It does not act on a rule the user did not write.** A statement row files
  itself only where the user has put that shop in the same place twice;
  everything else waits in the review inbox, and a recurring template is a
  template until applied.
- **It does not tell the user what to do.** No advice, no score, no nudge to
  switch products.

The one place prose is written for the user — the month read — never writes a
number. The model refers to a figure by name and the app substitutes its own
value; a sentence resting on a figure the app did not compute is dropped.

## Operating Context

One of three clients that agree because they share one ledger: this Expo app,
the Next.js web app in `apps/web`, and the domain modules in `packages/core`,
over one Supabase backend. A row added on the phone is on the other clients
without a reconciliation step, because there is only ever one record.

Surfaces here: five tabs — the bearing (`index`), transactions, recurring,
planning and investments — with calendar, categories, import, profile,
onboarding and the auth flow alongside them. Money reaches the ledger typed by
the user, applied from a recurring template, or brought in by the optional
read-only bank connection or a mapped CSV export; rows the app will not file on
its own wait in the review inbox at `?review=inbox`, the same address as on web.

The phone is the client that is opened in public, on a train or in a queue,
which is why blurring every figure on screen matters more here than anywhere
else.

## Capabilities and Constraints

- Euro-centric throughout. Instrument quotes carry both the euro value and the
  price and currency originally quoted in.
- **Dark only.** `userInterfaceStyle` is `dark` and there is no light theme to
  design for or against. **Portrait only**; landscape is not a layout that
  exists.
- Unlocked by biometrics — Face ID on iOS, fingerprint or biometric on Android —
  with passkey sign-in via `react-native-passkeys` and the
  `webcredentials:pluclair.com` association.
- Sends notifications through a single `reminders` channel.
- Bank access is read-only, optional, and revocable; rows it already filed stay
  with the user afterwards. Credentials never reach a browser or a device.
- Every user-facing string goes through the `en` and `fr` catalogues in
  `packages/core/src/i18n/messages/`, with the device locale read via
  `expo-localization`. Findings and other computed prose carry an i18n key and
  its parameters, never a sentence, so wording belongs to the client drawing it
  in the reader's language.
- Terminology is governed by the repository's `CONTEXT.md`, which fixes the
  name of every domain concept and lists the words each one must not be called.
- Charts are drawn with ECharts through `@wuba/react-native-echarts`; styling is
  NativeWind. Expo SDK 57 with typed routes and the React Compiler enabled — its
  versioned documentation is authority over recalled Expo APIs, as
  `apps/mobile/AGENTS.md` states.
- Account deletion from the device depends on the `delete-account` Supabase
  Edge Function.
- **Open decision — monetisation.** There is no pricing anywhere in the product,
  and the web app's final call to action says "no card". Whether that is
  permanent is undecided and deliberately not recorded as a fact. Future work
  must neither promise free-forever nor build toward a paywall without the user
  deciding first.

## Brand Commitments

The product is **Pluclair**, at pluclair.com, shipped as `com.salutcharles.pluclair`
on iOS and `com.salut_charles.pluclair` on Android. The repository folder may
still be named `finance-tracker`; the brand is not.

The voice has two stated rules, written into the web copy file and binding on
every client:

- **Say the mechanism, not the benefit.** "One balance, once a month" is
  checkable; "effortless clarity" is not, and a reader who has been sold to
  before can tell the difference in about a second.
- **Never promise what the app does not do.** Writing around the read-only
  access, the user-written rules, or the absence of advice would win a signup
  and lose the first session.

French is a translation with its own punctuation and sentence shape, not English
with the words swapped; copy is written whole in each language rather than
concatenated from fragments.

Identity assets already fixed: the splash and Android adaptive-icon background
`#0a0a10`, and the notification accent `#e0be7a`.

## Evidence on Hand

- The domain model in the repository's `CONTEXT.md`, including the reasoning
  behind decisions that were reversed once — the two projection tracks, the
  abandoned automatic fulfilment, the bearing that had a model ranking figures.
- The web app's marketing surfaces, whose sample figures are explicitly labelled
  as example data on screen.

There are **no** testimonials, customers, case studies, press mentions, user
counts, benchmarks, awards or store ratings. None may be invented, implied, or
dressed up as placeholder content on any surface, including store listings.

## Product Principles

1. **Measure, do not guess.** A figure the app can prove beats one it can infer;
   where nothing can be measured, say so rather than estimate.
2. **Nothing happens that the user did not ask for.** Applying, filing,
   fulfilling and writing are all acts the user initiates.
3. **Every figure is traceable to the surface that owns it.** Nothing keeps a
   second set of numbers, and a figure with nowhere honest to lead is not
   dressed as though it had somewhere.
4. **Say the mechanism.** In the product and in its marketing, the checkable
   sentence wins over the persuasive one.
5. **The reader's own language.** English and French are peers; neither is the
   surface the other was fitted to.

## Accessibility & Inclusion

**WCAG 2.1 AA is a hard requirement**, read here as its mobile equivalent:
contrast, focus and reading order, target size, and reduced-motion failures are
defects that block, not suggestions. Dark-only means contrast has no light theme
to fall back on, so it has to hold in the one theme that exists.

Existing practice to preserve: labelled controls, touch targets sized for a
finger, haptics as confirmation rather than decoration, and the one-tap blur
over every figure on screen for reading the app somewhere public.
