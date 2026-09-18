# Spine and Month retirement — human checklist

This plan put a fixed spine — headline figure, ring, streak flame, and a row
naming the one thing most worth doing — above the Bearing's bento, then
retired the Month screen entirely: everything it used to say is now said by
the panel that opens under a tile, or by the spine itself. Automated tests,
lint and type-checks all pass (see the verification report beside this file
for the actual numbers). What follows is what no command can check.

Work through it in one sitting; you don't need to have read the plan first.
Items are ordered by how badly it goes wrong if the item turns out bad, not
by when the item came up during implementation. For each item: background,
what to do, what you should see, and what it would mean otherwise. A few
items near the end ask for your opinion rather than a bug report, and say so
plainly.

Some claims below were never run on a device — traced by reading the code and
the router, not tapped. They're marked **unverified** where they appear, and
gathered again at the end so you have the full list in one place.

---

## 1. Can you find the "Did this arrive?" question? (most likely to be quietly wrong)

**Background:** every month, some recurring charges land differently than
planned — a subscription that renewed early, a bill that didn't show up at
all. The app used to ask "did this arrive?" on the Month screen, which you
opened daily. Month is gone. That same question — proposals to confirm,
charges that seem to have missed — now renders as an `ArrivedCharges` block
inside the panel that opens under the **`free`** tile and under the tile
about **charges due** (`arriving`). Nothing else asks it. The spine's action
row (the single "most worth doing" line under the ring) has five possible
items — a swallowed bank entry, a month ready to close, an uncategorised
inbox, recurring items ready to apply, a newly-noticed repeat charge — and
none of them is "confirm what arrived." You can read the full list in
`packages/core/src/attention.ts`; there is no sixth item for this.

**What to do:** in a month where at least one recurring charge should have
landed differently than planned (early, late, or not at all), open the app
fresh — do not deliberately go looking for the `free` or "charges due" tiles.
Just use the app the way you normally would for a few minutes, then
afterward, deliberately open the `free` tile's panel and check whether the
unconfirmed charge was sitting there the whole time.

**What you should see:** if nothing on the spine, the bento, or anywhere else
told you a charge needed confirming, and you only found it by opening a
specific tile's panel and scrolling to the bottom, that is the behavior as
built.

**What it would mean otherwise:** this is not a defect to report — it is a
cost to weigh. An unconfirmed proposal means the month's forecast either
drops a real payment it should have counted, or double-counts a charge that
already posted under a different description. The screen that used to force
this question into view daily no longer exists, and nothing replaced its
insistence. Worth deciding, as a team, whether the action row needs a sixth
item for this before the next reader loses a real payment from their
forecast because they never opened `free`.

---

## 2. All four ignition rungs, and whether you can tell which one you're on

**Background:** the spine has four rungs it can be standing on, and each one
can show strictly less than the one above it — never something misleading.
In order: **`no-balance`** (no readable bank balance at all — the headline
falls back to the plain "left this month" figure, labelled honestly as that,
never as the "free to spend" figure); **`no-close`** (a bank is connected but
nothing has ever been closed — the ring is dark); **`measuring`** (one close
has happened but no cap is set yet — the ring is a blue, unproportioned arc);
**`lit`** (a cap exists — the ring is a full proportion, coloured by how the
month is standing). The ladder itself is unit tested rigorously
(`packages/core/src/spine.test.ts`); what no test covers is whether a reader
looking at the screen can actually tell which of the four they're looking at.

**What to do:** if you can arrange it, look at the spine in each of the four
states — a fresh account with no bank connected, one with a bank but no
closes yet, one with exactly one close and no cap, and a fully set-up
account. If you can't reach all four, at least compare two adjacent ones side
by side (screenshots are fine).

**What you should see:** each rung should read as visibly different from its
neighbors — not just "the ring looks slightly different" but "I can tell
without thinking about it whether this account has ever closed a month or
set a cap." The headline label should also make it obvious when you're
looking at "what's left" versus "what's free," never blur the two.

**What it would mean otherwise:** if two adjacent rungs look almost
identical, or if the headline's label doesn't make clear which figure it is,
readers will misread their own standing — worth reporting with a screenshot
of both rungs side by side.

---

## 3. Over-recorded months show NO ring — not a dark one

**Background:** when the account holds more money than the ledger says it
should (a records gap — a deposit or transaction that was never entered),
the ring doesn't dim or darken. It disappears entirely (`{ kind: "absent" }`
in `spine.ts`). This is deliberate: a records gap is a different finding from
overspending, and the code is emphatic that showing *any* ring here would be
drawing a measurement the app has no grounds to make.

