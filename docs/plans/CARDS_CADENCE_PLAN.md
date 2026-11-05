# Débit différé et rythmes de paiement

November 2026. On 2026-11-05 the owner noticed that Pluclair was built for one
kind of person: a salaried employee on a CDI, paid **once a month on a fixed
day**, paying with an **immediate-debit card**. Someone paid every quarter,
someone whose tax is taken ten months out of twelve, and someone whose card
is debited once at the end of the month all get figures that are wrong, not
just untidy. The owner's choices:

- **Débit différé: ask once per card**, rather than guess it from the
  movements. Asking is more reliable. Pluclair asks the moment a card shows
  up, in one tap, and never asks again.
- **A general cadence**: « tous les N mois » plus the months it falls in,
  replacing the fixed monthly / weekly / yearly choice.
- **Freelancers (irregular income) later**: not in this plan.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges. Each phase
updates `docs/how-pluclair-works.md`, `CONTEXT.md`, `apps/web/PRODUCT.md`,
and both `DESIGN.md` files wherever it changes what they say, and adds its
« Nouveautés » entry (`AGENTS.md`). Phone-side entries wait for the APK that
carries them. Each migration also has to be run on the hosted database.

The two halves do not depend on each other. Cards come first because that
is where today's main figure is wrong. If Phase 0 waits on the owner's
approval, Phases 5–6 can go first; the migration numbers then swap.
They did: Phase 5 went first (2026-11-05) and took 084; Phase 0b took 085 and « le montant varie » 086, so cards take 087.

## What is there today

From the survey of 2026-11-05:

**Cards.**

- A bank movement's day is `bookingDate ?? valueDate ?? transactionDate`
  (`packages/core/src/bank-feed.ts:146`). For a deferred-debit card that is
  usually the **debit day**, so a month of purchases lands on the 30th.
- `cash_on`, the day money moved (migration 045, `cash-date.ts`), is only
  ever set by hand in the transaction forms. The feed never sets it.
- A bank account the bank calls `CARD` defaults to **Ne pas suivre**
  (`bank-accounts.ts:34`, `MULTI_ACCOUNT_PLAN.md`). The ledger then holds
  only the one monthly debit on the current account: one large expense with
  no merchant and no category.
- `BankTransaction` carries no card identifier. The only way to tell two
  cards on one account apart is the remittance text (« CARTE X1234 »), whose
  shape varies by bank.
- `bank_feed_items` keeps `occurred_on` but not the raw dates. Re-dating
  existing rows needs the account's history read again.
- « Il vous reste » starts from the balance the bank reports
  (`left-to-spend.ts`). With a deferred card, that balance is too high all
  month by whatever the card has spent.
- The month close pairs the ledger with the bank balance by cash date, to
  the cent (`month-close.ts:166`).
- A provisional line (alert e-mail, Android notification) waits **4 days**
  for its statement line (`statement/provisional.ts:27`). A deferred card is
  booked up to a month later, so the purchase gets counted twice.

**Cadence.**

- `recurrence_type` is `monthly | weekly | yearly` (migrations 002, 003;
  `recurrence.ts:5`). Yearly templates have a `month_of_year`.
- The check `recurring_schedule_check` ties the columns to the cadence.
  `pricing_type = 'purchases'` requires monthly (migration 054).
- About 70 places branch on `recurrence`, most of them in the two recurring
  forms (`apps/web/components/finance/RecurringForm.tsx`,
  `apps/mobile/src/components/RecurringFormModal.tsx`).
- Occurrences come from `getRecurringOccurrenceDates`. Monthly amounts come
  from `estimateMonthlyAmount`, which spreads a yearly amount as `/12`. The
  budget spreads yearly expenses (`budget.ts:19`, `:149`).
- « Il vous reste » runs to the **largest** non-yearly income
  (`payTemplate`) and looks for its next day only 3 months ahead.
- Detection knows gaps of 6–8, 25–36 and 350–380 days only
  (`recurring-detection.ts:82-84`).
- Onboarding asks for the income as a label, an amount and a day: monthly
  only (`onboarding.tsx:87-89`, web `WelcomeFlow.tsx`).

## Phase 0 — Look at real deferred-card data (no branch) — done 2026-11-05

The code depends on what banks actually send, and that varies. Before any
code:

- [x] With the owner's approval for this question (see the
      owner-data-read-only rule): select-only reads of the owner's
      `bank_accounts` (any `CARD` account?) and a sample of card movements:
      which of `transactionDate / bookingDate / valueDate` are filled, how
      far apart they are, whether the remittance text names the card, and
      the wording and amount of the monthly debit.
