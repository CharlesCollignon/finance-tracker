# Bearing panels — human checklist

This plan made every Bearing tile expand in place into a panel explaining its
own figure, on both the web app and the phone app. Automated tests, lint and
type-checks all pass. What follows is what no command can check: how it
actually looks and feels. Work through it in one sitting; you don't need to
have read the plan first.

If an item leaves you wondering why something is the way it is,
`2026-09-15-bearing-panels-decisions.md` beside this file records the
reasoning behind every deliberate oddity here.

For each item: what to do, what you should see, and what it would mean if you
see something else. The last few ask for your opinion rather than a bug
report, and say so.

---

## 1. The web bento does not break

**Background:** the grid is four columns wide. Tiles come in three sizes —
`hero` (2 wide and 2 **tall**), `wide` (2x1) and `unit` (1x1) — arranged in a
fixed repeating sequence (`hero, unit, unit, wide`, then `unit, unit, wide`
forever) that fills every row exactly, whatever order the tiles are dragged
into. Opening a panel inserts a full-width block into that grid, and it has to
land on the seam between two whole rows.

It did not, until the final review. The arithmetic that found the seam had
forgotten the hero is two rows tall, so every `wide` tile opened its panel one
full row too low. Crucially **that never looked like a gap** — the grid
backfills the space the panel skipped — so the only way to see it was
positionally. That is what this check is now for: confirming the fix, by
looking at position rather than at holes.

**What to do:** open `/bearing` at a normal desktop width. Pick a **wide** tile
— one that spans two columns and is *not* the big one at the top left — from
somewhere in the middle of the grid, and press it. Then do the same for a wide
tile near the end of the grid, and for one of the small square tiles.

**What you should see:** the panel opens in the strip **immediately below the
row you pressed in**. Read across the row of tiles sitting directly on top of
the open panel: the tile you pressed must be one of them. There must never be
a whole extra row of tiles between the tile you pressed and the panel that
belongs to it.

