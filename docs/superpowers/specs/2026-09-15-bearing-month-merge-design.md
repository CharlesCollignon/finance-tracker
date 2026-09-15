# One home: merging the Bearing and Month

**Date:** 2026-09-15
**Status:** Approved design, ready for an implementation plan

## What this changes

The Bearing and Month become one surface. Month stops being a page on either
client: its content dissolves into panels that open in place beneath the
Bearing's tiles, and its two route files are deleted.

The merged home has three zones. A fixed **spine** carrying the loop the app
already models — allowance, streak, and the one thing that needs doing. The
**bento** below it, model-arranged and draggable, mechanically unchanged. And
a **panel** that opens in-row under whichever tile is pressed.

Around that, the monthly close becomes a moment rather than a toast, and
twelve closes become a year in review.

## Why

The app's front door is currently a lobby. The Bearing states figures and
sends you elsewhere to act on them; Month holds the actions and the detail but
answers only "how is this month going", which `navigation.ts` correctly
observes "is the right question on the 28th and the wrong one on the 2nd".
Neither is a surface worth opening daily.

The goal is a single home that feels like an app rather than two report pages.
Not a navigation fix — a product-feel one.

## What "gamified" means here, and what it does not

The app already contains a real loop and does not need an invented one.
`unrecorded allowance` is a cap a month either comes in under or does not.
`month close` is a deliberate monthly ritual. `streak` and `bestStreak` are
already computed in `month-close.ts` and already require calendar-adjacent
reconciled closes. Surfacing that loop is the whole of the gamification.

There are no points, no levels, no badges and no mascot. Every figure on the
new surfaces is one `packages/core` already computes. A celebration is allowed
only where the app can print a true sentence about a real month.

## The spine

Fixed, always at the top, never reordered — so muscle memory works.

| Element | Source |
| --- | --- |
| Headline figure | `pulse.free` |
| Ring | `pulse.capRatio` as a proportion; `pulse.overCap` fills it |
| Ring colour | `pulse.standing` |
| Flame | `closeSummary.streak`, against `bestStreak` |
| Action row | The first `AttentionItem`, with `+N` for the rest |

`pulse.free` leads because `month-pulse.ts` already argues that it should:
it is "the only number on the Month screen worth reading first", and it is
deliberately not the same as "left this month".

### The ignition ladder

The loop is not switched on at signup. It assembles as the arithmetic allows,
and each unlit step is a legible invitation rather than an empty state.

1. **No readable balance.** `onHand` is null, so `free` is null and
   `standing` is `unknown`. The ring is dark. The headline falls back to
   `summary.remaining` and is labelled as that figure, never as `free`.
2. **Bank connected, nothing closed.** `free` is real and leads.
   `openingBalance` is null, so there is nothing to measure unrecorded
   spending from and the ring stays dark. The action becomes the invitation
   to close.
3. **One close.** `unrecordedSoFar` exists but `cap` needs
   `MIN_CLOSES_FOR_CAP = 2`, so `capRatio` is null. The ring is therefore
   **not a progress ring here**: with no cap there is no proportion to draw,
   and drawing one would imply a target the user has not got. It renders as a
   complete unproportioned arc in blue, marking that a measurement exists
   without claiming progress toward anything.
4. **Lit.** Ring from `capRatio`, colour from `standing`, flame from `streak`.

Two edges the implementation must hold:

- When `pulse.overRecorded` is true the ring is **absent**. The account
  holding more than the ledger allows is a gap in the records, not spending,
  and `month-pulse.ts` is emphatic that these are different findings.
- With no cap, the ring is never green. A measurement with no target cannot
  be a verdict.

## The panel system

Pressing a tile stops navigating and starts expanding. `BEARING_TILES.href`
is not removed — it demotes from "what the press does" to "where the panel's
footer link goes", so *Open the Ledger ›* still exists.