**What to do:** get an account into an over-recorded state (the bank balance
reads higher than the ledger implies it should), and look at the spine.

**What you should see:** no ring at all where the ring normally sits — not a
grey circle, not a dashed outline, just absent. The headline figure and flame
should still be there as normal.

**What it would mean otherwise:** if you see a dimmed, greyed-out, or
otherwise still-visible ring, the "absent" case isn't rendering as absent —
report it, since the whole point of this rule is that a records gap must
never look like a verdict about spending.

---

## 4. A capless month's arc must never read as a verdict

**Background:** the `measuring` rung's ring is blue and deliberately
unproportioned — it carries no `tone` at all (the type itself has no field
for one; see `spine.ts`'s own doc comment). The reasoning: a measurement
with no target cannot be a judgement, so this ring must not accidentally
look "good" or "bad."

**What to do:** reach the `measuring` state (one close done, no cap set) and
look at the ring's shape and color without any other context.

**What you should see:** it should read as neutral — a plain blue arc that
doesn't resemble the "on track" green or "over" red states from the `lit`
rung. If you show it to someone without explanation, they shouldn't guess
"that looks like it's going well" or "that looks bad."

**What it would mean otherwise:** if it visually echoes one of the `lit`
rung's tones, the design has failed even though the code correctly withheld
a `tone` field — this is a "does it read right" judgement call, worth
raising even though nothing is technically wrong.

---

## 5. `tone` colours the ring; `over` fills it — and the two must stay distinguishable

**Background:** once a cap exists, the ring's colour comes from `tone`
(`MonthStanding` — roughly "on track" vs. "short") and whether it's over cap
comes from a separate `over` flag. A `clear` month that's over its cap must
not look identical to a `short` month that's over its cap — this was wrong
once during the plan and was fixed (see commit `1274853`, "Fix the spine's
dark/arc boundary and stop its ring colour eating the over-cap signal").

**What to do:** if you can, get one account into "clear but over cap" and
another into "short and over cap," and compare the rings.

**What you should see:** the over-cap fill/marker should be visually
distinguishable in both cases, and the underlying tone colour should still
be readable through it — the over-cap signal shouldn't erase the standing
signal or vice versa.

**What it would mean otherwise:** if the two look the same, the fix
described in the commit above may have regressed, or covers only some
combinations. Worth a screenshot of both.

---

## 6. The flame against a best streak

**Background:** the flame badge shows the current streak (a filled flame
icon) and, separately, a trophy badge for the best streak ever reached — but
only when the best streak beats the current one and is itself worth
mentioning (`best > streak && best > 1` in both clients' `FlameBadge`). Get
the current streak high enough and the trophy badge should disappear on its
own, because there is nothing left to compare it against.

**What to do:** reach a month where the current streak is below your best
ever streak, and look at the flame area. Then, if you can, keep closing
months until the current streak matches or passes the best streak, and look
again.

**What you should see:** while behind your best, both badges show — the
flame with the current count, the trophy with the best. Once the current
streak catches up to or passes the best, the trophy badge should quietly
disappear, leaving only the flame.

**What it would mean otherwise:** a trophy badge that lingers after the
current streak has caught up (or shows a number that doesn't match either
figure) means the `best > streak` comparison isn't wired the way the code
intends — worth reporting with both numbers as you saw them.

---

## 7. `/dashboard` redirects rather than 404s

**Background:** Month used to live at `/dashboard`. Bookmarks and
already-delivered push notifications point there, and they were written
before this plan and can't be retroactively fixed. `apps/web/next.config.ts`
now redirects `/dashboard` rather than letting it 404.

**What to do:** with a logged-in session, navigate directly to
`/dashboard` (typed in the address bar, or via an old bookmark if you have
one).

**What you should see:** you land on a working page — the Bearing — not a
404 or an error screen.

**What it would mean otherwise:** a 404 here means an old notification or
bookmark now dead-ends for real users, which is exactly the case this
redirect exists to prevent.

---

## 8. Every phone attention link lands on a real screen — **unverified by tap**

**Background:** the spine's action row can point at one of five
destinations on the phone: `/transactions` (a swallowed entry), `/budgets`
(ready to close — rewritten to `/planning` via `attentionHref`),
`/transactions?review=inbox` (uncategorised entries), `/transactions`
(recurring ready to apply), or `/recurring` (a newly noticed repeat charge).
All five were checked against the phone's router by reading the code; nobody
has actually tapped through all five on a device.

**What to do:** get the phone app into a state where each of the five
attention conditions is true (one at a time is fine), and tap the action
row's link each time.

**What you should see:** each tap lands on a real, working screen that makes
sense for the condition described — not a blank screen, not a crash, not a
route the navigator doesn't recognize.

**What it would mean otherwise:** a broken link here means `attentionHref`
or the phone's route table has a gap the type-checker can't see — note
exactly which of the five conditions you were testing.

---

## 9. Three phone panel footers now render NO link — confirm that reads as deliberate

**Background:** on the phone, three tiles — `on-hand`, `free`, and
`savings-rate` — used to have a footer link to the Month page. Month is
gone, and everything those three figures used to explain on Month is now
said inside the panel that opens under the tile itself, so their footer
link was removed rather than repointed (`bearing-tiles.ts`'s own comment:
"there is no further surface to send a press to").

**What to do:** on the phone, open the panel for `on-hand`, `free`, and
`savings-rate` in turn, and look at the bottom of each panel.

**What you should see:** no footer link on any of the three — the panel
should feel complete on its own, not like something is missing where a link
used to be.

**What it would mean otherwise:** if the panel's bottom looks like it's
missing something (an empty row, odd spacing where a link would have been),
that's a layout residue worth reporting even though the absence of a link
itself is correct.

---

## 10. A phone reader can complete a close end to end — **unverified, traced by reading only**

**Background:** this plan restored the ability to close a month directly
from the phone (it had been lost along with Month). Two reviewers traced the
whole path — trigger, sheet, submit, and the history card updating below —
by reading the code. Nobody has actually run it on a device.

**What to do:** on the phone, trigger a month close from wherever the spine
or a panel now offers it, fill in the sheet, submit, and check that the
close history card below reflects the close you just made, without needing
to leave and come back.

**What you should see:** the whole flow completes without a crash or a stall,
and the history card shows the new close immediately.

**What it would mean otherwise:** any break in this chain is severe — it is
the one thing this plan explicitly set out to give back to the phone. Note
exactly where it broke: the trigger, the sheet, the submit, or the history
card's refresh.

---

## 11. The slide-out artifact on cancelling a close

**Background:** restoring the phone's close sheet as a slide-in modal (it
had previously just unmounted) brought back a small cosmetic cost:
`dismiss()` in `MonthCloseSheet.tsx` resets the form's state (`setBalance("")`,
`setStage("entering")`, `setResult(null)`) synchronously, while the modal is
still animating away. So if you cancel from a reached "here's what this
means" reveal screen, the reveal is visibly replaced by the empty starting
form for the fraction of a second the modal takes to slide out. This was
previously impossible because the whole component used to unmount instantly
instead of animating.

**What to do:** open the close sheet, get to the "here's what this means"
reveal (enter a balance, press through to the check step), then cancel out
without confirming. Watch closely during the slide-out.

**What you should see:** you'll likely see the form flash back to its
starting, empty state for a moment while the sheet is still visibly sliding
off screen.

**Your call:** this is a known cosmetic cost, not a hidden bug — the question
is whether it reads as sloppy enough to fix. If it bothers you, the
suggested fix (already known, not yet done) is to reset the form on the
*open* transition instead of inside `dismiss()`.

---

## 12. Device-only claims, never run — modal presentation, keyboard, haptics, real round trip

**Background:** several claims about the phone's close sheet and related UI
were traced by reading the code and were never exercised on an actual
device or simulator. Listing them together here because they share the same
caveat.

**What to do, and what you should see, for each:**

- **Modal presentation above the tab bar.** Open the close sheet and confirm
  it visually sits above the bottom tab bar rather than being clipped by or
  appearing beneath it.
- **Keyboard occlusion of "See what that means."** Open the close sheet,
  bring up the keyboard to type a balance, and check whether the "see what
  that means" control is still reachable/visible, or whether the keyboard
  covers it.
- **Haptics.** Every haptic call mentioned in this plan (segmented control
  taps, a successful close, etc.) was written correctly by reading, but
  nobody has felt one fire on a real device.
- **A real Supabase round trip.** The close flow, the recurring-apply flow,
  and the bank inbox review were all checked against mocked or in-memory
  data. Nobody has run the full flow against a live Supabase project to
  confirm the writes land correctly.

**What it would mean otherwise:** any failure here is a real defect no
automated gate could have caught — the type-checker and tests only prove the
code is internally consistent, not that a device renders or a network call
succeeds the way the code assumes.

---

## 13. Both languages, on the whole spine

**Background:** the spine is new UI drawn on both clients, all of it routed
through the i18n catalogues (`packages/core/src/i18n/messages/en.ts` /
`fr.ts`). The ring's accessibility label is worth special attention: it
deliberately states **both** the standing (on track / short) and the
over-cap fact, rather than one replacing the other, so a screen reader user
gets the full picture in one sentence.

**What to do:** switch the app to French on both web and phone. Look at the
spine in as many of the four ignition rungs as you can reach: the headline
label, the ring (and its accessibility label, if you can inspect it with a
screen reader or the accessibility inspector), the flame's streak text, and
the action row's message and call-to-action text.

**What you should see:** everything reads as a real French sentence — no
leftover English, no obviously machine-translated phrasing, nothing
truncated or overflowing because the French ran longer than the English.
The ring's accessibility label should mention both the standing and the
over-cap fact when both apply, not just one.

**What it would mean otherwise:** any odd-reading string is a
translation-catalogue bug — report it with the exact rung and the string you
saw. A label describing only one fact when both should be present means the
accessibility string isn't concatenating correctly.

---

## 14. The phone's attention rows in French

**Background:** before this plan, the phone's version of these attention
messages was untranslated English — a bug that lived on Month's own
`AttentionSlot` and was retired along with the screen rather than fixed in
place there. The new, shared `attention.ts` module routes everything through
`t()`, so this should be fixed as a side effect, but it's worth confirming
directly rather than assuming.

**What to do:** in French, get the phone into each of the five attention
states in turn (or as many as you can reach) and read the action row's
message and its call-to-action text.

**What you should see:** real French throughout, for every one of the five
conditions — not just some of them.

**What it would mean otherwise:** any English string surviving here means
one of the five `AttentionId` cases missed a catalogue key on the phone
side specifically (the web side draws from the same module, so if web looks
right and phone doesn't, that narrows it to the phone's rendering, not the
shared data).

---

## 15. Both clients, reduced motion on

**Background:** both the web and phone spines wire explicit reduced-motion
handling for the ring's fill animation (`usePrefersReducedMotion` on web,
`useReducedMotion` from Reanimated on the phone) — this isn't relying on a
library default, each one checks and skips its own animation.

