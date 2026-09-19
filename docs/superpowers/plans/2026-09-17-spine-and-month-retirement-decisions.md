# The spine, and retiring Month — why it is like that

This is the decision record for the plan that put a fixed spine — headline
figure, ring, flame and action row — at the top of the Bearing on both
clients, then deleted the Month screen and its fourteen references so the app
has one home (`2026-09-17-spine-and-month-retirement.md`, spec
`docs/superpowers/specs/2026-09-15-bearing-month-merge-design.md`).

It exists for the same reason its predecessor's does: the plan ran through a
workspace that is not tracked in git. The controller made 38 rulings over the
course of it, and every one would have vanished when that workspace was
deleted — including the ones that explain why this branch looks the way it
does, and the ones that admit where the controller itself was wrong. Written
for whoever reads the merged history later and asks "why is it like that?",
not for anyone who was there.

Each entry says what was decided, why, and what it costs if the decision
turns out to be wrong, where a cost was stated. Where a decision reverses an
earlier one, both are kept — the reversal is usually the more interesting
half. This plan also contains something its predecessor's record does not: a
section admitting where the controller's own briefs were simply wrong, caught
only because someone read the source instead of trusting the sentence
describing it. That section is the one worth reading first if you only read
one.

---

## Before any code was written

**The work ran on `plan2-spine-and-month-retirement` in the primary checkout,
not a git worktree** — the same reasoning as the predecessor plan (a worktree
forces a second `pnpm install` of a 700-package workspace for no isolation
gain, and the branch is not `main`), plus a second reason this time: the user
had a dev server running against this checkout, and a worktree would have
left them watching a tree nothing was changing. *Cost if wrong:* the user
cannot run the app on another branch while this executes.

A pre-flight conflict scan produced four rulings before Task 1 was dispatched:

**`MIN_CLOSES_FOR_CAP` is not consumed by `spine.ts`.** `capRatio === null`
already means "fewer closes than the cap needs"; re-deriving that threshold
in the spine would be a second expression of one rule — the exact shape of
defect that produced the predecessor plan's C1, where a test and its
implementation shared one premise instead of two independent ones. *Cost if
wrong:* a slightly less explicit link between the module and the constant it
depends on indirectly.

**Deleting the Month screen must update `PHONE_PATHS`, and this was made a
blocking part of that task rather than a follow-up.** `bearing-tiles.ts`
mapped `/dashboard` and `/history` to `/month`, and the deletion task removes
`/month`. Shipping the deletion without touching the map would recreate the
predecessor plan's most visible defect — a dead link — on the very tiles this
merge is about. Both entries were mapped to `null` (no footer link) rather
than to some replacement screen, because the panel that now explains a tile
already contains what that screen used to say, and a link to the screen you
are standing on is not a destination. *Cost if wrong:* three tiles lose a
phone footer link some reader wanted; the alternative — a link that reloads
the screen you are on — is worse.

**`phoneHref` was NOT assumed to already cover the attention list's hrefs.**
It translates *bearing tile* paths and is documented as such; the attention
list uses a different set (`/transactions?review=inbox`, the close route, the
proposals route). The task that builds the spine's attention row was told to
check every attention href against the real phone route tree and treat an
unmapped one as a blocking finding, not a silent passthrough. *Cost if
wrong:* a check that finds nothing — cheap, against shipping a dead link in
the one row the spine always shows.

**The `month.attention*` translation keys stay under that namespace** even
after the screen they were named for is gone. Renaming the namespace would
touch every catalogue consumer for no user-visible gain, in the same commit
range as the screen's deletion — making that diff much harder to review. The
namespace outliving the screen is a recorded cosmetic wart, not a fix. *Cost
if wrong:* a future reader wonders why home-screen copy lives under `month.`;
this document answers them.

---

## Reversed along the way

Three decisions made in this plan were later overturned by something that
existed by the time the reversal happened. All three are worth knowing
because the wrong version would have shipped clean.