There are **five panel chromes, not twenty-nine expansions**. A tile's
`family` — already carried on every datum in `bearing-facts.ts`, explicitly so
that "the surface groups by it" — decides the chrome. The tile decides which
blocks fill it.

| Family | Chrome | Blocks available |
| --- | --- | --- |
| `now` | none — a bearing is taken on a date | `MoneyOnHand`, `CashAccounts`, `RecentOnAccount` |
| `month` | month picker, budget-view toggle | `SpendStrip`, `StillToCome`, `MonthRead`, `BudgetProgress` |
| `run` | streak header | `MonthScore`, `CloseHistory`, `ClosedRecap`, `TrendCard` |
| `ahead` | how far ahead the projection runs | `ProjectionCard`, `Ingredients` |
| `wallet` | none | `MonthWallets`, `WeightBars`, `FundCost` |

This is where the month picker and the budget-view toggle belong. They are
currently page furniture above content that mostly ignores them; as chrome on
the `month` family they scope exactly the figures they govern.

### Blocks are chosen per tile, not per family

This rule is load-bearing. The `month` family is the fattest, and a panel that
dumped the whole family would mean Month had been hidden in an accordion
rather than dissolved. Each panel explains **one figure**:

| Tile | Blocks |
| --- | --- |
| `free` | `SpendStrip`, `StillToCome` |
| `savings-rate` | in/out/kept bars, `MonthComparison` |
| `unrecorded-over` / `unrecorded-allowance` | allowance detail, `BudgetProgress` |
| `inbox-pending` | the review list itself — actionable in place |
| `streak` / `best-streak` | the close shelf |
| `projected-kept` / `projected-balance` | two-track projection, ingredients |

Tiles without a specific mapping fall back to their family's canonical block
set, so all 29 ids work without 29 entries.

### Interaction

One panel open at a time. Opening a second closes the first. This keeps the
screen legible and means at most one detail fetch is ever in flight.

## The close moment

Recording a closing balance is the one deliberate thing the user does each
month. It takes over the screen and lands in four beats:

1. **The measurement.** Ring fills, unrecorded figure counts up.
2. **The verdict.** Under, over, or baseline.
3. **The run.** Streak ticks over; "best run yet" when it applies.
4. **What the month kept.** `Kept` — the domain's own honest counterpart to
   the savings rate — and what it did to the months ahead.

### Three verdicts

- **Under.** Celebrates. Ring completes, flame ticks, one success haptic on
  the phone.
- **Over.** The run resets, because that is what a run is. No scolding: the
  screen immediately states that the allowance is the median of the user's own
  closes and will move on its own. Its second action goes to the ledger,
  because over-spending and under-recording are indistinguishable from a
  closing balance and the app must not claim to know which happened.
- **Baseline.** The first close cannot have a verdict without inventing one.
  It says what it is and names exactly what the next close unlocks.

### No "seen" state

The recap is the close action's own result screen — the user pressed *Record*,
this is what came back. It is never shown by the home on load. So there is no
dismissal flag, no per-user seen state, and no possibility of re-congratulating
someone who merely reopened the app. Revisiting happens through the shelf.

## The run shelf

Every close keeps its card. The `run` family's panel is a shelf of closed
months — one cell per month, filled when under, red when over, hollow when
never closed, with the open month dotted at the end. It is the most
game-shaped surface in the app and it is made entirely of settled figures.

## The year in review

Five beats: the year and what it kept → the run as twelve cells → what it cost
at category scale plus how the unrecorded normal moved → what it built, with
the two tracks and the money-weighted return → where the months ahead point.

Two figures here are not available anywhere else. **Baseline drift** — the
unrecorded normal in January against December — measures a habit changing
rather than a target being met. And the return comes from `xirr.ts`, so it is
money-weighted: the return on what was actually put in and when.

### Two windows

- **Calendar year.** Offered from the first open of January, then permanent as
  a year header in the run shelf. Requires **at least six closes in that
  year**; below that the shelf shows the twelve cells and no recap, because a
  year assembled from two closes would be the app inventing a story.