**What to do:** turn on "reduce motion" in the OS accessibility settings on
both platforms, then load the Bearing screen and reach a state where the
ring would otherwise animate (e.g. a `lit` ring filling in, or a proportion
changing after a close). Also check the close sheet: it should not slide.

**What you should see:** the spine simply appears already in its final
state — no filling ring, no counting animation — on both clients. The close
sheet should appear without a slide transition too.

**What it would mean otherwise:** if the ring still visibly fills or the
sheet still slides with reduced motion on, that client's wiring isn't taking
effect for this specific piece of UI (it may still work correctly
elsewhere).

---

## 16. The action row's first item, and its `+N`

**Background:** before this plan, web and phone disagreed about what
deserves attention — web checked five conditions, phone checked three. They
now share one fixed priority order, defined once in
`packages/core/src/attention.ts`: a swallowed bank entry first (a records
problem, outranks everything), then a month ready to close, then three
errands in a fixed order (uncategorised inbox, recurring ready to apply, a
newly noticed repeat charge). The row shows only the top item plus a "+N"
count for the rest.

**What to do:** get into a state where at least two of the five conditions
are true at once, and look at which one the spine shows first and what the
`+N` reads.

**What you should see:** the item shown first should match the priority
order above (records problems before ritual, ritual before errands), and
`+N` should equal exactly however many other conditions are also true.

