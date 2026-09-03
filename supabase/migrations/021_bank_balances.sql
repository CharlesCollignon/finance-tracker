-- The balance the account held after each movement, and which accounts count.
--
-- Closing a month needs one number the app cannot work out for itself: what
-- the account actually holds. Until now it asked the user to read it off
-- their banking app once a month, which is the only thing in Pluclair that
-- required typing something it could not derive.
--
-- Where a bank is connected it can be derived. PSD2 will not answer "what did
-- this account hold on 31 August", but most banks attach a running balance to
-- every transaction, and the last movement of a month therefore carries that
-- month's closing balance. Checked against a live account before this was
-- written: the series was consistent across 820 consecutive steps and its
-- newest figure matched the account's own reported balance to the cent.
--
-- Stored rather than fetched at close time, for three reasons: the provider's
-- window is finite and a month eventually scrolls out of it, the phone should
-- be able to close a month without a network round trip through the bank, and
-- a figure that a close was based on should not silently change afterwards.

alter table bank_feed_items
  -- Null is ordinary: the field is optional in PSD2 and some banks omit it.
  -- A null on the row a close needs makes the reading fail rather than guess.
  add column balance_after numeric(12, 2),
  -- Statements carry dates and no times, so without a position within the day
  -- there is no way to know which row a day ended on. Newest first, so 0 is
  -- the day's last movement.
  add column intraday_index smallint not null default 0;

-- Reading "the last row on or before this date" for one account.
create index bank_feed_items_balance_idx
  on bank_feed_items (user_id, provider_account_id, occurred_on desc, intraday_index);

-- The accounts a connection exposes, and whether their money is spendable.
--
-- A connection is not one account. This user's is five, four of which have
-- lapsed consents that return no transactions and a zero "expected" balance —
-- so a close that summed every account it could see would report a month in
-- which thousands of euros vanished, and then invent unrecorded spending to
-- explain the hole. The user says once which accounts hold the money they
-- spend, and a close that cannot read all of them waits instead.
create table bank_accounts (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The provider's id, matching bank_feed_items.provider_account_id.
  provider_account_id text not null,

  -- Whatever the provider called it, for a list the user can recognise.
  label text not null,
  currency text not null,
  -- The account's own reported balance at the last sync, and when that was
  -- true. Kept for the account picker, which has to show something before any
  -- transaction has been stored.
  reported_balance numeric(12, 2),
  reported_on date,
  -- Set when the provider says the consent has lapsed. Such an account is
  -- readable for nothing, so it cannot be counted even if it is ticked.
  needs_reconnect boolean not null default false,

  -- Whether this account's balance is part of "what I have to spend".
  -- Deliberately not defaulted to true: counting an account nobody confirmed
  -- is how the phantom-hole failure above happens.
  counts_as_cash boolean not null default false,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  primary key (user_id, provider_account_id)
);

alter table bank_accounts enable row level security;

create policy "bank_accounts_select_own"
  on bank_accounts for select using (auth.uid() = user_id);

create policy "bank_accounts_insert_own"
  on bank_accounts for insert with check (auth.uid() = user_id);

create policy "bank_accounts_update_own"
  on bank_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bank_accounts_delete_own"
  on bank_accounts for delete using (auth.uid() = user_id);

-- How a month close got its figures, so a screen can say so and a future
-- change of mind can tell the two apart.
alter table month_closes
  add column balance_source text not null default 'manual'
    check (balance_source in ('manual', 'bank'));
