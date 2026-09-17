# Bearing panels — why it is like that

This is the decision record for the plan that made every Bearing tile expand
in place into a panel explaining its own figure, on both clients
(`2026-09-15-bearing-panels.md`, spec
`docs/superpowers/specs/2026-09-15-bearing-month-merge-design.md`).

It exists because the plan was executed through a workspace that is not
tracked in git. Every ruling below was made and recorded there, and all of it
would have vanished when that workspace was deleted — including the rulings
that explain why several deliberate-looking oddities in this code are
deliberate. Written for whoever reads the merged history later and asks "why
is it like that?", rather than for anyone who was there.

Each entry says what was decided, why, and what it costs if the decision turns
out to be wrong. Where a decision reverses an earlier one, both are kept: the
reversal is usually the more interesting half.

---

## Before any code was written

**The work ran on `merge-bearing-and-month` in the main checkout, not in a git
worktree.** The branch was not `main`, the tree was clean, and the plan touches
both apps plus core — a worktree would have forced a second install of a
700-package workspace for no isolation gain. *Cost if wrong:* nobody can run
the app on another branch while this is in flight.

**`rowEndIndex` takes the column count as a parameter rather than assuming
four.** The bento is four columns on a desktop and two on a phone, and the two
counts disagree about where a row ends. The alternative on offer was to hardcode
four and "make it conditional later", which is how an untested branch ships.
*Cost if wrong:* a slightly wider signature than strictly needed. (This turned
out to matter for a different reason — see the row-span defect below.)

**The catalogue task moved ahead of the two client tasks.** Its message keys
are independent of everything else, and leaving it last would have meant the
panels referencing `bearing.panel.*` keys that did not exist yet — a type
error, since `fr.ts` is typed against `en.ts`. Execution order became
1, 2, 3, 7, 4, 5, 6, 8. *Cost if wrong:* none identified.

**The panel's block-fallback test uses a tile with no per-tile entry.** A test
that happens to pick a tile with its own `TILE_BLOCKS` entry never exercises
the family fallback at all. *Cost if wrong:* the fallback path ships untested.

---

## Reversed along the way

Two pre-flight decisions were overturned once the code existed. Both reversals
are load-bearing and both are why the two clients look less symmetrical than
you might expect.

**`PanelDetail` lives in each app, not in core.** The plan put it in
`packages/core`. Doing that would have meant migrating `BankMovement`,
`PendingFeedRow` and a close-overview shape out of the web app's query modules
into core first — three Supabase-row-shaped types that are query concerns, not
domain concerns, and a task of their own rather than a rider on the largest
task in the plan. The web app's copy is spelled
`Awaited<ReturnType<typeof query>>` throughout so it cannot drift from the
queries it wraps. *Cost if wrong:* the phone declares the same shape a second
time.

**The phone does not fetch panel detail through the web app.** The plan had it
calling a new `/api/bearing/panel` route. It gathers from Supabase directly
instead, exactly as `gatherBearingFacts` already did for the tiles themselves —
every table a panel reads is select-own under row-level security, and routing
the read through the web app would have cost the phone its offline reading for
no gain. This also dissolved a "duplication risk" the ledger had been carrying:
with each client gathering its own detail there is no wire contract to share.
The shared truth is `bearing-panels.ts` — which blocks a tile shows — and that
was always in core and always tested. *Cost if wrong:* none identified; it
removes a round trip, a route and an auth path.

---

## Decisions inside the implementation

**The drag handle is inert while that tile's own panel is open.** This is the
one that looks most like a bug and is not. `react-native-reorderable-list`
measures a row's height and its neighbours' shift distance *synchronously*,
before our code gets a chance to close the panel in response to a drag
starting. A live handle on an open tile would size the whole gesture to the
panel-open height while the tile shrank back underneath it. Two other options
were considered and rejected: patching inside the vendored library (which we do
not own and would lose on upgrade), and documenting a glitch we know how to
avoid. It is also the right product call on its own terms — opening a panel is
"I am reading this", dragging is "I am arranging", and a tile being read is not
one you are also reordering. *Cost if wrong:* a reader must collapse a panel
before dragging that one tile, on the tile they are already touching.

**The panel's close is a hard jump cut.** Opening animates; closing just
unmounts. Holding a closed panel mounted so it could shrink would leave a
zero-height grid child with the bento's gap on either side of it — a seam that
outlives the panel — and two live panel rows would fight the single-seam model
in `bearing-grid.ts`. The suggested improvement, if this reads as unfinished, is
a short opacity fade on the row before unmount, which needs no second live row.
*Cost if wrong:* a reader who watches a smooth open and gets an instant vanish
reads it as unfinished. This is on the human checklist as a judgment call.