**The spine's ring discriminator was redesigned mid-plan, and the module it
lived in was reopened to do it.** Task 1 shipped a ring state machine that
told "no close yet" from "measuring" apart using the number of closes. A
later review, checking the same boundary from the spec's own wording, found
the spec's actual test is different: whether a measurement *exists*
(`unrecordedSoFar`), not how many closes have happened. The two disagree
exactly after a baseline-only close — a close that sets an opening balance
without being a reconciled one — where the spec wants an arc and the shipped
code showed a dark ring. The fix reopened Task 1 rather than patching the
page that called it: `SpineInput` gained an explicit "any close has ever
happened, baseline included" boolean, the streak input stopped doubling as
the step discriminator, and an inert field (`sample`) that had been carrying
the old, wrong signal all along was dropped. That inert field is itself a
lesson recorded in the ledger: a review had already flagged `sample` as
"declared but never read" and it was filed as a harmless minor. It was not
harmless — it was the fingerprint of a module built around a proxy for the
signal the spec actually names, and a field that exists and is never read
deserved more suspicion than it got. One more subtlety survived into the
redesign: the boundary is *not* keyed on `unrecordedSoFar !== null`, even
though that reads as the literal condition, because `overRecorded` forces
`unrecordedSoFar` to null — keying on it would tell an over-recorded month it
had never closed anything and invite it to close a month it already closed.
*Cost if wrong:* a completed, reviewed task reopened — cheaper than a wrong
ring on the plan's only new screen.

**The ring's over-cap signal was first folded into an existing channel, then
given a channel of its own after the final review found that decision
produced an invisible bug.** The original ruling was that colour comes from
`tone` unconditionally, and `over` needs no channel of its own because the
existing fill clamp already draws a full circle for an over-cap ratio — which
reads, correctly, as "overCap fills it." What that ruling missed: a full
circle is *also* exactly what 100%-and-healthy looks like, and the tone
function returns "clear" whenever free balance is at or above the cap. So the
ordinary rendering of a month that had blown its entire unrecorded allowance
was a full **green** ring — pixel-identical to a healthy month at exactly the
cap. The final whole-branch review caught it by asking the human checklist to
confirm an over-cap marker that did not exist: a reader comparing a healthy
account to a short one would see green versus red, tick the box, and never
notice the two states nobody could tell apart. The fix wave gave `over` its
own visual channel. *Cost if wrong (of the original ruling):* the plan's
central new screen silently agreeing "everything is fine" on the one month
where it most needed to say otherwise.

**The `phoneHref`/`PHONE_PATHS` seam was redrawn once implementation reached
it.** The pre-flight ruling read as "the shared translator must also cover
attention hrefs." What actually resolved the type hazard at the boundary
between the two was narrower and better: export the constant read-only from
core, and let each client keep its own hand-verified judgement about *which*
hrefs get redirected. Shared facts belong in core; client-specific judgement
belongs in the client — and the original framing had collapsed the two.
*Cost if wrong:* `PHONE_PATHS` becomes public API for one consumer.

---

## Decisions inside the implementation

**`overRecorded → absent` applies uniformly across all four ring steps, not
only the lit one.** The spec's sentence is unconditional — "when
`pulse.overRecorded` is true the ring is absent" — and a records gap is a
records gap at every rung of the ladder. Scoping the override to only the lit
step would let a reader with both an unreadable balance and a records gap see
a dark ring implying a measurement that does not exist. *Cost if wrong:* the
ring disappears in an early-ladder state where a darker ring might have read
better; no figure is ever misstated either way.

**The attention-row module added no new i18n keys, correctly** — every key it
names already existed in both catalogues, and a brief step claiming otherwise
was simply wrong (verified: the diff to `packages/core/src/i18n` over that
task's commit range is empty).

**`actionKey` — which verb belongs to which attention condition — was
accepted as in scope though it went beyond the brief's stated interface.**
Deciding that a baseline close needs "Start" and a reconciled one needs
"Close" is exactly the judgement this module exists to centralise; leaving it
out would license each client to re-derive the mapping, recreating the
duplication the module was written to remove. *Cost if wrong:* one field more
than the brief asked for, in a module whose entire purpose is to be the one
place this gets decided.

**Real, live i18n bugs found in the mobile Month screen during that same task
were deliberately not fixed there.** The phone's attention list used raw
template literals that never reached `t()`, and one arm used the wrong
catalogue key entirely — a genuine "shows English to a French reader" bug,
today. The project's standing rule is that pre-existing hardcoded English on
a touched surface goes through the catalogues, but this surface is deleted
two tasks later, and translating strings in a file already condemned ships
nothing. What mattered instead was that the bug not *survive* the move: the
task that rebuilds the attention list on the spine was given a hard
constraint that every row renders through `t()` with no template-string
fallback. *Cost if wrong:* the untranslated strings lived on in the doomed
screen for exactly as long as they would have anyway.

**Each client's gatherer widens its return type to carry the spine's
inputs**, rather than the page re-computing the month pulse a second time or
core's shared fact-builder changing its return shape for two callers' sake.
Both clients already hold these values in scope at the call site and were
discarding them, so the widening adds no query on either client and keeps the
two symmetric. *Cost if wrong:* two gatherer signatures grow by three fields.

**The spine's action row is exempt from the plan's "no new query" rule — and
this corrects the spec's own claim, not just the plan's.** The spec asserted
the spine costs no new query on the strength of the shared fact pack's
contents, but the action row's inputs (swallowed entries, recurring items to
apply, pending proposals) were gathered today only by the Month screen and
were never in that pack. Since the same plan deletes Month, those queries
move rather than multiply — the home runs them instead of the screen that
used to. The alternative, scoping the action row to whatever the pack happens
to carry, would silently drop conditions a reader sees today: exactly the
"silent regression" reviewers were told to hunt for elsewhere in this plan.
The cost was quantified before the work started (three fetches, not five —
two of the five conditions were already fetched for other reasons) and the
tasks that added them were told to report the number so the final review
could check it against a number written down in advance. It matched. *Cost
if wrong:* the home does a little work Month used to do, for a few tasks
until Month is gone, and none after.

