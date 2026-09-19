# What a category has been doing: findings, a grid, and a panel

**Date:** 2026-09-19
**Status:** Approved design, ready for an implementation plan

## What this changes

`/history` stops being one chart with a list under it. It becomes three
layers on one screen:

1. **Findings** — a single strip showing where the month went, and under it up
   to five sentences saying what actually moved, ordered by what they are
   worth.
2. **A grid of small multiples** — every category visible at once, each with
   its own twelve months, grouped by category type.
3. **A panel** — opening in place inside the grid, holding that category's
   months in full, the transactions behind the month that stands out, and a
   read written by a model.

Underneath it, a new pure module computes what a category's run of months has
done, and two model calls sit on top of it: one that chooses which findings
lead, one that writes a category read.

## Why

The screen today asks you to click one category, scroll back up to see its
chart, then scroll down and click the next. Twenty categories is twenty round
trips, and at no point does the screen show you the thing you came for, which
is *which* category to look at. `category-history.ts` says the single-category
view is deliberate — "a chart of every category at once shows the total and
hides the thing you came to find out" — and that argument is right about
stacking every category into one chart. It is not an argument for showing one
at a time. Small multiples show twenty runs without summing any of them.

The deeper gap is that the screen states figures and draws no conclusion. The
data to say "groceries have climbed five months running" has been sitting in
these series the whole time; nothing has ever said it.

## Vocabulary

Two entries for `CONTEXT.md`, under a new heading beside "Words about a
month".

> **Finding**
> One thing the app noticed in a category's run of months that is worth
> saying out loud. Four species only, and each is a measurement rather than
> an impression: what has *drifted*, a *month apart*, a category *gone
> quiet*, and what happens *every year*. A finding carries an i18n key and
> its parameters, never a sentence — the wording belongs to the client
> drawing it, in the reader's language.
> _Avoid_: insight, alert, anomaly, signal

> **Normal**
> What a category costs in an ordinary month: the **median** of its non-empty
> months, not their mean. The distinction is not fussiness. A mean is dragged
> by exceptional months, which are exactly the ones a finding is looking for,
> and a threshold that moves with the anomaly it is meant to detect detects
> nothing.
> _Avoid_: average, baseline, typical

The four species are `drift`, `odd-month`, `gone-quiet` and `every-year` in
code. Plain words rather than statistical ones, for the reason `CONTEXT.md`
already refuses "metric" and "stat".

## The window

Twelve months are drawn. Thirty-six are read.

Seasonality cannot be measured inside a twelve-month window — the same
calendar month has to appear at least twice. So the query widens and the
screen does not: twenty-four bars in a tile the width of a phone column are a
texture, not a chart.

There is no window control. A setting here would be one more thing to
understand in exchange for a question nobody has asked.

**A normal is the median of the last twelve non-empty months, not of all
thirty-six.** The deeper history serves `every-year` and nothing else. A
category that genuinely stepped up a year ago has settled at its new level,
and a normal dragged back towards its old one would report a drift that
finished twelve months ago as though it were news.

## The findings module

`packages/core/src/category-findings.ts`. Pure, tested without a database, a
network or a model. It takes the `CategoryHistory[]` built over thirty-six
months and returns `CategoryFinding[]`.

A finding holds `{ id, kind, categoryId, severity, months, key, params }` and
**no rendered text** — the precedent is `attention.ts`, whose comment states
the reason: a client handed a key cannot improvise a fourth wording, because
there is no string there to improvise from. It is also what would let a phone
screen exist later without the two disagreeing.

Every species reads the series **already grouped by pay period** through
`groupByPayPeriod`. A salary clearing on the 31st and then the 1st otherwise
reads as a double month followed by an empty one, and the page would invent a
drift and a silence every other month. Withdrawal signs are the ones
`buildCategoryHistory` already applies.

### `drift`

The median of the last three months against the median of the six before
them. At least three non-empty months are required on each side.

The gap must clear **two** floors, a relative one (~15%) and an absolute one
in euros. The absolute floor is what stops "your bank fees have exploded by
40%" about four euros a month. Neither floor alone is enough: a relative one
lets small categories shout, an absolute one lets large ones hide.

Severity is the monthly euro gap. Direction comes from the sign, and what the
sign *means* comes from the category type — a rise in income is not a rise in
spending, and the i18n key differs accordingly.

### `odd-month`

A month whose distance from its category's normal exceeds a multiple of that
category's own **median absolute deviation**, and also an absolute floor in
euros.

The median absolute deviation rather than the standard deviation, for the same
reason as the median rather than the mean: one monstrous month inflates a
standard deviation enough to hide itself inside it.

Severity is the euro distance from normal.

### `gone-quiet`

A category that moved in at least four of the six preceding months and in none
of the last three. The hole is already drawn in the bars today; nothing says
it.

Its mirror — a category that has just appeared — is the same calculation in
the other direction and shares the species.

Severity is the euros per month that stopped, or started.

### `every-year`

The same calendar month, across at least two years, away from the category's
normal in the same direction.