- **Rolling twelve.** Fires once, at the twelfth close, and only when no
  calendar recap has yet been offered — so a user who started mid-year is not
  waiting up to 23 months for their first one. It is filed at the origin of
  the shelf as "your first twelve months"; thereafter January takes over.

### Sharing

Both recaps share **the run and nothing else** — "5 months under my
allowance", or the twelve-cell grid. No amounts, no categories, no balance.
The app already ships a privacy blur for on-screen amounts and a share sheet
that leaked what the blur hides would undo it. The grid is the most shareable
artifact in the app precisely because it carries no money.

## Motion

The app already has a deliberate cross-client motion system: a 40ms stagger
matched on both clients by comment, a `NOCTURNE_EASING` of
`bezier(0.32, 0.72, 0, 1)`, a 500ms enter, and an `AnimatedAmount` on each
client locked to the same 650ms ease-out cubic. Its doc comment explains the
principle this design inherits:

> the two clients show the same figure and a spring settles on a different
> curve, so the same amount would arrive differently depending on which screen
> you were holding.

**Those constants move into `packages/core/src/motion.ts`** as pure values —
easing control points, enter duration, stagger step, count-up duration. Both
clients consume them and build in their own idiom. This removes the
"matches the other one" comments that are currently the only thing keeping the
two in step.

- **Web** uses `motion`, already in the lockfile and currently unimported, for
  the accordion's layout animation and the close sequence — driven by the
  shared tokens, never by its spring defaults.
- **Mobile** uses Reanimated, as it already does.
- **React Bits stays on the marketing site.** It is GSAP + ScrollTrigger and
  DOM-only; nothing in it can run on the phone, so using it on the home would
  reintroduce exactly the divergence the codebase already rejected. The
  landing page has no phone counterpart and keeps it.
- **The shadcn MCP is not adopted for this work.** The primitive layer is
  `@base-ui/react`, not Radix, and registry components would push the home's
  motion back toward web-only.

**Dead dependencies removed:** `three`, `ogl` and `@types/three` have zero
imports in `apps/web`. `motion` is kept because this design starts using it.

**Reduced motion** is honoured throughout, via the existing
`usePrefersReducedMotion` on web and `useReducedMotion` on mobile. The close
celebration in particular must degrade to a static recap.

## Data flow

The fact pack already holds every figure the spine needs —
`BuildBearingFactsInput` takes `pulse`, `closeSummary`, `unrecordedCap`,
`projection`, `runway`, `allocation` and `returns`. The spine costs no new
query; it is a different reading of a pack the Bearing already gathers.

**Panels open instantly and stream their detail.** A panel's headline *is* its
tile's figure, already loaded, so the accordion opens with correct content on
the first frame. Only the detail beneath it — category rows, close history,
positions — is fetched on expand, and it arrives under a headline that is
already right. Nothing shows a spinner over a number the app already knows,
and the home never waits on five panels' worth of detail it may never show.
Fetched detail is cached for the session and invalidated by the existing
mechanisms (`dataVersion` on mobile, revalidation on web).

## New modules in `packages/core`

All new judgement is pure and tested, matching this repo's existing
architecture. The clients only render.

| Module | Responsibility |
| --- | --- |
| `motion.ts` | Shared easing, durations and stagger step |
| `spine.ts` | Which ignition state applies, as a discriminated union |
| `bearing-panels.ts` | Which blocks a tile's panel shows |
| `year-review.ts` | Assembling a year, including the six-close refusal |

Each gets a `.test.ts` beside it, run by `pnpm test` (vitest in
`@finance/core`). The rolling-twelve-then-calendar trigger rule is tested for
the "fires once, then January takes over" behaviour specifically.

## What is retired

`apps/web/app/(app)/dashboard/` and `apps/mobile/src/app/(tabs)/month.tsx` are
deleted. `/dashboard` redirects to `/bearing` so existing push links and
bookmarks survive. The following all reference it and must be updated:

