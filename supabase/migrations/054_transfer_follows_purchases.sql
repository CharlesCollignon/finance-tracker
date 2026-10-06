-- 054: a transfer whose amount follows the DCAs it funds
-- (docs/plans/DCA_TRANSFER_PLAN.md, Phase 2).
--
-- The money for a DCA PEA or a DCA CTO goes to the broker in one transfer a
-- month, from the pay, and the broker buys with it. What that transfer has
-- to be is what next month's purchases come to — the share-priced ones at
-- the last quote with a margin — so instead of a figure the user guesses, a
-- recurring template in the broker-transfer category can say so:
-- `pricing_type = 'purchases'`. Its `amount` is kept to that figure by the
-- server (`followPurchases`), the way a share-priced template's is kept to
-- its last quote, so everything that reads a template's amount reads it.
--
-- Monthly only: "next month's purchases" is the month after the transfer's
-- own, which a weekly or yearly transfer does not have.

alter type pricing_type add value if not exists 'purchases';

-- The share fields are owed by a share-priced template, not by every
-- template that is not fixed. Compared as text: a value added to an enum
-- cannot be used as one in the transaction that added it.
alter table recurring_templates
  drop constraint recurring_shares_fields_check;

alter table recurring_templates
  add constraint recurring_shares_fields_check
  check (
    pricing_type::text <> 'shares'
    or (
      share_count is not null
      and instrument_symbol is not null
      and instrument_name is not null
    )
  );

alter table recurring_templates
  add constraint recurring_purchases_monthly_check
  check (pricing_type::text <> 'purchases' or recurrence = 'monthly');