**This species almost never appears as a finding of its own. It exists to
silence others.** A `drift` or an `odd-month` landing on a month that this
category makes expensive every year is demoted rather than listed. Without
that rule the page cries drift about the energy bill every December, and a
page that cries wolf on schedule is one the reader learns to skip — which is
the only truly permanent way to break a screen of alerts.

### Ranking

A finding's severity is its **weight in euros per month**. Never a percentage,
never a composite score.

Two reasons. Euros are comparable across categories and percentages are not.
And euros are the only unit in which the screen can tell a reader plainly why
one line sits above another.

This ordering is also the fallback when no model answers, so it has to stand
on its own rather than be a stopgap.

### Changes to `category-history.ts`

The window becomes a genuinely variable parameter — thirty-six read, twelve
drawn — and **`trend` is deleted**. It is a poor man's `drift`, computed off a
mean, and keeping it beside the real one would leave two answers to the same
question on the same screen. `buildCategoryHistory` and `CategoryHistory` are
imported only by this page and its view, so nothing else moves.

## The screen

`/history` stays where it is, the Ledger's third tab.

The server component reads thirty-six months, builds the series, computes the
findings, and loads the stored selection along with **every** category read
already written — a handful of rows in one query, so opening a panel is
instant rather than going to fetch its prose on click.

The client component holds one piece of layout state: which category is open.
The two buttons that ask the model have their own pending state, as
`MonthRead` already does with `useTransition`.

### Layer 1 — the findings band

`SpendStrip` is reused unchanged for the composition bar at the top. It
already takes a `CategoryBreakdown[]` and a total, and its own comment argues
why one bar beats a Sankey at this width. No new chart code.

Below it, up to five finding rows: the category name, the sentence rendered
from the finding's key and parameters, a micro series, and a press that
**opens that category in the grid** and brings the panel into view. One panel
in the whole page, two ways in, tied together with `aria-controls` and
`aria-expanded`.

Scrolling down to a panel you just opened is not the defect being fixed.
Scrolling back up to find the list was.

### Layer 2 — the grid

One tile per category: the name, its normal, the badge of its heaviest finding
if it has one, and twelve bars. Findings therefore colour the grid itself
rather than living only in the band above it.

**The grid is grouped by category type** — expenses, then income, savings,
investment — with a heading per group. Rather than a filter: no control, no
state, and it answers layer 2's "where does the money go" on its own, which a
salary sitting between two spending categories would muddle.

**Order inside a group never changes**: biggest first, as today. A grid that
reorders itself according to what is going wrong is a grid nobody ever builds
muscle memory in, and this is a screen people come back to every month.

### Layer 3 — the panel

The panel is a grid child at `grid-column: 1 / -1`, inserted straight after
the pressed tile.

`bearing-grid.ts` saved us from a trap here rather than serving as a model.
There, computing the row boundary is unavoidable because the grid is
`grid-auto-flow: dense` with tiles of different sizes, and its comment records
that the arithmetic version shipped and was wrong. This grid is uniform and
**will not use dense flow**: the browser then pushes the panel to the next row
by itself and the remaining tiles flow after it rather than backfilling into
the hole. No row arithmetic, no `useGridColumns`. The only cost is a gap at
the end of the row above the panel, which is honest — it shows where you
opened.

The panel holds the title, the normal, **every finding for that category**
rather than only the one that reached layer 1, the twelve months at full size
through `BarSeries`, the transactions behind the month the findings point at —
the latest month when they point at none — a link into the Ledger, and the
category read. The opening animation goes through `usePrefersReducedMotion`.

That link carries the month and not the category, and this paragraph originally
promised otherwise. `/transactions` reads `y`, `m` and `review` and nothing
else: there is no category filter to address. So the link lands the reader on
the month the panel is explaining and leaves them to find the category in the
list. Giving the Ledger a real category filter is worth doing and is its own
piece of work — inventing a parameter that page ignores would have been worse
than admitting the gap.

### Files

A `components/finance/category/` directory, mirroring
`components/finance/bearing/`, which already made this choice.
`CategoryHistoryView.tsx` keeps the name the page imports and becomes pure
orchestration; `FindingList`, `CategoryGrid`, `CategoryTile`, `CategoryPanel`
and `CategoryRead` each take a piece. The current 152 lines do three things;
the new screen does six, and one file holding all of them is the kind of
component nobody reads twice.

### Language

Every string on this screen goes through the `en`/`fr` catalogues, including
the hardcoded English already there — the empty state, "avg", "in a normal
month", "above/below that this month". Finding sentences with counts in them
need plural forms, and French puts zero in the singular, so they cannot be
ternaries at the call site.

## The model

### Call one: the selection

The model is handed the **complete** list of findings, each with its id, its
species, its category and its weight in euros. It returns up to five ids, in
order, drawn from that closed catalogue — the wallet read's gesture, which
names an instrument only from a list it was given. An invented id is dropped,
not fatal.

