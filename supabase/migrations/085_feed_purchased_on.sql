-- 085: the day a card payment was made, beside the day the bank booked it.
--
-- A bank books a card payment one to nine days after it was made: at Crédit
-- Agricole, 13 % of card lines land in the month after the purchase (bought
-- on 31 October, booked on 3 November), so they counted for the wrong month
-- (docs/plans/CARDS_CADENCE_PLAN.md, Phase 0). The purchase day is in the
-- bank's own `transactionDate` where it fills it, and otherwise at the end of
-- the line's text (« PAIEMENT PAR CARTE X7322 SYMPA LILLE 30/10 »).
--
-- `occurred_on` stays the day the bank booked it: the running balance that
-- reads past month-ends is in that order. `purchased_on` is the day it was
-- made, null when the bank says nothing more or it is the same day. The
-- transaction written from the row counts for `purchased_on` and keeps the
-- booking day as its `cash_on` (migration 045), so the month close still
-- meets the bank's balance on the day the money left.
--
-- Rows already brought in keep their dates.
--
-- Reverse:
--   alter table public.bank_feed_items drop column if exists purchased_on;

alter table public.bank_feed_items
  add column if not exists purchased_on date;
