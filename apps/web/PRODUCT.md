# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One individual managing their own money, in euro. Not a household, not a
shared account, not an adviser looking at someone else's figures: every
surface answers to one person's ledger, and `CONTEXT.md` states that scope as
"one person's money".

The audience is euro-zone individuals broadly. French banking is the case the
app currently covers best — the `pea`, `cto`, `av` and `per` wallets are French
wrappers, and the reading day exists because a deferred-debit card has not
landed by the last of the month — but France is one case rather than the
target. Future work should treat France-only assumptions as things to
generalise, not as the shape of the product.

The situation is monthly and deliberate. The user sets what repeats, applies it
to the month, types the rest as it happens, and on their reading day enters the
one closing balance the app cannot know — read off their bank and typed in, on
every deployment there is today.

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

The bank connection is **not shipped**, and the positioning above does not rest
on it. `lib/bank/client.ts` states the shape plainly: two ways in exist and only
the first is wired. `getBankConnection(userId)` returns `null` unless the id
matches `OPEN_BANKING_OWNER_USER_ID`, `BankConnection.source` has exactly one
variant — `"owner-credentials"` — and Partner Connect, the path by which an
ordinary user would connect their own bank, "is a seam rather than an
implementation" waiting on an approved partner application. So one person on a
deployment can have a feed; nobody who signs up can. The month close therefore
stands on a balance the user types, which is also why it is the positioning and
not a feature of the feed.

Three commitments stated on the marketing site and binding on all future work
(`components/marketing/landing-copy.ts`):

- **It does not move money.** Nothing in the app can reach an account: there is
  no transfer, no payment and no standing order in it, and the connection being
  built is read-only, with no version of it that could initiate a payment.
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

A monthly cycle, across three clients that agree because they share one ledger:
this Next.js web app, an Expo mobile app in `apps/mobile`, and the domain
modules in `packages/core`, over one Supabase backend.

Money reaches the ledger three ways in practice: typed by the user, applied
from a recurring template, or brought in from a mapped CSV export, where the
same merchant history proposes a category for each row and nothing is written
until the user has read the list. A fourth way is built and reachable by one
account per deployment — the owner-credentials bank feed, whose rows wait in
the review inbox at `?review=inbox` where answering one teaches the matcher.
Anything written for a general audience describes the first three; the feed is
not something a visitor or a new user can have.

Surfaces in this app: the Bearing, the Ledger (list, calendar, by category),
transactions, budgets, recurring, categories, investments and look-through,
history, import, welcome, profile, plus a public marketing site at
pluclair.com with its own feature pages.

## Capabilities and Constraints

- Euro-centric throughout. Instrument quotes carry both the euro value and the
  price and currency originally quoted in.
- Bank access, where it exists at all, is read-only and server-side, and its
  credentials never reach a browser. It exists for exactly one user id per
  deployment today, so it is an operating fact about the owner's own account
  and not a capability of the product. The per-user path is an unshipped seam:
  until it lands, no surface may describe connecting a bank in the present
  tense, and the marketing site says so in the future tense in one place only
  (the month-close section of `landing-copy.ts`).
- Every user-facing string goes through the `en` and `fr` catalogues in
  `packages/core/src/i18n/messages/`. Findings and other computed prose carry an
  i18n key and its parameters, never a sentence, so wording belongs to the
  client drawing it in the reader's language.
- Terminology is governed by the repository's `CONTEXT.md`, which fixes the
  name of every domain concept and lists the words each one must not be called.
  That document is authority for copy on any surface, marketing included.
- A user can wipe every row and keep the account, or delete both. Figures on
  screen can be blurred with one tap.
- **Open decision — monetisation.** There is no pricing anywhere in the product,
  and the final call to action says "no card". Whether that is permanent is
  undecided and deliberately not recorded as a fact. Future work must neither
  promise free-forever nor build toward a paywall without the user deciding
  first.

## Brand Commitments

The product is **Pluclair**, at pluclair.com. The repository folder may still be
named `finance-tracker`; the brand is not.

The voice has two stated rules, written into the copy file itself and binding:

- **Say the mechanism, not the benefit.** "One balance, once a month" is
  checkable; "effortless clarity" is not, and a reader who has been sold to
  before can tell the difference in about a second.
- **Never promise what the app does not do.** Writing around the read-only
  access, the user-written rules, or the absence of advice would win a signup
  and lose the first session.

Every word of the marketing site lives in one file per locale
(`components/marketing/landing-copy.ts` and `landing-copy.fr.ts`) because the
voice only holds if it can be read in one sitting. French is a translation with
its own punctuation and sentence shape, not English with the words swapped;
copy is written whole in each language rather than concatenated from fragments.

## Evidence on Hand

- Sample figures on the marketing site (`components/marketing/landing-sample.ts`
  and its French counterpart), explicitly labelled as example data on screen.
- In-code mocks of the app's own surfaces (`components/marketing/LandingMocks.tsx`),
  all showing the same month.
- The domain model in the repository's `CONTEXT.md`, including the reasoning
  behind decisions that were reversed once — the two projection tracks, the
  abandoned automatic fulfilment, the bearing that had a model ranking figures.

There are **no** testimonials, customers, case studies, press mentions, user
counts, benchmarks or awards. None may be invented, implied, or dressed up as
placeholder content on any surface.

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

**WCAG 2.1 AA is a hard requirement.** Contrast, focus order, target size and
reduced-motion failures are defects that block, not suggestions.

Existing practice to preserve: labelled controls across the views, touch targets
sized for a finger, and the one-tap blur over every figure on screen for reading
the app somewhere public.