- [ ] Ask the owner for one statement (PDF or CSV) from a bank with a
      deferred card, if they or someone close has one. Anonymised fixtures
      go into `packages/core/src/statement/__fixtures__`.
- [x] Write down, in this file, which of the three shapes each source shows:
      **(a)** a separate `CARD` account listing the purchases;
      **(b)** the purchases on the current account, booked on the debit day
      or with a later value date;
      **(c)** only one combined line a month.

### What the owner's bank showed (2026-11-05)

Read-only, approved by the owner: open-banking.io's stored copy
(`getAccounts`, `getTransactions` since 2026-05-01, never `syncAll`) and
the owner's `bank_accounts`. One bank, Crédit Agricole Paris IdF.

- **One account**, `CACC` « Compte de Dépôt », role Courant. **No `CARD`
  account.** The owner's card is **immediate debit**: shape (a) cannot be
  seen here, and neither can (b) or (c). There is no combined monthly card
  line in six months.
- 450 movements, all `status: BOOK`, none pending. `bankTransactionCode` is
  always null.
- **`transactionDate` is never filled.** `valueDate` equals `bookingDate`
  on 284 of 287 card lines. The purchase day exists **only in the text**:
  every card line ends with it, `PAIEMENT PAR CARTE X7322 SYMPA LILLE
  30/10` (DD/MM, no year), 284 of 284.
- **Booking lags the purchase** by 0–9 days: 0 d ×8, 1 d ×145, 2 d ×71,
  3 d ×45, 4 d ×10, 5–9 d ×6. **38 of 284 card lines (13 %) are booked in
  the month after the purchase** (30–31 October bought, 2–3 November
  booked), so today they count in the wrong month even on an
  immediate-debit card.
- 21 of 284 lag more than the 4-day provisional window
  (`statement/provisional.ts`): an alert or notification for those would
  not be matched and would count twice.
- The card number is in the text (`X7322`; a refund `AVOIR CARTE X0767`
  once, a second card number). Refunds read `AVOIR CARTE`.

What follows for the plan:

- Crédit Agricole gives the purchase day only as `DD/MM` at the end of the
  text, so the re-dating in Phases 1–2 has to read it there; the year
  comes from the booking date, one year back when the month is later.
- That same re-dating would fix the 13 % of immediate-card lines booked
  in the next month, for every card, deferred or not. Proposed to the
  owner as a phase of its own before Phase 1.
- A deferred card is still unseen. Phases 1, 2 and 4 need a statement or
  feed sample from someone who has one, or are built on the fixtures
  alone.

## Phase 0b — The day a card payment was made (branch `card-purchase-day`) — done

The owner's call on 2026-11-05, from Phase 0: re-date every card payment,
immediate or not, before Phase 1.

- [x] Migration 085: `bank_feed_items.purchased_on`. The bank row keeps its
      booking day in `occurred_on` (the running balance is in that order).
- [x] `purchase-day.ts`: the bank's `transactionDate`, else the `DD/MM`
      ending a card line's text, year from the booking; kept only when
      1–45 days before the booking.
- [x] The transaction written from a bank row (sync, statements, the review
      inbox) counts for the purchase day, with the booking day as its
      `cash_on` (`ledgerDatesOf`). Matching a typed or template row, and
      pairing an alert or notification, go by the purchase day.
- [x] The Journal says « Débité le » only when the debit is in another month
      (`isMovedRow`). Rows already in the ledger keep their dates.
- [x] Changelog entry.

## Phase 1 — « Votre carte » (branch `cards-deferred`) — done, with Phase 2

Covers shape (a), the cleanest: the bank lists the card as its own account.

Built 2026-11-05 on made-up fixtures, at the owner's call: no real
deferred card was available. One engine for every source (`cards.ts`, wired
into `toCandidate`/`planFeed`): the card a line names (`X1234`,
`4974XXXXXXXX1234`, `CB*1234`, `****1234`) or a card account
(`acct:<id>`, role `card`); the debit day a deferred card's alert,
notification or card-account payment leaves on (`debited_on`, migration
087); a card line's late value date taken as its debit; the month's
combined line (`isCardSettlement`) settled against the cycle's total
(`settledCycle`, ±1 % or 1 €, ±6 days). The question: an attention row on
Le point (`cards`) leading to « Vos cartes » on the bank page, web and phone.


