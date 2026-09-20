# The Bearing as five cards, and a narrower app

**Date:** 2026-09-20
**Status:** Design for review — decisions agreed, spec not yet approved

## What this changes

Two things, one of them small.

The app gets narrower on a wide monitor: `xl` drops from 90rem to 72rem.

The Bearing stops being a twelve-tile bento you can drag and becomes a
headline and five cards. The headline says what the accounts hold and what
they are on course to hold at the end of the month. Each card names a family
of figures, opens in place to explain it, and links to the surface that owns
it. Dragging, pinning and the model that chose which figures led are deleted.

## Why

The Bearing shows twelve of twenty-nine figures at once, in an order chosen
by a model, over a layout the reader can rearrange by hand. Three mechanisms
answer the same question — _which of these matters?_ — and the screen answers
it three times without ever saying the one thing a reader opens it for, which
is how much money there is and whether the month is going to be all right.

The width is a smaller story with the same shape. `layout-shell.ts` records
that 90rem was chosen so "the Month surface's two columns and the Ledger's
table" would fit. Month has since been retired. The width outlived its
reason.

## What was already here

Three findings changed the size of this work, all of them in the app's
favour.

**The accordion exists.** `bearing-panels.ts` opens: _"Pressing a tile used
to navigate to the surface that explained its figure. It now expands in
place."_ Panels, their per-family chrome, their block vocabulary and the
lazy fetch behind them are all built and working on both clients. This design
reduces and restyles that machinery; it does not build it.

**Both headline figures exist and are already computed.** `pulse.onHand` is
_"In the accounts"_. `pulse.free` is `onHand - committed + arriving`, defined
in `month-pulse.ts` as _"what the account is on course to hold once
everything the month already knows about has happened"_. That is exactly the
pair the headline wants, and `resolveSpine` already decides when each may
honestly be shown.

**React Bits' `CountUp` was vendored here before and removed.**
`AnimatedAmount.tsx` records why: _"It formatted its own digits with a
thousands separator and took no format function, so it could not render an
amount in the user's currency — which is most of why nothing ever called
it."_ It also renders straight through the privacy blur and needs
`motion/react`, which `knip.jsonc` lists as debt pending deletion. So every
number on this page animates through `AnimatedAmount`, which takes a format
function, honours the blur and reduced motion, and uses the same 650ms
ease-out as the phone so one figure arrives identically on both clients.

## The width

`PageContainer` and `SHELL_HEADER_INNER_CLASS` carry the same four steps and
`layout-shell.ts` warns that they must move together. Only the last changes:

```
sm 32rem   md 48rem   lg 64rem   xl 90rem → 72rem
```

The Ledger's table is the thing to check at the new width, because it is the
widest content the app has.

## The headline

Two figures, stacked, large, and nothing else:

```
In the accounts        1 240,50 €
Yours this month         880,20 €
```

`resolveSpine`'s ladder is kept and reused rather than replaced. Its whole
argument is that what the screen may honestly say grows with the data — a
reader with no bank must not be shown a figure implying one — and that
argument applies unchanged to two figures. `step` decides whether each
figure appears; `headline` narrows from a choice between `free` and
`remaining` to a pair.

The ring and the streak flame are **not deleted**. They move into the Run
card, which is the family they already belong to. `spine.ts`, its ring
ladder and its tests survive intact; only where they are drawn changes.

The attention row stays directly under the headline. It is the one thing on
this screen that asks the reader to do something, and the thin/empty state
already depends on it.

## The five cards

`bearing-facts.ts` puts a `family` on every datum "because the surface groups
by it". One card per family, which is every figure accounted for and no
editorial guessing:

| Card           | Family   | Figures                                                                                        | Leads to                                     |
| -------------- | -------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| This month     | `month`  | 8 — free, committed, arriving, savings-rate, expenses-vs-previous, the three unrecorded        | `/budgets`, `/recurring`, `/history`         |
| The accounts   | `now`    | 5 — net-position, on-hand, invested, invested-share, inbox-pending                             | `/investments`, `/transactions?review=inbox` |
| Your run       | `run`    | 4 — unrecorded-baseline, streak, best-streak, monthly-net-average                              | `/budgets`, `/history`                       |
| The year ahead | `ahead`  | 5 — projected-balance, projected-kept, projected-monthly-net, committed-monthly, runway-months | `/budgets`, `/recurring`                     |
| Wallets        | `wallet` | 7 — cost, gain, return, drag, drift, concentration, contribution-pace                          | `/investments`                               |