It may attach a **remark** to each, and a remark may contain **no figure at
all**. No `{{fact:id}}` placeholders, no verification machinery: the figure is
already in the sentence the app rendered beside it, and what the call buys is
the judgement, not the arithmetic. A digit in a remark drops that remark alone
— the month read's `trim` severity, not its fatal one.

**Why pay for this call at all**, given the app can already rank? Because
weight in euros cannot see the one thing that decides what matters: what you
can act on. A 30 € drift in restaurants deserves more attention than a 200 €
drift in an indexed rent, and that is the kind of judgement a model makes well
and a formula makes badly. If that argument does not hold, the call is not
worth its cost — and nothing else in this design depends on it.

**It never fires on its own.** The app's order leads; a quiet button asks the
model to re-rank. The selection is stored with the **digest of the findings it
was made from** — `factsDigest` already does this for the month read — and
falls back to the app's order as soon as the transactions move, rather than
letting a stale ranking claim to describe figures that have changed.

### Call two: the category read

The month read's pattern, unchanged.

`category-facts.ts` builds the datum pack for **one** category: its normal,
its latest month, the size of its drift, the flagged month and that month's
share, its cap if it has one through `budget-limits.ts`. An absent value
becomes a named `MissingFact` with a reason, never a zero.

`category-read.ts` verifies the answer. `category-read-prompt.ts` asks for it,
reusing **`factLines()`**, which `month-read-prompt.ts` already exports
widened past `MonthFacts` — its comment says why: two prompts describing
figures two ways is two sets of parsing habits to get right in a model that
has only one. This is the third caller, not a fourth format.

The prose renders its figures by substitution, so the currency toggle and
privacy blur keep working on a paragraph, which raw text would not allow.

The prompt carries the same `CONTEXT.md` vocabulary block the month read
carries, extended with the two words this design adds: a normal is a normal,
and nothing here is an "anomaly" or an "alert".

**One allowance for all the reads on this screen** — ten writes a month, not
five per category. Twenty categories at five writes each is a hundred calls
inside the ceiling, which is not a ceiling.

The selection is counted separately, in `category_selections`, on its own
small tally. Two calls that cost differently and fail differently should not
be able to exhaust each other: a month spent reading categories must not leave
the band at the top unable to reorder itself.

## The database

Migration `035_category_findings.sql`, two tables, written against
`acting_for()` from migration 025 from the start rather than correcting it
later.

| Table | Key | Holds |
| --- | --- | --- |
| `category_reads` | (user, category) | the read, the facts, the instant, the model, the prompt version, the refused count, the locale |
| `category_read_tallies` | (user, month) | how many reads have been written this month, across every category |
| `category_selections` | user | the selection, its digest, and the month's tally |

Three tables rather than two, and the third is what the allowance forces. One
allowance for all the reads on this screen cannot be counted in a table keyed
by category — a per-category counter with a cap of ten is a cap of ten times
however many categories exist, which is not a cap. So the reads stay keyed by
(user, category) and the counting moves to a table of its own.

`locale` is there from the first migration, because `028_month_read_locale`
already paid for leaving it out once.

Every write goes through a `security definer` function and never through an
`UPDATE`: a counter a client may write is a counter a client may set back to
zero. The default PUBLIC grant is revoked in the same breath as the function
is created, not in a later migration.

The tally resets when the month turns, in the same statement that takes the
reservation, so nothing has to remember to do it — `029_bearing`'s
`reserve_bearing_arrangement` does exactly this.

Read paths tolerate the migration not having run, through the `isMissingSchema`
helper already written: a missing table must not take down the page. As with
the month read, "untracked" **stops the model being asked at all** — a call
that cannot be counted is a call that is not capped.

## Tests

In `packages/core`, pure, no database and no network.

`category-findings.test.ts`, one species at a time, plus the cases that are
the module's whole value:

- a 40% rise on four euros a month produces **nothing**;
- a December that is expensive every year produces **no drift**;
- a salary clearing on the 31st and then the 1st produces neither
  `gone-quiet` nor `odd-month`;
- a category with two months of history produces no `drift`, because "normal"
  does not mean anything yet.

`category-read.test.ts`:

- a figure written by the model refuses the read;
- a digit in a remark drops the remark and keeps the selection;
- an id outside the catalogue is ignored without breaking the answer.

`pnpm check:reachability` already covers the rest: `unused-keys.test.ts`
catches an orphaned i18n key, `knip` catches a dead export.

## Deliberately not done

- **Nothing on mobile.** This screen does not exist in the Expo app, and
  adding it is a different project. The findings module is written so that it
  could, which is the whole reason it carries keys rather than sentences.
- **No multi-category comparison.** Pinning two categories onto one overlaid
  chart is a real question — "did my restaurants fall because my groceries
  rose" — and this design has no place for it. It can be added later without
  disturbing any of the above.
- **No notifications and no dismissal.** Findings are derived on every render
  and stored nowhere, so there is nothing to mark as seen. Persisting them is
  what "new since your last visit" would need, and nobody has asked for it.
- **No window control, and no per-category allowance.**