- [x] Migration 087 `cards`: `id`, `user_id`, `bank_account_id` (its `CARD`
      account, if any), `spending_account_id` (the account it is debited
      from), `last4` (nullable), `label`, `debit` (`immediate | deferred`,
      null = not asked yet), `debit_day` (nullable: learned from the
      debits), `asked_at`. RLS as on `bank_accounts`.
- [x] `packages/core/src/cards.ts`: the card a movement belongs to,
      whether a movement is a card's monthly debit, and the card's next
      debit day (the stated day, else the one its past debits agree on).
      Tests for each.
- [x] **The question, once per card.** A `CARD` account appears on Banque →
      « Vos comptes » with a fourth choice: **« Carte à débit différé »**,
      with the line « ses paiements dans votre journal, à leur date ; débités
      ensemble le … ». Its first sight also puts one attention row on
      Le point: « Votre carte ••1234 : débit immédiat ou différé ? », two
      buttons, answered once. Before an answer, today's behaviour stays.
- [x] **Its purchases on their day.** A deferred card's movements are
      followed: `occurred_on = transactionDate ?? bookingDate`, and
      `cash_on` = the debit day. The month views count the purchase in its
      own month; the balance curve and the month close see the money leave
      on the debit day.
- [x] **The debit counted once.** The current account's monthly debit for
      that card is recognised: the card account's matching credit, or the
      cycle's total within a few days. It is treated like a transfer
      between own accounts (`ownIbans` in `bank-feed.ts`), not spending:
      written as a known feed row (`status = 'ignored'`, `decided_by =
      'card:settled:<key>'`), its payments taking its day as `cash_on`. The
      quiet Journal line « Débit carte — 42 paiements » is not built.
- [x] Answering « différé » re-dates what is already there instead of
      re-reading history: the card's alert, notification and card-account
      lines take its debit day (`redateCard` in `@finance/data/cards`).
- [x] Changelog entry.

## Phase 2 — Débit différé on the current account — done in `cards-deferred`

Shapes (b) and (c), for a bank connection that has no `CARD` account.

- [x] Cards found from the remittance text (`last4`), with the patterns
      Phase 0 found. Where none is readable, the card is « la carte de ce
      compte ».
- [x] The same once-per-card question, raised the first time Pluclair sees
      a combined debit or card lines whose booking is a week or more after
      the purchase.
- [x] Shape (b): the same re-dating as Phase 1 (purchase day, `cash_on` =
      debit day). Shape (c): the combined line stays one expense until its
      details arrive (Phase 4), and is marked « Débit carte » rather than
      left uncategorised.
- [x] **Provisional lines** match on the purchase day (`transactionDate`)
      when the line has one. Only when it has none does the window widen to
      the card's cycle.
- [x] « Nouvelles dépenses » reads the purchase day, so a deferred card
      doesn't send a month of payments in one push.
- [x] Changelog entry.

## Phase 3 — What the card still owes (branch `cards-left-to-spend`) — done

- [x] « Il vous reste » takes off what the deferred card has spent and not
      yet been debited — every recorded row made by today whose `cash_on` is
      later (`laterDebits`), the ones after the pay day on top of the
      balance's line. Its own line, on the widget and in Ask: « dont 612 €
      de carte, débités le 30 ». The card account's own balance is not read.
- [x] « À venir » on Le point and the balance line show the coming debit on
      its day (`cardDebit` charges in `still-to-come.ts`, against an anchored
      balance only). The Calendar does not yet.
- [ ] The DCA transfer reminder counts the debit if it falls before the
      transfer. Not done.
- [x] Tests on `left-to-spend.ts` with a card debited before and after the
      next pay day.
- [x] Changelog entry.

## Phase 4 — Without a bank connection (branch `cards-statements`) — done

The bank connection is the owner's alone (`bankOpenTo`), so for everyone
else the cards come in through statements, e-mails and notifications.

- [x] Import review recognises a combined card line (« FACTURE CARTE »,
      « RELEVE DIFFERE », « CARTE X1234 DEPENSES DU … »; from what French
      banks are known to print, no real sample) and asks the same question
      — through the shared engine (`planStatement` → `planFeed`).