**An "Approved" review verdict does not close a task if it carries Important
findings.** Two findings from Task 2's review were coverage gaps on code a
reviewer had hand-audited as correct — which is precisely the argument for
fixing them, since a manual audit by one reviewer is not something the test
suite can repeat on the next change. Both entered the fix loop rather than
being waved through on the strength of the headline verdict, and each
implementer told to push back rather than comply if it thought a finding was
wrong.

**A copy fix discovered outside a task's own scope was folded into the next
untouched task rather than reopening the one that was clean, or spinning up a
standalone fix wave.** A live "Close a month from Month" sentence — naming
the just-deleted screen — was found just after the deletion task's review
passed clean. Reopening a deletion-only diff to edit unrelated copy would
have muddied a diff whose entire value is being readable as a pure deletion.
The next task was already a cleanup task touching the same apps and had not
started, so it absorbed the fix — and was reframed to **fix the class, not
the line**: sweep for any user-facing copy naming a surface that no longer
exists, and decide what the sentence should say now that the screen is gone,
which is a copy decision the sweep has to answer rather than route mechanics
it can shortcut. *Cost if wrong:* that task's diff is slightly broader than
"clean up the predecessor plan's debts."

**A branch that removes a core capability does not merge, whatever a later
plan intends to do with that area.** Mid-plan, a review found the phone had
lost its only way to close a month (detailed under "What this plan got wrong
about itself" below). The spec's own build order assigns the close-moment
area to a later plan, but a new task was added to this one anyway and the
capability restored before merge — deferring it would have shipped a branch
that regresses the ritual the entire app is built around. The controller also
recorded a fault one level up, in the spec itself: it retires Month "once
every block has a panel," but closing a month was never a *block* on that
screen — it was an *action* — so "every block has a panel" was satisfied
while the phone's only entry point to that action was deleted. Any future
plan retiring a surface needs to inventory what that surface *did*, not only
what it *showed*. *Cost if wrong:* a later plan rewrites the entry point
added here, having lost nothing.

**The restored close-sheet trigger deliberately does not reproduce the
deleted screen's own logic.** The old call site read the "next close" value
live from state that closing itself usually empties, which would tear the
reveal off screen mid-animation; the new one snapshots the month into state
the instant the trigger fires. The web equivalent never had this bug only
because it is server-rendered. Reproducing the old, phone-only call site
faithfully would have shipped a phone-only bug on the ritual this plan exists
to protect. Its accompanying sweep of the sheet's and the planning screen's
inherited hardcoded English — technically outside a "do not rewrite the
sheet" instruction — was ruled in scope under the same standing i18n rule
that governs everywhere else, and turned up a real bug: a baseline reveal
date rendered in English for French readers because a date formatter was
called without a locale argument. *Cost if wrong:* a larger diff than the
task implied, visible plainly to the review.

**A copy sweep that also changes the code it verifies is circular, so it got
its own task rather than folding into the branch-verification task.** The
verification task's job is to confirm the branch and write the human
checklist; a task that both verifies and edits cannot be trusted to do
either. The sweep task that resulted is the one that eventually produced,
through several rounds of a reviewer finding what the previous round missed,
the four different mechanisms it takes to find stale copy in this codebase:
a key reference, a hardcoded word, a bare literal, and reachability — because
each one is invisible to a search built for the others.

**Every component the deleted screens were the sole caller of was audited
once, with exactly two allowed verdicts: a capability the app lost (re-home
it) or chrome that belonged to the deleted screen (delete it).** This was
deliberately not done incrementally. By the time it was proposed, one
capability loss had already shipped and been caught by luck (the close
sheet), and a second had just been found by accident during an unrelated copy
sweep (the fulfilment confirmation, `ArrivedCharges`). Finding these one
accident at a time is the failure mode itself; the audit exists to do the
inventory once rather than wait for the next accident. Its two verdicts stood
even where they cost something: a chart component (`TrendCard`) stayed
deleted because reviving it would re-import a range-state contract into a
screen that no longer exists, but its accounting was audited twice — the
first pass under-counted by half, missing a thin-data honesty guard and an
inactive-month filter that the deleted component's own doc comment had
argued for. Those two were rebuilt as a tested pure function, because they
are a documented correctness-of-presentation decision rather than chrome, and
losing them would regress the users least equipped to notice (a two-month-old
account showing a fake two-bar trend). *Cost if wrong (of not fixing
`ArrivedCharges` immediately on discovery):* it stayed unreachable slightly
longer, on a branch that was not merged yet.

**No separate task review was spent on the verification task that produced
the human checklist**, matching the precedent the predecessor plan set for
its equivalent task. Its deliverables are a documentation file and command
output the controller verified directly, and its commit falls inside the
final whole-branch review's range regardless. *Cost if wrong:* the
checklist's wording reached the user unreviewed by anyone but its only
audience — which is also the argument for why that is fine.

---

## Decisions made in the final review's fix wave

The final whole-branch review returned "merge with fixes": no Critical
findings, five Important, five Minor, plus six corrections to the human
checklist itself. Its own closing judgement about the branch, worth keeping
verbatim: the class of defect this plan kept finding was "thinner, not
closed... the class is defined by the absence of a gate, and no gate was
added."

**The full-green-ring bug (above, under "Reversed along the way") was fixed
by giving `over` a dedicated visual channel**, closing the one Important
finding that mattered most: a checklist that would have passed while an
over-cap month and a healthy one were pixel-identical.

**`LocaleSuggestion`'s mount point was corrected for a third time**, and this
time by taking it out of the page layout entirely as an absolutely
positioned overlay, which cannot displace or double-inset anything on any
launch. The two earlier fixes are covered in full under "What this plan got
wrong about itself," because the controller's own stated mechanism for the
bug was wrong in a way the first two fixes could not have escaped.

**The deferred "Invest" gap in the retired-name list (see below) was fixed
here rather than opened as its own round**, along with the French
preposition drift the deferred-findings list flagged as item 4 — both
authored by this branch, so both were owned by it rather than pushed further
downstream. Item 13 on the deferred list (marketing still depicting the
retired tab) was held rather than fixed, and item 1 was found stale.

**`previewApplyRecurringForMonth` was replaced by a pure `countRecurringToApply`** 
that shares its occurrence logic with the plan builder, verified as a net
improvement rather than a mitigation: three queries and every outbound quote
fetch came off the landing page, and the new count is more honest than the
one it replaces, which had silently dropped occurrences whose price quote
failed.

**There is no second fix-wave round by process design.** A scoped re-review
of the fix wave was dispatched, and whatever it finds gets adjudicated and
surfaced to the user rather than triggering a further round — the same
discipline the rest of the plan applied to every other fix loop.

---

## Known and deliberately not done

**The CI reachability gate the final reviewer recommended was not built,
despite the controller agreeing with its diagnosis completely.** The same
review that recommended it also found six web files orphaned since *before*
this plan started and roughly twenty never-referenced exports in
`packages/core`. A gate added now goes red on day one, and closing that
would mean either a large cleanup unrelated to this plan's goal or a baseline
file that grandfathers the existing debt — and choosing between those two is
an infrastructure decision that belongs to the user, not to a plan about a
spine. This is recorded as the single highest-value follow-up the plan
produced, with the tools named for whoever picks it up: `knip` or `ts-prune`
over `apps/` and `packages/core`, plus an unused-key assertion on the
translation catalogues. *Cost if wrong:* the next deletion in this codebase
reopens this exact class of defect on exactly the same terms.

**Several judgement calls were routed to the human checklist rather than
settled by the controller or a reviewer**, because they are not defects
awaiting a fix but questions only the app's own user can answer:
whether a genuinely quiet month should vanish from the trend chart or show as
a flat bar (both readings are defensible, and the restored filter picked the
first — it can be revisited); whether losing `TrendCard`'s 6-month/1-year/2-
year range switch and "best month" badge matters, given the chart itself is
preserved; whether the slide-out on the close sheet's cancel path (a cosmetic
side effect of a slide-in fix, previously impossible because the component
used to unmount instantly) reads as sloppy; and whether the four web
`MonthScore` tiles carrying two links apiece reads as clutter now that both
point at the same destination in the ordinary case.

