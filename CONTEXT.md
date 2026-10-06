# Finance Tracker

One person's money: what came in, what went out, what is set aside, and what is
invested — reconciled month by month across a web app and a mobile app that
share the same domain modules.

## Language

Each term carries the word the French screens use for it, under
_En français_. French is the default language, so that word is the one most
readers see: copy in either language uses these names and no others.

### Money movements

**Transaction**:
_En français_ : opération
One dated amount in one category. The only record of money actually having
moved.
_Avoid_: entry, expense, payment

**Category**:
_En français_ : catégorie
A user-owned label carrying a type — income, expense, savings or investment —
which decides how its transactions are summarised.
_Avoid_: bucket, envelope

**Review inbox**:
_En français_ : à vérifier
The bank rows the app would not file on its own, waiting for the user to say
what they were. Everything the user's own history already answered for is a
transaction by the time they see this, so the inbox is the exceptions — and
answering one teaches the matcher, which is why it shrinks rather than being a
permanent chore. Addressed as `?review=inbox` on both apps, because it is a
decision with a location rather than a section of a page. Shown grouped by
shop (`groupPendingFeed`): a year of history arrives as a few dozen groups
rather than hundreds of rows, and one answer files a whole group, with the
category its history suggests already picked.
_Avoid_: pending, unfiled, queue, triage

**Bank connection**:
_En français_ : connexion bancaire
One user's link to their own bank, through their own open-banking.io account:
they sign up and pay open-banking.io directly, connect their bank there, and
upload the credentials file it lets them download — the same file the
deployment's owner keeps in the environment. Pluclair takes no money for it.
Read-only. The file's two keys are sealed on the server and unreadable by
either app; what the apps may read is its status: active, expired
(open-banking.io stopped accepting the file's key — a new file brings it
back), paused (the user's open-banking.io wallet is empty), revoked (the user
disconnected) or error. Offered only where the `bank.connect` flag is on.
Disconnecting asks whether to keep what the bank brought in, and keeps it by
default.
_Avoid_: bank feed (the rows it brings), integration, account link

**Consent renewal**:
_En français_ : renouvellement du consentement
Giving the bank a new consent before the old one ends, done in the user's own
open-banking.io account; the credentials file Pluclair holds does not change. PSD2 caps a consent,
usually at 180 days, and when it lapses the numbers simply stop moving, so the
app says so ahead of time: from 14 days out on the Bank page and the Bearing,
and in one push 7 days out (`bankAttention` decides all three).
_Avoid_: reconnect (that is replacing a file that stopped working)

**Invitation**:
_En français_ : invitation
A card offering to connect a bank, on the Bearing's balance card, `/welcome`,
the Ledger and the Plan. Only where setup is offered (`bankSetupOffered`), only to
someone without a live connection, and dismissed for good per surface
(`dismissed_prompts`, so dismissing on the laptop holds on the phone).
_Avoid_: CTA, upsell, promo

**Monthly summary**:
_En français_ : résumé du mois
Income, expense and savings totals for one month, with a per-category
breakdown, computed under a budget view.
_Avoid_: report, overview, stats

**Budget view**:
_En français_ : vue du budget
Which occurrences a month's figures count: `current` counts only up to today,
`month_end` counts everything the month will contain. Never call one a
projection: that word now names the forward window.
_Avoid_: mode, forecast

### Standing instructions

