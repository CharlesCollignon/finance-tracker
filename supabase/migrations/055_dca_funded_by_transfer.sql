-- 055: which DCAs the monthly transfer to the broker pays for
-- (docs/plans/DCA_TRANSFER_PLAN.md, the rework).
--
-- The transfer that follows the DCAs (054) followed every purchase made at
-- the broker, and was a charge the user had to find and set. It is now the
-- app's: each DCA says whether the transfer pays for it, and the transfer's
-- figure is what the ticked ones cost.
--
-- On by default for a purchase inside a wallet — an investment the summary
-- does not count — except a crypto one, whose buys the bank takes from the
-- account by card (Bitstack) and no transfer funds. Names as
-- `isCryptoCategoryName` reads them.

alter table recurring_templates
  add column funded_by_transfer boolean not null default false;

update recurring_templates t
set funded_by_transfer = true
from categories c
where t.category_id = c.id
  and c.type = 'investment'
  and c.counts_toward_summary = false
  and upper(c.name) not like '%BITSTACK%'
  and upper(c.name) not like '%BTC%'
  and upper(c.name) not like '%CRYPTO%';

-- The transfer is due on the 1st, for the month it opens.
update recurring_templates
set day_of_month = 1
where pricing_type = 'purchases';
