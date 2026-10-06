# DCA transfer plan

October 2026. The owner sends money every month from the current account (bank
connected) to a broker the app does not see, which then runs the DCA PEA and
DCA CTO on its own. Today the amount is a high-end guess. Sometimes the owner
spends from the broker, a DCA then fails for want of cash, and they either let
it go or send a top-up and buy by hand. What they want: a push a few days
before payday saying how much to send for next month's DCAs, rounded up to be
safe, and an easy yes or no each week when a DCA's day passes.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges.

## How the app tracks the transfer today

- **Current account → broker.** The bank brings the debit; it is filed in
  « Virement vers le courtier » (investment, counts toward the summary), by
  hand the first time and by the matcher after. That row is the only place
  the money leaves the account: it lowers the balance, Le point and the month
  close, and counts as set aside in what was kept and in the savings rate.
- **The transfer as a charge.** A recurring template in that category is
  awaited until a bank movement looks like it — from 15 days before its day
  to 10 after (payday money), within 5 % of its amount (`amountsMatch`) — and
  « C'est arrivé ? » asks for the confirmation that ties the two.
- **Inside the broker.** « DCA PEA » and « DCA CTO » are purchases inside a
  wallet: they never move the account's balance, because the transfer already
  did. With a bank feeding the ledger, each one is asked about on Le point for
  ten days (`purchasesToConfirm`): yes records it on its day and grows the
  position, no skips it, no answer records nothing.
- **The savings rate** counts the larger of the transfers and the purchases,
  never both (`investedForSavingsRate`).

What it cannot know: the cash sitting at the broker. Nothing reads that bank,
the transfer category is not tied to PEA or CTO, and money spent from the
broker is invisible (`wallet_transfers`, migration 012, is read by the month
close and written by nothing). And a transfer of a different amount than its
charge — 1 700 € sent against a 2 000 € charge — is more than 5 % off, so it is
never offered: the charge stays « pas encore passé » in the forecast for ten
days beside the real debit. Sending a computed amount every month would make
that the rule rather than the exception, which is why Phase 2 exists.

## Decisions taken (2026-10-06)

- **The amount covers the next calendar month:** the month after the one the
  transfer counts for. A transfer on 28 October — or one that left early on
  22 October, counted for October as any payday money is — covers November's
  DCAs.
- **Always the full amount.** Nothing is taken off for what may still be at the
  broker: the app cannot see it, and the margin left there each month is what
  covers the money the owner sometimes spends from it.
- **+5 % on share-priced DCAs, then up to the next 50 €.** Fixed-amount DCAs as
  they are; Bitstack and any wallet the bank debits are left out, since their
  buys leave the current account directly.
- **The transfer charge follows the DCAs.** One figure for the charge, the
  forecast, the projection, the push and « C'est arrivé ? ».

## Phase 1 — The weekly answer, pushed (branch `dca-confirm-push`) — done

- [x] A new notification kind `dca` (« Vos DCA » / "Your DCAs"), on by default
      like every kind, with its switch in Profile on both apps.
- [x] The morning after a DCA's day, when `purchasesToConfirm` holds it: « DCA
      CTO : c'est passé ? », several in one push (« 2 achats à confirmer »),
      keyed by the latest day one fell on so each day is said once. The day
      after rather than the day itself, because the broker buys during market
      hours. Opens Le point, where the card is (`/bearing`, already placed on
      both apps by `push-routes`).
- [x] A third answer on the card, for the retry by hand: « Un autre jour »,
      the days from the one after its own to today offered as one tap each
      (`laterDays`), never the template's next occurrence. It records the
      purchase and moves it to that day in one action, which records the skip
      the way moving any template's row does, so it is not asked again. The
      server checks the day against the same rule.
- [x] "A change, not a state": said in `purchasesToConfirmNotification`.

## Phase 2 — The transfer follows the DCAs (branch `dca-transfer-amount`) — done

- [x] Core, tested: `dcaNeedForMonth` — the month's DCA occurrences per
      wallet, their cost (a share-priced template's amount is already its
      last quote), 5 % on the share-priced ones, rounded up to the next 50 €,
      less the skips recorded ahead. `transferCoversMonth` — the month after
      the transfer still in play (the first not settled from ten days back,
      never before the charge was set up).
- [x] Migration 054: `pricing_type` gains `purchases`, monthly only; the share
      fields are owed by `shares` alone.
- [x] Kept in the template's `amount` (`followPurchases`), the way a last
      quote is, so the fill, the forecast, still-to-come and the projection
      read it unchanged. Kept by the daily quote refresh. A month with no
      purchase leaves it as it was (an amount cannot be zero).
- [x] Fulfilment: such a charge is offered whatever was sent (`anyAmount`).
- [x] The big-charge push needs nothing: it compares a charge with the median
      of all the reader's charges, not with its own months.
- [x] Saving such a charge: accepted only in an investment category that
      counts toward the summary, its amount worked out before it is written
      (`transferAmountFor`).
- [x] Kept when the app opens (after the fill, which prices the DCAs), and
      when a charge is saved, paused or deleted, a day skipped or brought
      back, a transfer confirmed or that confirmation undone.
- [x] The charge sheet, web and phone: « Selon vos DCA » beside « Montant
      fixe », the amount field giving way to today's figure and how it is
      reached; the list says « Selon vos DCA du mois suivant ». The month and
      the split by wallet go to Phase 3's push and card, which name them.
- [ ] Without a transfer charge at all, offer to create one on the salary's
      day — moved to Phase 3, beside the push that needs it.
- [x] CONTEXT.md: « virement selon vos DCA », and the rule under Fulfil.

## Phase 3 — How much to send (branch `dca-transfer-push`)

- [x] Payday: the largest monthly income charge, on its occurrence nearest
      the transfer's own day (within the 15 days payday money is given),
      else the transfer's day. No transfer that follows the DCAs, or nothing
      to cover, no push.
- [x] The push, 3 days before payday — or the morning the bank brings the
      salary, if it comes earlier: « Virement Boursorama : 2 150 € »,
      « Pour les DCA prévus en novembre : CTO 1 650 € · PEA 400 €. Arrondi,
      avec 5 % de marge sur ceux achetés en parts. » Kind `dca`, keyed by
      the month covered (`transferReminder`, `transferReminderNotification`).
- [x] Le point, both apps: the same line from that day until the transfer is
      confirmed or skipped, leading to Récurrents, where its figure is.
- [ ] Without a transfer charge at all, offer to create one on the salary's
      day — an invitation card, left for the owner to decide.
- [x] PRODUCT.md and DESIGN.md: nothing they say changes.

## Verification

Core tests for every rule above (a month with five Mondays, a share-priced and
a fixed DCA, a skip ahead, a Bitstack template left out, a salary early, a
transfer 300 € off its charge). Then both apps against local Supabase on :3100
with headless Playwright, one check at a time — never parallel builds on this
machine.

## Risks, said plainly

- Priced at today's quote: 5 % covers an ordinary month's move, not a crash in
  reverse.
- The full amount every month leaves the margin and the rounding at the
  broker, roughly 5–8 % of the DCAs a month. Spent from time to time, that is
  the point; left alone, it adds up to most of a month's DCAs in a year.
  Subtracting it would need a figure the app cannot read, which is why it was
  turned down.
- Order fees are not modelled; the margin absorbs small ones.