Twelve tiles become five cards, and the seventeen figures that used not to
fit gain a home rather than losing one.

### A card does not get one link

Only `wallet` has a single destination. The other four families carry two or
three between them, and `now` and `month` each hold two figures with no
destination at all — `net-position`, `on-hand`, `free` and `savings-rate` are
explained by their own blocks and lead nowhere.

`bearing-tiles.ts` is explicit about what that must not become: _"A tile with
nowhere honest to lead leads nowhere; inventing a destination would teach
people that pressing tiles is a coin flip."_ Picking one href per card — the
most common among its figures — would do exactly that for the minority, and
would have sent "This month" to `/recurring` when most of its figures are
explained on `/budgets`.

So the linking stays where the data already puts it. **A figure row is a link
when its own tile has an href and inert when it does not**, which is today's
rule unchanged. The card's footer lists that family's _distinct_ destinations
— one for Wallets, two for most, three for This month — rather than a single
invented one.

### A card, collapsed and open

Collapsed, a card is its name and its lead figure. Open, it lists its
family's figures and draws that family's blocks, then offers the link.

```
▸ This month                     880,20 €      ← collapsed
▾ This month                     880,20 €
    Still to leave      −412,00 €
    Still to arrive    +1 200,00 €
    Savings rate             18 %
    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    [ spend strip ]  [ still to come ]
    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    Plan →   Charges →   By category →
```

Figure rows that have a destination are links; `free` and `savings-rate`
above are not, and are not dressed as though they were.

### Blocks per family

`bearing-panels.ts` today keys blocks by _tile_, with a partial per-tile
table over a per-family default. With one card per family the per-tile table
collapses, but its curation must not be lost — the reason `free` carries
`month-read` and `arrived-charges` is that those are the expensive blocks and
only the tile that needs them should pay. Per family, taking the best of it:

- `now` — money-on-hand, cash-accounts, recent-on-account, review-inbox
- `month` — arrived-charges, spend-strip, still-to-come, month-comparison,
  month-read
- `run` — close-shelf, month-score, budget-progress, trend, **the ring and
  flame**
- `ahead` — projection
- `wallet` — wallets, weight-bars, fund-cost

`gatherPanelDetail` already fetches a panel's blocks only when its blocks ask
for them, and only when the panel opens. The Month card is the expensive one,
exactly as the `free` tile is today, and it costs nothing until opened.

## The card surface

### Web

Both React Bits components, doing different jobs on the same card rather than
competing: `BorderGlow` lights the edge as the pointer nears it, `SpotlightCard`
follows the pointer across the interior. They are not the same effect, and
layering them is the intended look.

Three adaptations, all required:

**Colour.** Both hardcode a dark palette — `bg-neutral-900`,
`border-neutral-800`, a `backgroundColor` hex prop. Both are rewritten
against the app's CSS variables so the cards follow the theme instead of
pinning a second palette beside it, and so `GLASS_CARD` keeps showing the
veil through them.

**Pointer handling.** Both set React state on every `pointermove`. At one
card that is merely wasteful; at five, each move re-renders a card and every
block inside it — including an open accordion. Both are rewritten to write
CSS custom properties onto a ref, so pointer movement repaints and never
re-renders. This is the same reason `bearing/Tile` and `bearing/Spine`
already animate through CSS rather than through state.

**Reduced motion.** Both effects are suppressed under
`usePrefersReducedMotion`, as every other animation in this app is.

### Phone

The same card list, the same order, the same copy, the same accordion
behaviour, driven by the same core module — and the phone's existing glass
card for the surface. Both effects are DOM and CSS (conic-gradient masks,
`mix-blend-mode: plus-lighter`, `maskComposite`), so React Native cannot run
them; and both are pointer-driven, which a phone has no equivalent of. They
stay a web enhancement rather than something faked under the same name.

## What is deleted

The reorder feature and the arranger behind it, in full:

- **Web** — `BearingGrid.tsx` (drag, pins), `ArrangeButton.tsx`,
  `saveBearingPinsAction`, `readPins`, `app/api/bearing/route.ts`
- **Phone** — the reorderable list in `(tabs)/index.tsx`, the drag state,
  `react-native-reorderable-list`
- **Core** — `bearing-grid.ts` and its tests; `bearing-read.ts`,
  `bearing-prompt.ts`, `bearing-budget.ts` and their tests;
  `mergeArrangement`, `defaultArrangement`, `TilePins`, `slotSpan`,
  `MAX_TILES` from `bearing-tiles.ts`
- **Dependencies** — `@dnd-kit/core`, `@dnd-kit/modifiers`,
  `@dnd-kit/sortable`, `@dnd-kit/utilities` (used nowhere else),
  `react-native-reorderable-list`

`bearing-tiles.ts` keeps what survives: the 29 ids, their hrefs and
`PHONE_PATHS`.

Migration 029's `bearing_arrangements` table is **left in place and unread**.
Dropping it is a migration, and this repo has no way to run one — see
`2026-09-20-soft-delete-and-undo-design.md`. It is recorded as debt here
rather than done blind.

## The shared module

A new `packages/core/src/bearing-cards.ts`, pure and tested, is the one place
that says what the five cards are: family, lead figure, blocks, and the
distinct destinations its figures carry. Both
clients read it, which is what keeps them showing the same five cards in the
same order with the same links. It replaces `bearing-grid.ts` and absorbs the
family half of `bearing-panels.ts`.

## Words

Five card names and the two headline labels are new strings and go through
the en/fr catalogues. The headline labels already exist —
`bearingFacts.onHand` and `bearingFacts.free` — and are reused rather than
rewritten, so the headline says what the figure has always been called.

## Testing

`bearing-cards.ts` is pure and gets tests in `packages/core`, as its
neighbours do: every family has a card, every one of the 29 ids belongs to
exactly one card, every destination a card offers is one some figure in it
actually carries — never an invented one — and the expensive blocks appear on
exactly one card.

`spine.ts` keeps its existing tests unchanged — the point of reusing it is
that its ladder is not being re-derived.

The components themselves have no test harness: `apps/web` has no test files
at all and `apps/mobile` none for components. Verification there is the
typecheck, the reachability gate, a production build, and looking at it.

## Risks

**The Ledger at 72rem** is the one thing the width change could hurt. It is
the widest content in the app and wants checking before the change lands.

**Deleting the arranger is not reversible cheaply.** It is a working, paid
feature with a prompt, a budget, a verifier and stored output. The reason to
delete it is that five fixed cards give it nothing to decide — but if the
card list ever grows back past what a reader can scan, the argument reverses
and the code will have to be written again.

## Debt left behind

**Migration `029`'s `bearing_arrangements` table is unread, and stays.** It
held the model's ordered list of tile ids plus the per-user monthly tally that
rationed the calls; the pins beside it lived in `user_preferences`. Nothing
reads either any more — the prompt, the budget, the verifier, both clients'
callers and the web route are all deleted. Dropping the table is a migration,
and this repo has no way to prove one here: there is no usable
`supabase/config.toml`, no Docker to start a local stack against, and no
database tests. So it is recorded rather than done: a `DROP TABLE` written
blind and merged unrun is a worse artefact than an empty table nobody queries.

The rest of `029` is the same debt and is listed here so a later migration can
take the lot in one pass rather than discovering it piecemeal:

- `bearing_arrangements`, the table, with its RLS policies and its
  `tally_month` constraint.
- `reserve_bearing_arrangement(...)`, the function that took the reservation
  before the call and rolled the tally when the month turned. Nothing calls
  it.
- `user_preferences.bearing_pins`, a `jsonb` column, plus the
  `user_preferences_bearing_pins_is_object` check constraint and the
  `bearing_pins_valid(jsonb)` function behind it. A column, not a key inside a
  blob, so dropping it is a migration too.

None of it is reachable from either client. None of it costs anything while it
sits there, which is the only reason leaving it is defensible: the cost of a
`DROP` written blind and merged unrun is higher than the cost of an empty
table nobody queries.
