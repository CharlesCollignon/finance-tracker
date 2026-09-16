# Bearing panels — human checklist

This plan made every Bearing tile expand in place into a panel explaining its
own figure, on both the web app and the phone app. Automated tests, lint and
type-checks all pass (see `task-8-report.md` in
`.superpowers/sdd/2026-09-15-bearing-panels/` for the full sweep). What
follows is what no command can check: how it actually looks and feels. Work
through it in one sitting; you don't need to have read the plan first.

For each item: what to do, what you should see, and what it would mean if you
see something else.

---

## 1. The web bento does not break

**Background:** the grid is four columns wide. Tiles come in three sizes —
`hero` (2x2), `wide` (2x1) and `unit` (1x1) — arranged in a fixed repeating
sequence (`hero, unit, unit, wide`, then `unit, unit, wide` forever) that is
supposed to fill every row exactly, whatever order the tiles are dragged
into. Opening a panel inserts a full-width block into that grid. The
arithmetic behind the sequence is unit-tested, but nobody has watched the
browser's real CSS grid auto-placement handle it live, especially with the
`hero` tile (the only one that spans two rows).

**What to do:** open `/bearing` at a normal desktop width. Open a panel from
the first tile (the hero), close it, then open one from a tile a few
positions later in the grid — try one from around the middle and one from
near the end. Then resize the window down to phone width (or use dev tools'
device toolbar) and repeat: open a panel from an early tile, then a later
one.

**What you should see:** the grid tiles smoothly re-flow around the open
panel with no visible gap, no tile overlapping another, and nothing jumping
to a row it doesn't belong in. Closing the panel puts everything back where
it was.

**What it would mean otherwise:** a gap, an overlap, or a tile landing in the
wrong row means CSS grid's real auto-placement disagrees with the sequence
`packages/core/src/bearing-tiles.ts` and `packages/core/src/bearing-grid.ts`
assume. That's a real layout bug worth filing, most likely specific to
whichever tile position and viewport width you saw it at — note both.

---

## 2. The phone's row growth

**Background:** on the phone, tiles live in a `ReorderableList`. Opening a
tile's panel grows that tile's row to make room for the panel content,
in place.

**What to do:** open the first tab on the phone (or simulator). Open a panel
on a tile partway down the list. Watch the row as it opens, and scroll the
list up and down while the panel is open.

**What you should see:** the row grows smoothly (an animation, not an instant
snap to the new height), and the list scrolls normally with the panel open —
no stutter, no fighting with the scroll, no content jumping.

**What it would mean otherwise:** a hard snap instead of a smooth grow, or
scroll glitches while a panel is open, point at the interaction between the
panel's height change and `ReorderableList`'s own layout animation.

---

## 3. Drag versus panel on the phone

**Background — the story worth knowing before you try this:** the drag
handle on a tile is now deliberately switched off while that same tile's own
panel is open. This isn't an oversight. The reordering library
(`react-native-reorderable-list`) measures the row's height and the
neighbours' shift distance *synchronously*, before it gives our code a
chance to close the panel in response to the drag starting. If the handle
stayed live, starting a drag on an open tile would size the whole gesture to
the panel-open height while the tile visually shrank back down underneath
it — a shipped race, not a fixed one. So instead, the handle for a tile whose
own panel is open is never wired to start a drag at all.

**What to do:** open a panel on any tile, then try pressing and dragging that
same tile's drag handle. Then, with that panel still open, try dragging a
*different* tile's handle.

**What you should see:** the open tile's handle does nothing when you try to
drag it, and looks visibly dimmed/disabled rather than just unresponsive (it
should read as "this is off right now," not as a bug). Every other tile's
handle should still start a drag and reorder normally, even while another
tile's panel is open.

**What it would mean otherwise:** if the open tile's handle still starts a
drag, that's the exact race described above resurfacing. If dragging *other*
tiles doesn't work while a panel is open elsewhere, that's a separate
regression — the inertness is supposed to be scoped to the one open tile.

---

## 4. Reduced motion

**What to do:** turn on "reduce motion" in the OS accessibility settings
(macOS/iOS: Accessibility → Motion; Windows: Settings → Accessibility;
Android: Settings → Accessibility → Remove animations). With it on, open a
panel on both the web app and the phone app.

**What you should see:** the panel simply appears open — no slide, no fade,
no grow animation — on both clients.

**What it would mean otherwise:** if a panel still visibly animates open
with reduced motion on, that client's reduced-motion wiring isn't taking
effect for panels specifically (it may still work elsewhere).

---

## 5. Both languages

**Background:** ten existing components were newly routed through the
translation catalogues this week so they could be reused inside panels.
That's a lot of surface area for something to read oddly once translated.

**What to do:** switch the app to French (both web and phone, if you can).
Open one panel from each of the five tile families: Now, Month, Run, Ahead,
and Wallet (whichever tiles map to those — the five different kinds of
figures on the Bearing screen). Read every heading, label and the footer
link in each panel.

**What you should see:** everything reads as a real French sentence — no
leftover English words, no obviously machine-translated phrasing, no text
that's truncated or overflowing its container because the French is longer.

**Specifically check the `MonthScore` card's set-up link** (the line at the
bottom of the month-score block, which reads "Set this up" / "Configurer" or
similar depending on state). This exact string had its English changed and
then reverted during this plan's review, so it's the one most worth a second
look — confirm it reads naturally in both languages and that it still points
somewhere sensible when pressed.

**What it would mean otherwise:** any odd-reading French string is a
translation-catalogue bug, worth reporting with the exact panel/family and
the string you saw.

---

## 6. The panel's close

**Background — this is a recorded decision, not a suspected bug:** opening a
panel animates it in. Closing it is an instant jump cut, deliberately: the
component just unmounts rather than reverse-animating out. This was a
judgment call made during the plan, and this check exists to get your
opinion on it now that it's real, not to catch a defect.

**What to do:** open and close a few panels on both clients and pay
attention specifically to the close, not the open.

**What you should see (this is the known, intended behavior):** the panel
disappears immediately with no closing animation, while opening still
animates normally.

**Your call:** does the instant close read as "finished" (a deliberate,
snappy interaction) or as "broken" (like an animation got cut off or a frame
was dropped)? There's no wrong answer here — this is the one item on this
list that's asking for a judgment, not a bug report.

---

## Anything else worth a glance

- **One panel at a time.** With a panel open, press a different tile. The
  first panel should close as the second opens — you should never have two
  panels open at once, on either client.
- **The footer link.** Every panel has a link at its bottom that goes where
  the tile used to take you before it opened in place (e.g. the wallet
  panel's link should go to `/investments`, the month panel's to the month
  screen, etc.). Confirm a few of these actually land on the right screen.
- **Headline never shows a spinner.** The big number at the top of an opened
  panel is already known before the panel opens (it's the same figure the
  tile was already showing) — only the extra detail below it should show
  loading skeletons, never the headline itself.
- **Month is unaffected.** The Month screen/tab should look and behave
  exactly as it did before this plan (it's explicitly out of scope — retired
  in a later plan, not touched in this one). A quick look confirms nothing
  leaked over.