**Recurring template**:
_En français_ : opération récurrente (l'onglet : Récurrents)
A standing instruction that transactions should exist on a repeating schedule —
monthly, weekly or yearly, optionally bounded by a start and end date.
_Avoid_: subscription, schedule, rule

**Occurrence**:
_En français_ : échéance
One dated instance a recurring template calls for. An occurrence is not a
transaction until it is applied.
_Avoid_: instance, instalment, due date

**Planned occurrence**:
_En français_ : à venir
An occurrence dated after today. Never stored: the ledger draws it from its
template every time it is read, which is why a future month shows its charges
and why changing a charge changes every month ahead at once. It becomes a
transaction on its day, and until then it is counted by nothing that describes
what has happened.
_Avoid_: forecast row, pending, scheduled transaction

**Awaited occurrence**:
_En français_ : pas encore passé
With a bank feeding the ledger, an occurrence whose day has come that the
bank has not brought yet. Nothing writes it there, so going by the day alone
it would leave the forecast at midnight while the debit was still on its way
— the loan taken on the 5th, looked at on the 5th. It stays in the forecast,
taking the balance down from tomorrow, until a bank movement looks like it,
until no movement could still be offered for it (four days, ten for the money
that moves on payday), or until it is confirmed or skipped. The same rule
works the other way: an occurrence a movement already looks like, early or
late, is not forecast beside it while « C'est arrivé ? » waits. Nothing is
confirmed by either (`bankForecast`). Never a purchase inside a wallet, which
no bank movement can be: that one is asked about instead (see purchase to
confirm).
_Avoid_: overdue, late, pending

**Purchase to confirm**:
_En français_ : achat à confirmer (« Cet achat est-il passé ? »)
With a bank feeding the ledger, a purchase inside a wallet whose day has come
and that nothing records yet. The bank is the record there, but it never sees
money move inside the broker, so Le point asks for ten days from its day: yes
writes it on its day, linked to its template, which grows its position; no
skips it; no answer writes nothing (`purchasesToConfirm`).
_Avoid_: pending purchase, unconfirmed DCA

**Skip**:
_En français_ : passer, retirer de ce mois
The user's decision that one specific occurrence should not exist this month.
Distinct from deactivating the template, which stops all of them. Deleting a
row a template wrote records one, and so does moving that row to another
date: the month fills itself, and without the skip the occurrence would be
written again.
_Avoid_: ignore, dismiss

**Apply**:
_En français_ : — (plus à l'écran : le mois se remplit seul)
Turning an occurrence into a transaction, on its day. Nobody presses anything
for it: occurrences whose day has come are written by a daily run on the
server and whenever the app opens, looking back as far as last month. Only
missing ones are written — a row that differs from its template may be one the
user corrected — and never one from before its template was set up, unless the
user asks for this month's when creating it. Saving a template is the one thing
that reaches rows already written: the user chooses whether this month's
recorded rows follow it ("this month too") or keep what they say ("upcoming
only"), and past months never change. With a bank feeding the ledger, nothing
is applied at all: the bank is the record, and a template only forecasts —
until the bank brings each occurrence (see awaited occurrence). A purchase
inside a wallet, which the bank never sees, is applied when the user says it
went through (see purchase to confirm).
_Avoid_: sync, generate, run

**Reprice**:
_En français_ : réévaluer au cours du jour
Bringing an already-applied occurrence's amount back in line with its
instrument's current quote. Only ever done to an occurrence still dated ahead,
and never asked about: the market moving is not a decision anyone made.
_Avoid_: refresh, recalculate, update

**Settled occurrence**:
_En français_ : échéance réglée
An applied occurrence whose date has passed. Its amount is what actually
moved, so a later quote does not change it; only a reclassification does.
_Avoid_: locked, frozen, historical

**Fulfil**:
_En français_ : confirmer une échéance arrivée
The user's confirmation that a movement the bank reported _is_ the occurrence
a template called for. Distinct from applying, which writes a transaction the
bank never saw, and from skipping, which says the occurrence should not exist:
fulfilling says it already happened and here is the proof. Never inferred —
an earlier version matched these automatically and had to grow a recovery
action for the ones it got wrong. A movement is offered within four days of
its occurrence, and money that moves on payday — an income, the savings put
by from it, a transfer to a broker — from fifteen days before to ten after
(monthly and yearly templates), because the pay moves and those follow it. A
planned item counts in the month it was planned for: confirming a movement
whose money moved in another month — the October salary paid on 22
September, the savings put by the same day, the October salary that only
arrived on 2 November — moves it to the occurrence's day and keeps the day
the money moved as its cash date. It is asked about in the month the money
moved as well as the month it was planned for, the button says what it does
("Compter pour octobre"), several can be confirmed at once ("Tout
confirmer"), and undoing it, or "Le remettre au 22 sept." on the row, puts
it back.
_Avoid_: match, settle, reconcile, link

**Cash date**:
_En français_ : date d'arrivée (« Arrivé le 22 sept. »)
The day a transaction's money actually moved, when it is not the day the
transaction counts for (`cash_on`, set only then). Every month view,
summary and read goes by the day a row counts for; only what pairs the
ledger with a balance the bank reported reads the cash date — the month
close, the balance curve on Le point, and the unrecorded spending so far —
because the account received or paid it on its own day. A row that has one
says so: "Reçu le 22 sept." for money in, "Payé le 22 sept." for money out.
_Avoid_: value date, booking date, real date

### Closing the books

**Closing balance**:
_En français_ : solde en fin de mois
What the accounts the user's day-to-day spending leaves from actually held on
one date.
The only figure in the app that is a balance rather than a flow, and the only
one the user has to look up rather than record as it happens.
_Avoid_: bank balance, statement, cash

**Reading day**:
_En français_ : jour de lecture
The day of the following month a closing balance is read on. The same day
every month, and deliberately not the last of the month: with a deferred-debit
card the month's card spending has not landed by then.
_Avoid_: cut-off, statement date

**Month close**:
_En français_ : bilan du mois (« Faire le bilan de {mois} »)
Recording one month's closing balance, and what the app works out from it.
Distinct from applying, which fills a month in as it opens.
_Avoid_: reconciliation, month end, settle

**Unrecorded spending**:
_En français_ : dépenses non notées
What a closing balance proves left the account that no transaction accounts
for — the restaurants, the rounds, the things bought on the way home. Measured
rather than remembered, and never negative: a balance higher than the records
allow means something is missing, not that spending was. Once two months are
closed, the median across them is what the forward projection subtracts from
every month ahead — the one figure there the user did not schedule, and the
reason it is allowed in is that it was measured and not guessed.
_Avoid_: leak, untracked, missing

**Kept**:
_En français_ : économisé
What a month added to the user's wealth: the cash it left in the account plus
everything deliberately set aside. The honest counterpart to the savings rate,
which only counts what was moved.
_Avoid_: saved, surplus, profit

**Unrecorded allowance**:
_En français_ : marge pour les dépenses non notées, « la marge »
A cap on unrecorded spending for a month, set from the user's own history.
Coming in under it is what a run of months is counted on.
_Avoid_: budget, target, limit

### Where the months lead

**Forward projection**:
_En français_ : projection
What the standing instructions and the user's own measured unrecorded
spending lead to over the months ahead. Arithmetic on instructions already
given rather than a prediction, which is why nothing in it is stated without
the charges that produce it, and why no market value appears anywhere in it.
_Avoid_: forecast, prediction, estimate, outlook, trajectory

**Track**:
_En français_ : courbe (« sur les comptes », « tout ce qui est économisé »)
One of the projection's two lines. _In the accounts_ is what the spending
accounts hold; _everything kept_ is that plus every euro set aside along the
way. There are two because one was a lie: a single line counting money moved
into savings as money gone had a diligent saver watching their position sink.
The gap between the tracks is exactly what has been put by.
_Avoid_: series, scenario, curve

**Ingredient**:
_En français_ : ce dont la projection est faite
One of the things a projection is made of — income from charges, committed
costs, what is set aside, what a normal month costs unseen — each with how
many charges back it and a way to go and change it. Present because a figure
nobody can take apart is a figure nobody believes, and because someone whose
pay is not a charge has to be able to see that from the card rather than
guess it.
_Avoid_: breakdown, component, driver

**What if**:
_En français_ : Et si…
An extra amount a month, chosen on a slider on the Plan, added to the
_everything kept_ track and to the long view's monthly payments, so the user
sees what it would change: a year from now, and how much sooner a milestone
comes. Never saved anywhere; it is a question, not an instruction.
_Avoid_: scenario, simulation, goal

**Milestone**:
_En français_ : palier
A round amount of savings and investments together (1 000 €, 5 000 €,
10 000 € … 1 M€), celebrated when reached, with how many months the next
ones are at today's pace. Judged on the user's real figures, never on what
they typed into the long view, so a milestone cannot be reached by editing.
Distinct from a savings goal, which was retired: nobody sets a milestone.
_Avoid_: goal, target, badge, level

**Cushion**:
_En français_ : matelas de sécurité
How many months of fixed costs what is in the savings accounts would cover,
with rungs at 1, 3 and 6 months.
_Avoid_: emergency fund, runway, buffer

**Long view**:
_En français_ : votre patrimoine dans N ans
What the savings accounts and each wallet could be worth in 1 to 40 years,
from today's value, the monthly payments the recurring templates make, a
yearly return the user can change, and the 2026 French tax on gains for that
kind of account. Shown after tax, in today's euros, and as the monthly income
a withdrawal rate would give. Unlike the forward projection it is an
estimate and says so: returns are assumptions. In code each row is an
`Envelope` (_enveloppe fiscale_) — a wallet or the savings accounts — never a
category.
_Avoid_: forecast, simulation, prediction

### Investing

**Wallet**:
_En français_ : compte de placement (PEA, compte-titres, assurance vie, PER, crypto) ; l'onglet : Placements
Where invested value sits: `pea`, `cto`, `av`, `per` or `crypto`. A wallet is
an account-shaped home for positions, not a category. There is one of each at
most, so two assurance-vie contracts are one wallet. Placements lists only the
wallets the user keeps: those with a position and those they added
(`wallet_plans.shown`); removing one removes its positions.
_Avoid_: account, portfolio, broker

**Savings account**:
_En français_ : compte d'épargne (Livret A, LDDS, LEP, CEL, PEL, autre livret)
One of the user's savings accounts, declared on Placements, with its own
rate, tax on interest, ceiling and balance (`savings_accounts`, migration
046). The balance is the one the user gave on the day they gave it, plus what
they logged in the account's own savings category since — or the balance
their bank reports, when it is linked to a bank account. Savings logged in no
account's category go to the Livret A, else the first account at hand. A PEL
is not at hand: a withdrawal closes it, so the cushion leaves it out. With no
account declared, everything logged as savings stands in as one.
_Avoid_: livret (for any of them), pot, envelope

**Purchase inside a wallet**:
_En français_ : achat dans le compte (un DCA PEA, un DCA CTO)
An investment logged in a category that does not count toward the summary
(the app's "suivi" categories): a purchase made inside a wallet with money
already sent to it. It moves nothing on the bank account — the transfer to
the broker did — so no balance, month-end rest or curve counts it, recorded
or planned. Counting both would take the same euros out twice, which is what
happens to an October DCA funded on 22 September if it is.
_Avoid_: deployment, buy, outflow

**Investment position**:
_En français_ : ligne
The holding of one thing inside one wallet, with what was put in and what it is
worth now.
_Avoid_: holding, asset, line

**Instrument**:
_En français_ : fonds, action ou crypto
Something tradeable, identified by its symbol — an ETF, an equity, a fund.
_Avoid_: ticker, security, product

**Instrument quote**:
_En français_ : cours
An instrument's price at a moment in time, in euro, alongside the price and
currency it was originally quoted in.
_Avoid_: price, rate, valuation

**Quote source**:
_En français_ : source du cours
Where instrument quotes come from. A live source reads the market; a fixed one
answers from known prices. "No price right now" is an ordinary answer from
either.
_Avoid_: provider, feed, market API

**Share-priced template**:
_En français_ : opération récurrente en parts
A recurring template whose amount is a share count times the current instrument
quote, rather than a fixed amount. The alternative is a fixed-price template.
_Avoid_: DCA, variable template

**Last quote**:
_En français_ : dernier cours
The most recent instrument quote stored on a template, used to price an
occurrence when the quote source has no price to give.
_Avoid_: cached price, fallback price

**Instrument reading**:
_En français_ : fiche du fonds
What an instrument is made of, read from the market and dated: its ongoing
charge, the countries and sectors its money sits in, and its largest
constituents. Never guessed and never taken from a source file — an instrument
that has not been read has an unknown composition, which is not the same as an
empty one.
_Avoid_: profile, metadata, fundamentals, factsheet

**Look-through**:
_En français_ : composition
The exposure arrived at by resolving positions through their readings, so a
portfolio is described by what it holds rather than by where it sits. Computed
from the positions every time, over the value that could be resolved, with the
rest reported as unread.
_Avoid_: allocation, breakdown, exposure, x-ray, drill-down

**Wallet read**:
_En français_ : revue des placements
A dated account of the whole of what is invested, asked for rather than
generated: what it observes about the look-through, what it suggests, and the
target allocation those suggestions imply. Names instruments only from a closed
catalogue and writes no figure of its own — it chooses a role and a size for
each suggestion, and the app turns those into percentages.
_Avoid_: portfolio review, analysis, advice, recommendation

### Property

**Property**:
_En français_ : bien (l'onglet : Immobilier)
A home or premises the user owns, wholly or in part: what it cost, where it
is, how it is used — main home, second home, let bare or furnished — and the
share of it that is theirs. Not a wallet: nothing is bought inside it, and
what it costs month to month are recurring templates attached to it.
_Avoid_: asset, real estate investment, home, flat

**Loan**:
_En français_ : prêt
Money borrowed to buy or improve one property, repaid on a schedule of its
own, and owed at the user's share when it was borrowed with someone else. A
property may have several — a main loan, a PTZ, an Action Logement loan. A
loan with no property behind it, for a car say, is only a recurring
template.
_Avoid_: mortgage, credit, debt

**Amortisation schedule**:
_En français_ : tableau d'amortissement
Every payment a loan calls for, each split into principal, interest and
insurance. Worked out from the loan's terms, and checked against the one the
bank gave.
_Avoid_: repayment plan, payment table

**Loan payment**:
_En français_ : mensualité
What leaves the account for a loan each month: the payment its schedule
calls for and the insurance, at the user's share. A recurring template linked
to the loan, which ends with the last payment, so each one is an occurrence
like any other. When the bank debits the insurance on its own, on another
day or for another insurer, the loan payment is two templates — the payment,
and the insurance — one for each debit, and still one loan.
_Avoid_: instalment, repayment

**Outstanding principal**:
_En français_ : capital restant dû
What is still owed on a loan on a given day. Worked out from the schedule,
never typed — except when an early repayment or a renegotiation has moved
it: the user gives the figure their bank shows, and the schedule carries on
from there.
_Avoid_: balance, remaining debt, CRD

**Principal repaid**:
_En français_ : capital remboursé
The part of the loan payments that paid a loan down rather than the bank:
what they added to the user's net value. Never counted as kept, which is
measured from the account's balance and what was set aside.
_Avoid_: forced saving, equity built

**Price index**:
_En français_ : indice des prix des logements
How the price of existing homes has moved, quarter by quarter, in one area —
Paris, a département, an agglomeration, a region. What carries a sale or a
purchase price from its quarter to today.
_Avoid_: inflation, market trend

**Market reading**:
_En français_ : relevé du marché
What homes of one kind sold for per square metre around a property, or
across its commune, over a dated period: a median, a spread and the number of
sales behind it, each sale first carried to today by the price index. Read
from the public record of sales and never guessed; too few sales means there
is no reading, not a reading of zero.
_Avoid_: valuation, estimate, price

**Estimated value**:
_En français_ : valeur estimée
What a property is worth today, always said with where it comes from: the
user's own figure, dated, when they gave one; else the market reading times
its area; else its purchase price carried by the price index; else its
purchase price.
_Avoid_: market value, valuation, price

**Net value**:
_En français_ : valeur nette
The estimated value of the user's share of a property, less their share of
what its loans still owe.
_Avoid_: equity, net equity

**Net worth**:
_En français_ : patrimoine net
Everything the savings accounts, the wallets and the properties hold, less
what the loans still owe, today. Distinct from what a milestone counts —
savings and investments only — so buying a home, or a new market reading,
never passes one.
_Avoid_: wealth, net assets, fortune

**Rent**:
_En français_ : loyer
What a tenant pays for a let property, as it reaches the user's account:
the recurring income attached to the property. Set against the property's
own charges and its loan payments.
_Avoid_: income, revenue

**Asking rents**:
_En français_ : loyers d'annonce
What homes like a let property are advertised for per square metre in its
commune, unfurnished and charges included, from a public map published once
a year: a figure, its range and the number of listings behind it. Where too
few listings stand behind it there is none, not a rent of zero.
_Avoid_: reference rent (« loyer de référence » is the legal cap of the towns
that cap rents), market rent

**Cash flow**:
_En français_ : ce qu'il vous laisse (ou coûte) chaque mois
A let property's rent less its own charges and its loan payments, a month:
what it leaves the user, or what it costs them when the rent falls short.
_Avoid_: profit, return

**Yield**:
_En français_ : rendement (brut, net)
A year's rent over what the property cost the user — price, fees and works.
Gross before its charges, net after them; both before tax and borrowing, as
French listings quote them.
_Avoid_: return, profitability

**Energy class**:
_En français_ : classe énergie (DPE)
The letter, A to G, a property's energy assessment gives it: what decides
whether and until when it may still be let, and whether its rent may rise.
_Avoid_: energy label, rating

### Words about a month

**Month read**:
_En français_ : lecture du mois
A short written account of one month, asked for rather than generated on
sight, and stored with the figures it was written from. The prose is a
model's; every number in it is the app's, because the model refers to a figure
by its name and never writes one itself. It is allowed to suggest changes,
which is why suggestions sit under a heading of their own rather than mixed in
with the observations.
_Avoid_: summary, insight, report, AI analysis

**Datum**:
_En français_ : chiffre
One named figure a month read or a bearing may refer to — a label, a value,
and whether going up is good, bad or neither. Their whole vocabulary of
numbers, and the reason a claim resting on anything else is thrown away.
_Avoid_: metric, stat, data point

### Who writes the words

**AI account**:
_En français_ : compte IA
The user's own account with an AI service, connected to Pluclair, that every
written read is asked from and paid by. Connected in one press, through
OpenRouter; the server holds what it needs to call it, sealed, and never shows
it. Without one, nothing is written — the figures stand on their own.
_Avoid_: API key, assistant, integration, plugin, subscription

**Writer**:
_En français_ : rédacteur
The model a read's prose comes from, named on every read it wrote. The writer
is the model and the AI account is what it ran on: one account can reach
several writers. A writer chooses words and which figures to point at, and
writes no figure of its own.
_Avoid_: AI, assistant, bot, author, agent

### What a category has been doing

**Finding**:
_En français_ : constat
One thing the app noticed in a category's run of months that is worth saying
out loud. Four species only, and each is a measurement rather than an
impression: what has drifted, a month apart, a category gone quiet, and what
happens every year. A finding carries an i18n key and its parameters, never a
sentence — the wording belongs to the client drawing it, in the reader's
language.
_Avoid_: insight, alert, anomaly, signal

**Normal**:
_En français_ : un mois normal
What a category costs in an ordinary month: the median of its non-empty
months, not their mean. A mean is dragged by exceptional months, which are
exactly the ones a finding is looking for, and a threshold that moves with the
anomaly it is meant to detect detects nothing.
_Avoid_: average, baseline, typical

### Where it all stands

**Bearing**:
_En français_ : Le point (l'onglet)
Where one month stands: what is on the account, where the month ends, and
what it went on. The month in progress by default, switched with the same
control as the Ledger; a month that has ended tells what it did, one ahead
what its charges call for. The balance is only ever carried from something
read — the bank's statement, or the close of the month before — and without
either the screen counts the month's net and says so rather than inventing a
balance. Every figure on it is one another surface already shows, which is
what makes it checkable rather than a second source of truth. (The phone
still draws the earlier version: where everything stood on one day, as five
cards.)
_Avoid_: dashboard, overview, home, net worth

**Tile**:
_En français_ : tuile
One datum on the bearing: a label, a value, and — where there is an honest
one — the surface that explains it. A tile is a figure rather than a
component, which is why naming one is the same act as naming a datum, and
why a tile with nowhere to lead leads nowhere: inventing a destination would
teach people that pressing tiles is a coin flip.
_Avoid_: widget, stat, KPI

**Card**:
_En français_ : carte
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
_En français_ : panneau
What a card draws under its figures when it is opened — the blocks that show
where the figure came from, fetched only when someone asks for them. Distinct
from the card, which is the name and the figure that are true whether or not
anyone opens it.
_Avoid_: drawer, expander, detail view

### Retired

Terms the app no longer has, kept here so an old row, migration or commit
still reads. Their tables stay in the database; nothing reads or writes them.

**Budget** (_budget_): a cap on what one category may spend in a month.
**Savings goal** (_objectif d'épargne_): an amount to accumulate, tracked
against savings transactions. **Tag** (_étiquette_): a free-form label on
transactions, beside their one category. All three went in October 2026: the
Plan now projects where the money is heading from what the user already
records, rather than asking them to keep limits and targets up to date.