**Your call:** does the item it picks first actually feel like the right one
to be told about first, in practice? This is a judgement question the
ordering comment in `attention.ts` argues for, not a test that can fail —
worth recording your reaction either way.

---

## 17. Does the spine read as fixed chrome, or as a thirteenth tile?

**Background:** the spine sits above twelve tiles of varying size, and was
deliberately built without any of the visual language the tiles use — no
glass card, no rounded corners, no drag handle, just a hairline underneath.
The intent is that it reads as the fixed thing the bento is arranged
beneath, not as one more card in the set.

**What to do:** look at the whole Bearing screen — spine plus grid — as a
first impression, the way a new reader would.

**Your call:** does the spine feel structurally different from the tiles
below it (fixed, header-like), or does it just look like a slightly odd
tile at the top? There's no wrong answer, but it's worth recording since the
whole design bet rests on the former reading being obvious.

---

## 18. Pressing an already-selected segment is now silent

**Background:** both clients' `SegmentedControl` now guard against
re-firing `onChange` when you tap the segment that's already selected — and
on the phone, the haptic tap sits *inside* that same guard, so tapping an
already-selected segment produces no haptic at all, not even an
acknowledgment tap.

**What to do:** on the phone, tap a segmented control's already-selected
option.

**What you should see:** nothing happens — no state change, no haptic.

