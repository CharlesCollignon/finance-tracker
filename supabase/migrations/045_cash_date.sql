-- The day the money actually moved, when it is not the day it counts for.
--
-- A salary paid on 22 September for October is October's income: the user
-- budgets October with it, and counting it in September makes September look
-- rich and October broke. But the account received it on the 22nd, and the
-- month close compares the ledger with what the account held — so the 22nd
-- still matters, for the balance and for nothing else.
--
-- `occurred_on` stays the date a transaction counts for, which is what every
-- month view, budget, summary and read already uses; nothing about them
-- changes. `cash_on` is set only when the two differ, and only the
-- calculations that pair the ledger with a balance read it: the month close,
-- the balance curve, what has gone unrecorded so far. Null means "the same
-- day", which is every row there has ever been.
--
-- Set when the user confirms that an income arrived early for the next month
-- (`fulfilOccurrence`), cleared when they undo it.

alter table transactions add column if not exists cash_on date;

comment on column transactions.cash_on is
  'The day the money moved, when it differs from occurred_on (the day it counts for). Null when they are the same.';

-- The month close and the balance curve read a month by either date.
create index if not exists transactions_user_cash_on_idx
  on transactions (user_id, cash_on)
  where cash_on is not null;