- 8 × `revalidatePath("/dashboard")` across `lib/actions/phase4.ts`,
  `profile.ts`, `bank.ts`, `month-read.ts`, `month-close.ts`
- `apps/web/lib/revalidate-paths.ts`
- `apps/web/lib/supabase/middleware.ts`
- `apps/web/lib/navigation.ts` — the Bearing's `children` entry
- `packages/core/src/push-digest.ts` — writes `url: "/dashboard"` twice
- `packages/core/src/push-routes.ts` — the `RENAMED` map
- `packages/core/src/bearing-tiles.ts` — `on-hand`, `free`, `savings-rate`
- `apps/mobile/src/components/ProjectionCard.tsx` — routes to `/(tabs)/month`

`manifest.ts` already has `start_url: "/bearing"` and needs no change.

Note that `push-routes.ts` currently claims "Month is `/dashboard` on the web
and `/` on the phone". That comment is already stale — mobile `/` is the
Bearing — so a `/dashboard` push lands on the Bearing today. This merge makes
the mapping honest rather than breaking it.

## Internationalisation

Every user-facing string on these surfaces goes through the `en`/`fr`
catalogues in `packages/core/src/i18n/messages/`, including pre-existing
hardcoded English being carried across:

- `MonthAttention.tsx` renders a hardcoded `Needs you` heading while already
  using `common.needsYou` for its aria-label
- mobile `month.tsx` has `"Ledger"`, `"Plan"`, `"reached"`,
  `` `${n}% of cap` `` and `` `${n}% saved` `` hardcoded

`en.ts` is the schema — `fr.ts` is typed as `typeof en`, so a missing French
key is a type error rather than a surprise on screen.

## Suggested build order

The design is large enough that it should not land as one change. A phasing
that keeps the app shippable at every point:

1. **`packages/core/src/motion.ts`** and the pure modules with their tests.
   Nothing renders differently yet.
2. **The mobile accordion inside `ReorderableList`**, with one family's panel.
   This is the riskiest piece; proving it early is what stops the rest being
   built on an assumption.
3. **The panel system on both clients**, family by family, with Month still
   present. Each family that lands removes a reason to visit Month.
4. **The spine**, including all four ignition states.
5. **Retiring Month** — the two page files and the fourteen references above,
   once every block has a panel.
6. **The close moment.**
7. **The year in review.** Genuinely separable; it could ship later without
   holding anything back.

## Risks

**The accordion is a web risk, not a mobile one.** `BearingTile.tsx` records
that the phone is deliberately a single column and not a bento — "drag-
reordering a grid of mixed spans on a 375px screen is a great deal of
complexity for a layout nobody was asking for". A single column with variable
row heights makes the panel trivial there: the open tile's row simply grows
with the panel inside it, and `react-native-reorderable-list` already supports
variable heights. Opening a panel cancels drag mode so the two gestures never
compete.

The web bento is the harder half, because a full-width panel has to be
inserted into a four-column grid without leaving the holes that `HEAD` and
`REPEAT` were chosen to avoid. The panel therefore takes its own grid row
(`grid-column: 1 / -1`) immediately after the row containing the open tile,
rather than being nested inside the tile. Prove this before building the
panels themselves.

**Next.js 16 streaming.** `AGENTS.md` is explicit that this is not the Next.js
in training data. The exact mechanism for streaming panel detail is to be
verified against `node_modules/next/dist/docs/` during implementation rather
than assumed.

**Panel bloat.** The "blocks per tile, not per family" rule is the only thing
preventing Month reassembling itself inside an accordion. It should be
enforced in `bearing-panels.ts` and reviewed whenever a block is added.

## Out of scope

- Any change to how arrangements are proposed, stored or pinned
- Any change to the bank feed, the review inbox's matching, or fulfilment
- Adopting shadcn primitives or React Bits anywhere in `apps/`
- Yearly push notifications announcing the year in review
