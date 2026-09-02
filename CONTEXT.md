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

**Monthly summary**:
Income, expense and savings totals for one month, with a per-category
breakdown, computed under a budget view.
_Avoid_: report, overview, stats

**Budget view**:
Which occurrences a month's figures count: `current` counts only up to today,
`month_end` counts everything the month will contain.
_Avoid_: mode, projection, forecast

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
allow means something is missing, not that spending was.
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
Where invested value sits: `pea`, `cto` or `crypto`. A wallet is an
account-shaped home for positions, not a category.
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