- [x] A card statement (« relevé d'opérations carte ») is imported as that
      card's purchases: a new statement account can be « Carte différée »
      (role `card`), which creates its card, deferred, debited at month
      end. The combined line it details is then the card's debit, counted
      once.
- [x] E-mail alerts and Android notifications for a deferred card stay
      provisional until the card's statement or debit arrives, and are
      matched on the purchase day.
- [x] Changelog entry.

## Phase 5 — « Tous les N mois » (branch `cadence-months`) — done

One addition covers quarterly pay and bills, every two months, every six
months, and anything taken only in some months (tax over ten months,
January–October; a grant paid September–June).

- [x] Migration 084: `recurring_templates.months smallint[]`, where null
      means every month. Values 1–12, distinct, non-empty, only on monthly
      templates. `recurring_schedule_check` is extended to match. Yearly
      stays as it is: one rule fewer to migrate, and « Une fois par an » in
      the form keeps writing it.
- [x] `recurrence.ts`: occurrences skip months outside `months`, and
      `estimateMonthlyAmount` spreads as `amount × months / 12` (as yearly
      does with `/12`). Schedule labels: « tous les trimestres, le 15
      (janv., avr., juil., oct.) », « chaque mois sauf nov. et déc., le
      15 ». Validation in `validations/finance.ts`, regenerated types,
      `packages/data/src/recurring-templates.ts`.
- [x] Budget: an expense that doesn't fall every month is spread like a
      yearly one (`budget.ts`), under one rule rather than a second copy.
- [x] « Il vous reste »: `payTemplate` picks the largest income **by monthly
      equivalent**, so a 3 000 € quarterly bonus doesn't outrank a
      2 500 € salary. The pay-day horizon goes from 3 to 12 months.
- [x] Forms, web and phone: « Rythme » offers « Tous les mois », « Tous les
      2 mois », « Tous les trimestres », « Tous les 6 mois », « Une fois par
      an », « Certains mois ». The every-N choices ask for the first month;
      « Certains mois » shows twelve month chips. Onboarding's income step
      keeps « tous les mois » with an « Autre rythme » link to the same
      choice.
- [x] The other places that read a template: Ask's tools
      (`apps/web/lib/ask/tools.ts`), phone reminders
      (`apps/mobile/src/lib/notifications.ts`), `push-messages.ts`, the
      demo account. The demo needed nothing: its templates are every month.
      The DCA transfer stays tied to a pay that comes every month.
- [x] Changelog entry.

## Phase 6 — Pluclair finds the rhythm (branch `cadence-detection`) — done

- [x] `recurring-detection.ts` learns gaps of about 2, 3 and 6 months (55–67,
      85–97 and 175–190 days) and proposes a template with the months it
      saw. A monthly run that skips the same months is proposed as
      « certains mois », once every month it keeps was seen in two different
      years (two full years would make the tax taken January–October wait
      until the third January). Below three sightings, nothing is proposed.
      How long a proposal stays open scales with its longest gap. Income is
      still never proposed: a salary is the employer's schedule.
- [x] Matching in `recurring-fulfilment.ts`: an excluded month expects
      nothing, so its silence is never « Est-ce bien arrivé ? ».
- [x] Changelog entry.

## Not in this plan

Raised in the 2026-11-05 review and left for later, unless the owner pulls
one in:

- **Freelancers and irregular income**: an income averaged over what came
  in (the owner's call: later).
- ~~Pay twice a month (an advance and the balance)~~ — done 2026-11-05 as
  « Avec un acompte » (branch `pay-advance`): saved as two monthly incomes.
  Pay every two weeks: still later.
- ~~A tolerance per template for income that varies~~ — done
  2026-11-05 as « Le montant varie » (migration 086, branch `pay-varies`):
  from half the figure up, no bonus split.
- Pay days moved for weekends and public holidays.
- Deferred-card purchases typed by hand (no bank, no statement).
- ~~Pay in 3x/4x~~ — done 2026-11-05 (branch `instalments`): proposed from
  the first instalment as a monthly entry ending after the last
  (`instalments.ts`), count read from « 3X »/« 4X » or asked once.
- ~~Expense-report refunds~~ — done 2026-11-05 (branch `refunds`): a
  default « Remboursements » category (income, not counted: taken off
  spending), offered for money coming back (`looksLikeRefund`), and money in
  only filed where it can go (`categoriesFor`).
- Pay in CHF.

## Questions for the owner

1. **Card debited after the next pay day:** should « Il vous reste » still
   take it off? Recommended: yes, always, on its own line. The money is
   already spent, and leaving it out is exactly how a deferred card
   surprises people.
2. **Phase 0** needs your OK to read your hosted bank data, select-only.
3. **Yearly** stays its own cadence beside the months set. Recommended
   until something needs them merged.