**Your call:** does silence here feel right (nothing happened, so nothing
was acknowledged), or does it feel like the control missed your tap? Not a
bug report — this was a deliberate placement decision, and the team should
decide if it's the right one.

---

## 19. `TrendCard`'s range switch and "best month" badge are gone — do you miss them?

**Background:** the standalone `TrendCard` used to let you switch between
6-month, 1-year, and 2-year windows and called out a "best month" badge.
That whole component is gone along with Month; the trend now renders inside
a bearing panel via a shared `presentTrend` function, at a single fixed
default window, with no range switch and no best-month badge.

**What to do:** open the panel that shows the trend (the `month`-family
panel's trend block) and look for a way to change the time window or find a
"best month" callout.

**What you should see:** neither exists — the bars are the same bars at the
same default window every time.

**Your call:** do you miss being able to widen or narrow the window? Properly
restoring that needs new chrome designed for the panel context, not a
revert to the old component — worth recording whether it's worth that work.

---

## 20. A quiet month between two busy ones — vanish, or show flat?

**Background:** the restored inactive-month filter (`presentTrend` in
`packages/core/src/monthly-trend.ts`) drops any month with no income and no
outflow both from the chart itself and from the count that decides whether
you see a chart at all versus a "not enough data yet" message. This
reproduces exactly what the old `TrendCard` did — so it's a restoration, not
a new choice. But `bucketMonthlyTrend`'s own doc comment in the same file
argues the opposite position: "a gap in a trend is information: a month
with no rows is a flat stretch, not a missing point." Both readings are
defensible, and the implementer deliberately didn't pick between them —
`presentTrend` filters, `bucketMonthlyTrend` (which it wraps) doesn't.

**What to do:** if you have (or can construct) a month with genuinely no
income and no outflow sitting between two active months, look at the trend
block in a `month`-family panel.

**What you should see:** the quiet month simply isn't there — the trend
jumps from the month before it straight to the month after, with no flat bar
in between, and the "how many months of data" count used to decide whether
you see a chart at all does not count that month either.

**Your call:** is that the right read, or should a quiet month show as a
flat bar at zero instead? This is explicitly unresolved — whichever way you
land, it settles a real disagreement recorded in the code's own comments.

---

## 21. Four web MonthScore tiles carry two links — clutter, or two different destinations?

**Background:** on web, opening `unrecorded-so-far` (or `-allowance`,
`-over`, `-baseline`) shows two links: the panel's own footer link (always
the same destination) plus `MonthScore`'s own state-dependent call to
action (its destination changes with the month's state — an over-recorded
month sends you to the Ledger to find the missing entry, an unconfigured
one to Budgets). They're not duplicates of each other, but they sit close
together.

**What to do:** open one of those four panels on web, ideally once in a
normal month and once in an over-recorded one, and look at both links
together.

**Your call:** does having both read as useful (two genuinely different
destinations), or as clutter (too many exits from one panel)? Not a defect —
this was argued over and kept deliberately; if it reads as clutter, that's
worth writing down since the decision to keep both can be revisited.

---

## 22. The web `now` panel has no budget-view toggle — confirm it doesn't feel missing

**Background:** the phone's `on-hand` panel has a control that flips the
figures between "as of today" and "as of month end." The web app's
identical panel has no such control — it only states which view is in
force. Per the plan's own family table this is correct as specified (both
clients render chrome from the same map, and web's `now` family is set to
`"none"` for this), so this is not a defect to fix here — it was resolved
without work and is only listed so a fresh pair of eyes confirms it.

**What to do:** open the `on-hand` panel on web and look for a way to
switch between "as of today" and "as of month end."

**What you should see:** no control — just a stated fact about which view
you're looking at.

**Your call:** does its absence feel like a missing feature, or does the
web panel read as complete without it? No action needed either way; this is
here so the gap doesn't get silently rediscovered later as a "bug."

---

## What the green checks do not speak for

Two real defects on this branch were caught only by reading the source, not
by `tsc`, lint, or `vitest`:

- **Components that type-checked perfectly while being unreachable.**
  Nothing in the automated suite notices a component that compiles cleanly
  but is never imported or rendered from any live path — that only shows up
  by tracing what actually calls what.
- **A layout fix that made things worse.** A change intended to fix
  positioning regressed it further, and every gate still passed, because
  none of them render React Native layout or evaluate whether a fix visually
  helped.

Keep that in mind reading this whole document: a clean `pnpm test`, clean
`tsc --noEmit` on all three packages, and the lint counts matching baseline
are all true right now, and none of them are evidence for anything in items
1–21 above. They prove the code is internally consistent; they do not prove
a human looking at a screen sees what the plan intended.
