# Finance Tracker

One person's money: what came in, what went out, what is set aside, and what is
invested — reconciled month by month across a web app and a mobile app that
share the same domain modules.

## Language

### Money movements

**Transaction**:
One dated amount in one category. The only record of money actually having
moved.
_Avoid_: entry, expense, payment

**Category**:
A user-owned label carrying a type — income, expense, savings or investment —
which decides how its transactions are summarised.
_Avoid_: bucket, envelope

**Tag**:
A free-form label attached to transactions for filtering. Distinct from a
category: a transaction has exactly one category and any number of tags.
_Avoid_: label, group

**Review inbox**:
The bank rows the app would not file on its own, waiting for the user to say
what they were. Everything the user's own history already answered for is a
transaction by the time they see this, so the inbox is the exceptions — and
answering one teaches the matcher, which is why it shrinks rather than being a
permanent chore. Addressed as `?review=inbox` on both apps, because it is a
decision with a location rather than a section of a page.
_Avoid_: pending, unfiled, queue, triage

**Monthly summary**:
Income, expense and savings totals for one month, with a per-category
breakdown, computed under a budget view.
_Avoid_: report, overview, stats

**Budget view**:
Which occurrences a month's figures count: `current` counts only up to today,
`month_end` counts everything the month will contain. Never call one a
projection: that word now names the forward window.
_Avoid_: mode, forecast

### Standing instructions

**Recurring template**:
A standing instruction that transactions should exist on a repeating schedule —
monthly, weekly or yearly, optionally bounded by a start and end date.
_Avoid_: subscription, schedule, rule

**Occurrence**:
One dated instance a recurring template calls for. An occurrence is not a
transaction until it is applied.
_Avoid_: instance, instalment, due date

**Skip**:
The user's decision that one specific occurrence should not exist this month.
Distinct from deactivating the template, which stops all of them.
_Avoid_: ignore, dismiss

**Apply**:
Turning the occurrences a month calls for into transactions.
_Avoid_: sync, generate, run

**Reprice**:
Bringing an already-applied occurrence's amount back in line with its
instrument's current quote. Only ever done to an occurrence still dated ahead,
and never asked about: the market moving is not a decision anyone made.
_Avoid_: refresh, recalculate, update

**Settled occurrence**:
An applied occurrence whose date has passed. Its amount is what actually
moved, so a later quote does not change it; only a reclassification does.
_Avoid_: locked, frozen, historical

**Fulfil**:
The user's confirmation that a movement the bank reported *is* the occurrence
a template called for. Distinct from applying, which writes a transaction the
bank never saw, and from skipping, which says the occurrence should not exist:
fulfilling says it already happened and here is the proof. Never inferred —
an earlier version matched these automatically and had to grow a recovery
action for the ones it got wrong.
_Avoid_: match, settle, reconcile, link

### Closing the books

**Closing balance**:
What the accounts the user's day-to-day spending leaves from actually held on
one date.
The only figure in the app that is a balance rather than a flow, and the only
one the user has to look up rather than record as it happens.
_Avoid_: bank balance, statement, cash

**Reading day**:
The day of the following month a closing balance is read on. The same day
every month, and deliberately not the last of the month: with a deferred-debit
card the month's card spending has not landed by then.
_Avoid_: cut-off, statement date

**Month close**:
Recording one month's closing balance, and what the app works out from it.
Distinct from applying, which opens a month by filling it in.
_Avoid_: reconciliation, month end, settle

**Unrecorded spending**:
What a closing balance proves left the account that no transaction accounts
for — the restaurants, the rounds, the things bought on the way home. Measured
rather than remembered, and never negative: a balance higher than the records
allow means something is missing, not that spending was. Once two months are
closed, the median across them is what the forward projection subtracts from
every month ahead — the one figure there the user did not schedule, and the
reason it is allowed in is that it was measured and not guessed.
_Avoid_: leak, untracked, missing

**Kept**:
What a month added to the user's wealth: the cash it left in the account plus
everything deliberately set aside. The honest counterpart to the savings rate,
which only counts what was moved.
_Avoid_: saved, surplus, profit

**Unrecorded allowance**:
A cap on unrecorded spending for a month, set from the user's own history.
Coming in under it is what a run of months is counted on.
_Avoid_: budget, target, limit

### Where the months lead

**Forward projection**:
What the standing instructions and the user's own measured unrecorded
spending lead to over the months ahead. Arithmetic on instructions already
given rather than a prediction, which is why nothing in it is stated without
the charges that produce it, and why no market value appears anywhere in it.
_Avoid_: forecast, prediction, estimate, outlook, trajectory

**Track**:
One of the projection's two lines. *In the accounts* is what the spending
accounts hold; *everything kept* is that plus every euro set aside along the
way. There are two because one was a lie: a single line counting money moved
into savings as money gone had a diligent saver watching their position sink.
The gap between the tracks is exactly what has been put by.
_Avoid_: series, scenario, curve

**Ingredient**:
One of the things a projection is made of — income from charges, committed
costs, what is set aside, what a normal month costs unseen — each with how
many charges back it and a way to go and change it. Present because a figure
nobody can take apart is a figure nobody believes, and because someone whose
pay is not a charge has to be able to see that from the card rather than
guess it.
_Avoid_: breakdown, component, driver