Then resize the window down to phone width (or use dev tools' device toolbar)
and repeat with an early tile and a later one. Closing a panel should put
everything back exactly where it was.

**What it would mean otherwise:** if the panel appears to have "skipped" a row
— the tile you pressed is two rows above the panel, with unrelated tiles in
between — the row model and CSS grid's real auto-placement still disagree, and
the fix did not take. Note the tile's size and position and the viewport width;
all three matter. A visible gap or two tiles overlapping is a different and
more serious bug, worth reporting on its own.

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

**Then, the tile switch.** With one tile's panel open, step its month back a
few months using the arrows at the top of the panel. Now — without closing
anything — press a *different* tile that sits beside it in the same visible
row. Do this on both clients; on web it is easiest with two small square tiles
side by side.

**What you should see on the switch:** the new tile's panel opens on the
**current** month, not on whichever month you had stepped the previous panel
to, and it visibly animates open rather than appearing already unfolded.

**What it would mean otherwise:** if the open tile's handle still starts a
drag, that's the exact race described above resurfacing. If dragging *other*
tiles doesn't work while a panel is open elsewhere, that's a separate
regression — the inertness is supposed to be scoped to the one open tile. And
if the second tile's panel opens already scrolled back in time, or snaps open
without animating, the panel is being recycled between tiles instead of
rebuilt.

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

**And specifically check month names inside sentences.** On the web app these
were being built in English regardless of the language you were reading in,
which was fixed in the final review — so it is worth confirming on web in
particular. Look at the headline under `on-hand`, `free` and `savings-rate`
("Il reste … en {mois}") and at the month-read card's own heading. The month
name has to be French too: "en septembre", never "en September" sitting inside
otherwise correct French.

**What it would mean otherwise:** any odd-reading French string is a
translation-catalogue bug, worth reporting with the exact panel/family and
the string you saw. An English month name inside a French sentence means the
locale is not reaching whichever call built that particular label.

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

## 7. Stepping the month inside a panel

**Background:** a month-family panel has arrows at the top for moving to
another month. The month's name updates the instant you press; the figures
have to be fetched. Until the final review those two were out of step — the
header said August while every number under it was still July's, for as long
as the round trip took. Now the figures clear while the new ones are on the
way, so you get the same loading placeholders the panel opens with rather than
the wrong month's numbers.

**What to do:** open a `month`-family panel — `free` is the clearest — and
press the back arrow to step to the previous month. Watch the body of the
panel, not the header, at the moment you press. Do it on both clients. On the
phone, step back to a month you have already looked at this session and note
the difference.

**What you should see:** the moment the month name changes, the blocks below
it are either the *new* month's figures or grey placeholder bars — never the
previous month's numbers sitting under the new month's name. On the phone, a
month you have already visited comes straight back with no placeholders at
all, because it is still cached.

**What it would mean otherwise:** if you can catch a moment where the header
says one month and real-looking numbers below belong to another, the clearing
is not happening on that client. On a fast connection the placeholder phase
may be too brief to see at all — that is fine, and worth noting as "couldn't
catch it either way".

---

## 8. The phone's footer links, all of them

**Background:** every panel has a link at its bottom that goes to the fuller
surface explaining its figure. The table of destinations was written for the
web app's router, and the phone was using it unchanged — so fifteen of the
twenty-six links pointed at screens the phone has never had (`/dashboard`,
`/budgets`, `/history`). Pressing them did nothing. The phone now has its own
translation of that table, and this check is the only thing that can confirm
it end to end.

**What to do:** on the phone, open each of these panels and press the footer
link, coming back each time: `on-hand`, `free`, `savings-rate`;
`expenses-vs-previous`, `monthly-net-average`; and as many as you have of
`unrecorded-so-far`, `unrecorded-allowance`, `unrecorded-over`,
`unrecorded-baseline`, `streak`, `best-streak`, `projected-balance`,
`projected-kept`, `projected-monthly-net`, `runway-months`. Then a few that
were never broken, as a control: `invested`, `committed`, `inbox-pending`.

**What you should see:** every one lands on a real screen. Specifically: the
first three and the two history ones go to **Month**; everything in the
`unrecorded`/`streak`/`projected`/`runway` group goes to **Plan**;
`invested` goes to Wallets, `committed` to Charges, and `inbox-pending` to the
Ledger **with its review filter already applied** (you should land on the
review queue, not the plain list).

**Your call as well as a bug report:** for each destination, does it actually
answer the figure you pressed from? `expenses-vs-previous` and
`monthly-net-average` are the two worth most attention — on web they lead to a
by-category history view the phone does not have, so they were sent to Month
as the nearest thing that draws the same comparison and trend. Say whether
that lands as useful or as a shrug.

**What it would mean otherwise:** a link that does nothing, errors, or lands
on a blank screen means that path is still missing from the phone's table.
Note which tile.

---

## 9. Two new pieces of phone UI nobody has looked at

**Background:** the `on-hand` tile's panel on the phone shows two things with
no earlier precedent on that device: a read-only list of the connected cash
accounts, and a summary card for the review queue that opens the existing
bank-inbox sheet. They were judged consistent with the phone's patterns by
code review, but no human has actually looked at them.

**What to do:** open the `on-hand` panel on the phone. Read both, and press
the review-queue card to open the inbox sheet and come back.

**Your call:** do they look and read like the rest of the app, or like
something bolted on? Does the accounts list earn its space, or is it a wall of
rows? Does the review card's sheet open and dismiss cleanly from inside a
panel, rather than from the screen it was designed for?

---

## 10. Two links on the `unrecorded` panels, on web

**Background:** on web, opening `unrecorded-so-far` (or `unrecorded-allowance`
/ `unrecorded-over` / `unrecorded-baseline`) shows two navigational links: one
inside the month-score card itself, and one in the panel's own footer below
it. That is deliberate and was argued over: the footer always goes to the same
place, while the card's own link changes destination with the state of the
month — an over-recorded month sends you to the Ledger to find the missing
entry, an unconfigured one to Budgets. Suppressing either would remove a
destination the other never offers.

**What to do:** open one of those four panels on web. If you can, look at it
both in a normal month and in an over-recorded one.

**Your call:** does having both links read as useful, or as clutter? This is a
judgment for the team to record, not a defect to fix on your own — but if it
reads as clutter, say so, because the decision to keep both is written down and
can be rewritten.

---

## 11. The budget-view toggle only the phone has

**Background:** the phone's `on-hand` panel lets you flip the figures between
"as of today" and "as of month end" with a control inside the card. The web
app's identical panel has no such control — it only *states* which view is in
force. This was found late, is genuinely a divergence rather than an oversight
in this plan's code, and closing it means designing a new control for web. It
was left for the next plan so that you could rule on it first.

**What to do:** open the `on-hand` panel on the phone and find the
today/month-end control. Use it, and watch the figures change. Then open the
same panel on web and look for it.

**Your call:** is the phone's control something web should have too, is it
something neither should have, or is the difference fine? Whichever you say
settles it for the next plan.

---

## 12. Two things the implementer could not check

Both of these were flagged during implementation as "I cannot verify this
without looking at it" and never verified.

**The big number inside `on-hand`'s panel.** Open it and check whether the
headline figure inside the panel just restates the number you already saw on
the tile before opening it, or whether it explains something new. Then do the
same for `invested` and `invested-share`, which get the same card by family
default even though they are not about cash — does it make sense on those two
tiles specifically, or does it feel out of place?

**The month score on a past month.** On a `month`-family panel, step back to a
month that is over. The month-score card is supposed to render nothing at all
rather than show a broken or misleading state when there is no live balance to
score against — but nobody has actually watched that happen. Confirm it either
disappears cleanly or shows something sensible.

---

## Anything else worth a glance

- **One panel at a time.** With a panel open, press a different tile. The
  first panel should close as the second opens — you should never have two
  panels open at once, on either client.
- **A write made inside a panel.** On the phone, use a panel that can change
  something — decide a bank row from the review card, save a close setting,
  write a month read — and stay where you are afterwards. The figures in that
  same panel should update to reflect what you just did, without closing and
  reopening it. They used to come back unchanged.
- **Headline never shows a spinner.** The big number at the top of an opened
  panel is already known before the panel opens (it's the same figure the
  tile was already showing) — only the extra detail below it should show
  loading skeletons, never the headline itself.
- **Month is unaffected.** The Month screen/tab should look and behave
  exactly as it did before this plan (it's explicitly out of scope — retired
  in a later plan, not touched in this one). A quick look confirms nothing
  leaked over.