**`now` panels ignore the month entirely.** "Now" is today and a balance is only
ever true now; showing a live balance beside March's totals would invite
arithmetic across two different moments. The budget-view toggle is a different
axis and is *not* covered by this decision — see the Plan 2 list.

**A panel explains its own tile, not its whole family.** `month` is the fattest
family and a panel rendering all of it would have been the Month screen in an
accordion, which is the opposite of what this plan is for. `free` gets the
spend strip, what is still to come and the month in words; the eight other
month tiles get whatever explains them and nothing else.

**The month read is named on a tile, not on a family.** It is the most
expensive thing any panel can ask for — a dozen reads and two fact packs — and
a family-wide entry would have charged all nine month tiles for a block eight of
them do not show.

**Ten existing components were routed through the translation catalogues
mid-plan.** `MonthScore`, `CashAccountsCard`, `RecentOnAccount`, `StillToCome`,
`MonthWallets`, `MoneyOnHand`, `MonthRead`, `MonthCloseHistoryCard`,
`ProjectionCard` and `FundCostCard` all carried hardcoded English. They had only
ever been on Month; the panels put them on the Bearing, and the standing rule is
that every user-facing string on a surface we touch goes through the
catalogues — including English we merely inherited. This is why the diff is much
wider than "add a panel". *Cost if wrong:* a larger diff than the feature needs,
against a rule the project applies deliberately.

**The dead `ingredients` block was removed rather than kept as a null arm.** It
was defended on the grounds that `ProjectionCard` does not draw ingredients.
Both clients' `ProjectionCard` do — the phone's under a comment reading "the
ingredients are the point, not trim" — so core was promising a block no client
draws. A block that renders nothing is a gap, not a design.

---

## Decisions made in the final review's fix wave

**`hero` is two rows tall, and the row model had to learn it.** `bearing-grid.ts`
found the seam for an opening panel by adding up column spans, which silently
assumed every tile was one row tall. `hero` is `col-span-2 row-span-2`, so from
the second row on the model drifted a row short of the real layout and every
`wide` tile opened its panel a full row too low, with three unrelated tiles
between the figure and the panel explaining it. Dense backfill filled the gap
the panel skipped, so it never looked like a hole — which is why it passed both
a green suite and a human looking for holes. The model now places tiles the way
the browser does.

Two riders travelled with that fix and are worth knowing about:

- The test used to re-derive the implementation's own arithmetic, so the code
  and its test were two spellings of one assumption. It now asserts a
  hand-written table of the real bento at both widths and agrees against a
  separate cell-by-cell walk of dense auto-placement. Against the old
  implementation it fails thirteen ways.
- The doc comment on `HEAD` in `bearing-tiles.ts` claimed a two-row span "was
  tried and dropped" for leaving auto-placement holes. Hero is two rows tall
  today and leaves none. The claim outlived the experiment and is the likeliest
  reason the row model was written as a column sum in the first place.

**The phone's panel footers got their own path table.** `BEARING_TILES` records
the *web* router's paths, and the phone forwarded them to `router.push` behind
an `as never` cast that suppressed exactly the check that would have caught the
problem: fifteen of the twenty-six tiles with a footer link named a screen Expo
Router has never had. The phone's translation lives in `phoneHref` in core, with
a test walking every tile against the phone's route list.

- `/dashboard` → `/month`. The web path was never renamed (see `navigation.ts`)
  and Month is the phone screen it means. The tab layout already describes Month
  as reached "from a Bearing tile, not the bar".
- `/budgets` → `/planning`. Plan is where the phone keeps budget caps, goal
  pacing, projections, runway and the close history — the whole of what those
  ten tiles are about.
- `/history` → `/month`. The web's `/history` is the Ledger's by-category view
  and the phone's Ledger has only the list and the calendar. Month draws the
  month-against-previous comparison and the net-per-month trend that those two
  tiles *are*, so it is the nearest thing that answers what they ask. Building a
  by-category screen for the phone would have been new UI this plan did not
  scope.

  **Note for Plan 2:** two of those three now point at Month, which Plan 2
  retires. When Month goes, `PHONE_PATHS` needs revisiting, not just deleting —
  five `now`/`month` tiles and two history tiles lose their destination with it.