### Caps and targets

**Budget**:
A cap on what one category may spend in a month.
_Avoid_: limit, allowance, target

**Savings goal**:
An amount the user intends to accumulate, tracked against savings
transactions.
_Avoid_: target, pot, sinking fund

### Investing

**Wallet**:
Where invested value sits: `pea`, `cto`, `av`, `per` or `crypto`. A wallet is
an account-shaped home for positions, not a category. There is one of each at
most, so two assurance-vie contracts are one wallet.
_Avoid_: account, portfolio, broker

**Investment position**:
The holding of one thing inside one wallet, with what was put in and what it is
worth now.
_Avoid_: holding, asset, line

**Instrument**:
Something tradeable, identified by its symbol — an ETF, an equity, a fund.
_Avoid_: ticker, security, product

**Instrument quote**:
An instrument's price at a moment in time, in euro, alongside the price and
currency it was originally quoted in.
_Avoid_: price, rate, valuation

**Quote source**:
Where instrument quotes come from. A live source reads the market; a fixed one
answers from known prices. "No price right now" is an ordinary answer from
either.
_Avoid_: provider, feed, market API

**Share-priced template**:
A recurring template whose amount is a share count times the current instrument
quote, rather than a fixed amount. The alternative is a fixed-price template.
_Avoid_: DCA, variable template

**Last quote**:
The most recent instrument quote stored on a template, used to price an
occurrence when the quote source has no price to give.
_Avoid_: cached price, fallback price

**Instrument reading**:
What an instrument is made of, read from the market and dated: its ongoing
charge, the countries and sectors its money sits in, and its largest
constituents. Never guessed and never taken from a source file — an instrument
that has not been read has an unknown composition, which is not the same as an
empty one.
_Avoid_: profile, metadata, fundamentals, factsheet

**Look-through**:
The exposure arrived at by resolving positions through their readings, so a
portfolio is described by what it holds rather than by where it sits. Computed
from the positions every time, over the value that could be resolved, with the
rest reported as unread.
_Avoid_: allocation, breakdown, exposure, x-ray, drill-down

**Wallet read**:
A dated account of the whole of what is invested, asked for rather than
generated: what it observes about the look-through, what it suggests, and the
target allocation those suggestions imply. Names instruments only from a closed
catalogue and writes no figure of its own — it chooses a role and a size for
each suggestion, and the app turns those into percentages.
_Avoid_: portfolio review, analysis, advice, recommendation

### Words about a month

**Month read**:
A short written account of one month, asked for rather than generated on
sight, and stored with the figures it was written from. The prose is a
model's; every number in it is the app's, because the model refers to a figure
by its name and never writes one itself. It is allowed to suggest changes,
which is why suggestions sit under a heading of their own rather than mixed in
with the observations.
_Avoid_: summary, insight, report, AI analysis

**Datum**:
One named figure a month read or a bearing may refer to — a label, a value,
and whether going up is good, bad or neither. Their whole vocabulary of
numbers, and the reason a claim resting on anything else is thrown away.
_Avoid_: metric, stat, data point

### What a category has been doing

**Finding**:
One thing the app noticed in a category's run of months that is worth saying
out loud. Four species only, and each is a measurement rather than an
impression: what has drifted, a month apart, a category gone quiet, and what
happens every year. A finding carries an i18n key and its parameters, never a
sentence — the wording belongs to the client drawing it, in the reader's
language.
_Avoid_: insight, alert, anomaly, signal

**Normal**:
What a category costs in an ordinary month: the median of its non-empty
months, not their mean. A mean is dragged by exceptional months, which are
exactly the ones a finding is looking for, and a threshold that moves with the
anomaly it is meant to detect detects nothing.
_Avoid_: average, baseline, typical

### Where it all stands

**Bearing**:
Where the whole of someone's money stands on one day, and where it is
heading: what is on hand, what is committed to the months ahead, what is
invested, and what a year of unchanged habits leads to. Distinct from a
monthly summary, which is one month's flows, and from a forward projection,
which is only the forward half. Every figure on it is one another surface already
shows, which is what makes it checkable rather than a second source of truth.
_Avoid_: dashboard, overview, home, net worth

**Tile**:
One datum on the bearing: a label, a value, and — where there is an honest
one — the surface that explains it. A tile is a figure rather than a
component, which is why naming one is the same act as naming a datum, and
why a tile with nowhere to lead leads nowhere: inventing a destination would
teach people that pressing tiles is a coin flip.
_Avoid_: widget, stat, KPI

**Card**:
One of the five groups the bearing is drawn as, named by the family its
tiles already share: this month, the accounts, the run, the year ahead, the
wallets. Collapsed it shows its family's first figure; opened it shows them
all. There are five because every datum carries a family anyway, which is a
grouping nobody has to choose and no model has to propose — an earlier
bearing had a model ordering twelve of twenty-nine figures over a layout the
reader could drag, and three mechanisms answering "which of these matters?"
never answered the question the screen is opened for.
_Avoid_: section, bento, widget, group

**Panel**:
What a card draws under its figures when it is opened — the blocks that show
where the figure came from, fetched only when someone asks for them. Distinct
from the card, which is the name and the figure that are true whether or not
anyone opens it.
_Avoid_: drawer, expander, detail view
