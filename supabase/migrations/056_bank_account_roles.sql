-- 056: what each bank account is (docs/plans/MULTI_ACCOUNT_PLAN.md, phase 1).
--
-- One credentials file reads every bank in the user's open-banking.io
-- account, and the sync has always walked every account it could read. What
-- it could not tell apart was what those accounts are: a Livret, a joint
-- account and a card all filled the ledger, and the only thing a user could
-- say about an account was whether its balance counted.
--
-- Each account now has a role, which the user confirms once:
--
--   spending  Courant. Its movements fill the ledger, and its balance is
--             the one Le point shows and a month close reads.
--   savings   Épargne. Its balance is a Livret's on Placements; its
--             movements stay out, since the transfer that fed it was already
--             recorded on the current account.
--   ignored   Ne pas suivre. Nothing is brought in and nothing counted.
--   null      Not decided yet. Treated as ignored until the user says.

alter table bank_accounts
  add column role text
    check (role in ('spending', 'savings', 'ignored')),
  -- The bank the account is at, as open-banking.io names it, so the screens
  -- can group accounts by bank and say which bank's consent is ending.
  add column bank_name text,
  -- What the bank says the account is (ISO 20022: CACC, SVGS, CARD, LOAN…)
  -- and what it sells it as (« LIVRET A », « COMPTE DE DEPOT »): what the
  -- role is guessed from. The label may be a nickname or the holder's name.
  add column account_type text,
  add column product text,
  -- When this account's whole history was brought in. Per account rather
  -- than per connection, so a bank connected after the first import gets its
  -- two years too, not the ordinary few weeks of a sync.
  add column history_imported_at timestamptz,
  -- When this account's bank stops sharing it, unless the consent is renewed.
  add column consent_valid_until timestamptz;

-- The accounts a bank close summed. Without it, the month an account starts
-- counting compares a closing figure that holds it with an opening one that
-- did not, and its whole balance reads as money kept.
--
-- So a close whose accounts differ from the last one's keeps its own opening
-- figure: what its accounts held on the last close's day. Null, as on every
-- close so far, means the last close's figure.
alter table month_closes
  add column bank_accounts text[],
  add column opening_balance numeric(12, 2);

-- Today's state, read as roles: a ticked account was the user's spending
-- money, and one a Livret reads its balance from is that Livret. Savings
-- second, so an account that was both — counted twice, once on Le point and
-- once on Placements — is the Livret it was linked to.
update bank_accounts
set role = 'spending'
where counts_as_cash;

update bank_accounts b
set role = 'savings', counts_as_cash = false
from savings_accounts s
where s.user_id = b.user_id
  and s.bank_account_id = b.provider_account_id;

-- A current account already in the ledger has its history: the first import
-- brought it in, or the owner's environment feed did before there was one.
update bank_accounts b
set history_imported_at = coalesce(
  (select c.backfilled_at from bank_connections c where c.user_id = b.user_id),
  b.first_seen_at
)
where b.role = 'spending'
  and exists (
    select 1
    from bank_feed_items f
    where f.user_id = b.user_id
      and f.provider_account_id = b.provider_account_id
  );

-- Every bank close so far summed the accounts that count today: until now
-- nobody had more than one, and ticking was a once-only answer.
update month_closes m
set bank_accounts = (
  select array_agg(b.provider_account_id order by b.provider_account_id)
  from bank_accounts b
  where b.user_id = m.user_id
    and b.role = 'spending'
)
where m.balance_source = 'bank';

-- The tick follows the role, so everything that reads `counts_as_cash` keeps
-- working. A write that changes only the tick — a phone build from before
-- roles — is read the way its screen meant it: ticked is Courant, unticked
-- is no longer followed.
create or replace function bank_accounts_counts_from_role()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and new.role is not distinct from old.role
    and new.counts_as_cash is distinct from old.counts_as_cash then
    new.role := case when new.counts_as_cash then 'spending' else 'ignored' end;
  end if;
  new.counts_as_cash := coalesce(new.role = 'spending', false);
  return new;
end;
$$;

create trigger bank_accounts_counts_from_role
  before insert or update on bank_accounts
  for each row execute function bank_accounts_counts_from_role();