**Web keeps two links on the four `unrecorded-*` panels, and that is
deliberate.** Those panels render `MonthScore`, which carries its own "set this
up" link, above the panel's generic footer link — and on all four tiles both
currently point at `/budgets`, which reads as redundant. They are not: the footer
is the panel's fixed contract (where the tile used to lead), while `MonthScore`'s
link is a state-dependent call to action whose destination *changes* with state —
an over-recorded month is sent to `/transactions` to find the missing entry, an
unconfigured one to `/budgets`. Suppressing either would delete a destination the
other never offers. *Cost if wrong:* four web panels carry two links where a
reader might expect one; the human checklist asks the user to judge whether it
reads as clutter.

**The figures clear when the panel's scope moves.** The chrome's month label is
plain state and paints immediately; the figures only arrive when the fetch
lands. Stepping the month used to leave the header saying August over July's
spend strip, still-to-come and budget rings. The blocks now fall back to the
same skeletons the panel opens with — and on the phone are re-seeded from the
session cache first, so a month already visited returns with no skeleton at all.
This trades a brief skeleton for never stating a wrong number confidently, which
is the same rule that keeps a spinner off the headline.

**A write made inside a panel clears the panel cache itself.** It used to rely
on the Bearing screen's `dataVersion` effect to do it. React flushes passive
effects child-first, so the panel's own refetch ran *before* that clear and read
back the entry it had just written over. Relying on a parent's effect to
invalidate something a child is about to read is the shape of the bug, not the
timing; the clear now happens where the write does.

---

## Known and deliberately not done

These are real, were judged, and were left. They belong to Plan 2, which is
already in this code.

**Web's `on-hand` panel has no budget-view toggle, and the phone's does.** The
phone lets the reader flip between "as of today" and "as of month end" inside
the card; web's `MoneyOnHand` only displays which view is in force, and web's
`gatherNow` hardcodes `"current"` rather than reading the scope. Closing this
means *adding a control* to a web panel — new UI needing its own design and
review, not a fix-wave edit, and the finding that raised it could not be tied to
a confirmed review item. On the human checklist so the divergence gets a human
ruling. *Cost if wrong:* the two clients keep offering different controls for
the same panel for one more plan.

**The phone's `MonthScore` has no internal call to action at all.** This is the
mirror image of the two-links decision above: a phone reader cannot reach "find
the missing entry" for an over-recorded month, because that destination only
exists inside web's `MonthScore` link. A genuine parity gap, but closing it is
new mobile UI. *Cost if wrong:* phone users keep missing an action web has had
all along — a pre-existing gap, not one this plan created.

**Web and mobile stagger differently past the eighth item in a list.** Mobile
caps at `STAGGER_MAX_STEPS`; web's `Stagger` takes an uncapped prop and two call
sites override it. Pre-existing, surfaced by consolidating the motion constants,
and closing it is a visual decision rather than a cleanup. Only `InvestmentsView`
is long enough to reach it today.

**`MonthCloseHistoryCard`'s empty state on the phone names a "Home" surface that
no longer exists in this app's navigation.** User-facing wrongness rather than
cosmetics — it sends someone to a surface that was removed — but fixing it means
choosing replacement copy, and copy is the user's decision rather than one to
make inside a fix round.

**Smaller things, all judged harmless:** `useGridColumns` calls
`window.matchMedia` fresh in both its snapshot and its subscribe rather than
caching the `MediaQueryList`; `apps/web/lib/bearing/panel-detail.ts` is long
enough to split, and if it is ever split the seam is `monthFigures` plus the
three gatherers that share it; web converts the stagger step from milliseconds
to seconds at the call site; no test asserts `DURATION.enter` or
`DURATION.panel`; `CashAccounts` builds one className with an inline ternary
instead of the `cn()` helper used everywhere else.

---

## Two things about this branch's history

Recorded because they are visible in `git log` and look like mistakes, which
one of them is.

**Commit `499cd56` has no blank line before its trailer**, so its
`Co-Authored-By:` is glued to the subject and shows inline in
`git log --oneline`. **Commit `674ec03`'s subject begins `Fix:`**, a
conventional-commits prefix at odds with this repo's plain descriptive-sentence
style. Both were found while work was still being committed to the branch, and
rewriting history under an active writer risks losing work — so they were left
for the user to decide on, when a reword of two commits is trivial.

**Each commit is co-authored by the model that actually wrote it** rather than
uniformly by the session that orchestrated the plan. That is more accurate, not
less, and is deliberate.