**A scattering of smaller findings were deferred as genuinely harmless or
out of this plan's scope**, mostly because fixing them meant a decision this
plan was not positioned to make: a hardcoded phone notification string with
no user-facing surface at stake; a comma splice asserting a surface exists
that Task 10's audit might have removed; a profile row's label naming a
surface the navigation doesn't carry, which is arguably descriptive rather
than wrong; `getMonthlyTrend`'s now-unreachable `months` parameter, a direct
consequence of the range-switch loss above; six web files and roughly twenty
core exports orphaned before this plan touched the codebase at all; two
`SegmentedControl`s and four other files carrying pre-existing motion literal
duplication; the phone's identity guard sitting above its haptic call,
making a press on an already-selected segment silent (ruled correct, but
booked for the human's own judgement since it is a behaviour change); web's
`MonthCloseCard` still inlining the invitation ladder that core now owns and
tests, with convergence left to the close-moment plan that owns that area;
and roughly twenty non-catalogue source comments still describing "the Month
screen" or "the dashboard," mostly correctly historical.

**Seven `nav.month` references in the web marketing mockups, and five more
"Month" strings in the marketing copy file, were deliberately left alone.**
They describe a tab the app no longer has, which is a real inconsistency —
but it is a marketing-site design decision (what should the mockups depict
instead?) outside this plan's scope, not a find-and-replace. *Cost if
wrong:* the landing page depicts a retired tab until someone redraws it.

---

## What this plan got wrong about itself

Twelve times in this plan, something the controller wrote into a dispatch —
a brief, a plan step, a ledger note repeated as fact — was simply wrong, and
was caught only because an implementer or a reviewer read the actual source
instead of trusting the sentence describing it. None of them shipped wrong;
all twelve were caught before merge. That is the useful fact, and so is the
pattern in how they were caught: almost all of them were caught by one of two
things — a dispatch that told its implementer to **argue rather than
comply** when it thought an instruction was wrong, or a reviewer who was
handed the spec and no answer, so its agreement (or disagreement) with the
controller's own read would mean something. Both are process choices, not
luck, and they are the transferable lesson here.

The twelve, in the order they surfaced:

1. **A wrong function name.** The plan referred to the close-history
   function as `summariseCloses`; its real name is `summarizeCloseHistory`.
   Not load-bearing for the task that surfaced it, but two later tasks
   consume that function, so the wrong name was corrected before it could
   reach a dispatch that mattered.

2. **A false claim about which conditions the phone's attention list
   already had.** The plan stated flatly that the phone had no equivalent
   for two conditions (`close` and `proposals`); it already pushed a `close`
   item. The real gap was narrower than claimed. The implementer built to
   what the client code actually did rather than to the inaccurate note,
   which was the correct call, and prompted a standing change to the
   controller's own process: read the call sites before writing a brief, not
   after.

3. **A data-flow constraint that was unsatisfiable as written**, because it
   named the fact-builder's *input* type instead of its *output* type. The
   plan asserted a screen could reach certain values because the function
   that builds its data pack *takes* them as arguments — but that function
   consumes and discards them; its return type never carries them forward.
   The constraint was corrected before the task that depended on it was
   dispatched.

4. **A stale test baseline.** A dispatch quoted the test suite's passing
   count from the branch's merge point, two tasks and eleven tests earlier
   than the real number. The implementer verified the true baseline by
   checking out the earlier state rather than assuming the quoted number was
   current.

5. **A discriminator built around a proxy for the signal the spec actually
   names** — the spine's ring state machine, covered in full under
   "Reversed along the way" above, told two states apart using a close
   count when the spec's own words point at whether a measurement exists.

6. **A "zero imports" claim that a quote-blind grep had "verified."** The
   plan instructed removing a now-apparently-unused package on the strength
   of a `grep` for double-quoted imports; the one remaining import used
   single quotes, sat behind three layers of component composition, and
   would have broken the build behind every signed-in page. The implementer
   refused the instruction and demonstrated why, rather than complying with
   a plan that was confidently wrong.

7. **A wrong citation for a deleted entry point.** The plan named a specific
   line as the lost trigger for the phone's month-close flow; that line was
   actually where the closing *sheet* mounted, not where the user's tap that
   opened it lived. The distinction mattered: what got built was new design
   restoring a lost capability, not a faithful restoration of the old call
   site, and it had to be reviewed as such.

8. **A false framing repeated across the ledger, that a piece of copy named
   "a surface this app has never had."** It had had it — "Home" was this
   very surface's own former name, before it became "Month" and then this
   plan's target for deletion. The string had survived unnoticed for exactly
   that reason: it was not nonsense, it was out of date, and calling it
   nonsense was itself the error. A reviewer caught it by replaying the
   navigation history commit by commit rather than trusting the two
   citations the controller had already given for it — one of which turned
   out to be exact and the other invented from adjacency to a nearby, wrong
   commit.

9. **A retired-name list that was one entry short even after being
   purpose-built to be exhaustive.** An artifact assembled specifically to
   enumerate every name this app's home screen has ever carried — built by
   replaying every revision of both navigation files, the most thorough
   method anyone had used on this class of defect — still omitted "Invest,"
   a one-day label the web investments tab carried before being renamed.
   Found by the next reviewer to look. Fixed in the final review's fix wave
   rather than opening a third round over one line.

10. **A step that told the reader to check a query-cost claim by diffing the
    wrong files.** The plan's verification step said to confirm the added
    fetch count by diffing "the two client page files"; the fetches
    actually live in the gatherers those pages call. The dispatch that
    executed the step happened to name the gatherers correctly, so the
    check was actually performed — but the plan, followed as written, would
    have found nothing and concluded there was nothing to find. Corrected
    in the tracked plan document.

11. **The most consequential: a stated mechanism for a React Native inset
    bug that pointed at a remedy which would have shipped green through
    every gate without fixing anything.** `LocaleSuggestion`, one of the
    components re-homed by the orphan audit, went through three mount-point
    attempts. The first wrapped it in a padding view that reserved a full
    top inset on nearly every render (the banner it wraps is usually
    absent) — worse than the rare, real gap it replaced, and every gate
    stayed green through it. The second moved the padding onto the
    component's own root view, keyed correctly to the case where the banner
    actually renders, and passed review. The final whole-branch review then
    found that the controller's own explanation for *why* the first fix was
    necessary — that every screen "pads `insets.top` again from context" —
    was itself false: the safe-area view every screen already uses is a
    native view that takes its insets from wherever it physically sits in
    the tree, not from the React context the controller's mechanism
    described, so a remedy built on that description could never have
    addressed the actual box-model interaction. The fix that finally closed
    it took the component out of the page layout entirely, as an absolutely
    positioned overlay that cannot displace or double-inset anything on any
    launch — closing the class instead of moving it a fourth time. No gate
    in this repository — not the type checker, not the linter, not the test
    suite — exercises React Native's layout math; every one of the three
    attempts type-checked, linted and tested identically. This was caught
    exactly twice, both times by a reviewer reading the box model by hand.

**Four capability losses, and the one thing that explains all of them.**
Deleting the Month screen quietly took capabilities down with it, three
times inside implementation and a fourth caught only by the final review:
the phone's only way to close a month (the close sheet was complete and
compiled, but its one caller had been deleted, and nothing greps for a
component with zero callers); the "did this arrive?" fulfilment confirmation
on *both* clients (the same shape of orphan, found by accident during an
unrelated copy sweep); the phone's locale suggestion banner (same shape
again, this time caught by the dedicated orphan audit this plan added
specifically because the first two were found by accident); and web's only
re-findable route into the welcome walkthrough, found last by the final
review reading the audit's own list of what it could not see. Each was
invisible to every automated gate for the same reason: an orphaned
component type-checks perfectly, passes lint, and is referenced by nothing —
which is exactly the condition a reachability check exists to name, and
exactly the check this repository does not have (see "Known and deliberately
not done," above). The one-line generalisation underneath all four, in the
final reviewer's own words: **deleting an orphan is not always free, and no
gate in this repository can see it.**
