-- 057: a balance the user types, before any close (docs/plans/EVERYDAY_PLAN.md,
-- Phase 1).
--
-- Le point's balance is carried from something read: the bank's statement,
-- or the close of the month before. A new user has neither, so the month is
-- counted from zero and « Il vous reste » cannot be said. One figure typed on
-- Le point's setup card — what the account holds today — is a reading like a
-- close: the rows recorded after it move it, and the first close after it
-- takes over (`@finance/data/month-balance`).
--
-- One row per user, the last one typed: it only ever stands until a close,
-- so an older one has nothing left to say.
--
-- Reversible:
--   drop table balance_readings;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/057_balance_readings.test.sql`.

create table if not exists balance_readings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The day the balance was read off the bank. Rows dated after it move it.
  read_on date not null,
  -- What the day-to-day accounts held. Allowed to be negative, as a close's
  -- is: an overdraft is a real state.
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

comment on table balance_readings is
  'A balance the user typed before any close: Le point carries it until a close is newer.';

alter table balance_readings enable row level security;

drop policy if exists "balance_readings_select_own" on balance_readings;
create policy "balance_readings_select_own"
  on balance_readings for select using (auth.uid() = user_id);

drop policy if exists "balance_readings_insert_own" on balance_readings;
create policy "balance_readings_insert_own"
  on balance_readings for insert with check (auth.uid() = user_id);

drop policy if exists "balance_readings_update_own" on balance_readings;
create policy "balance_readings_update_own"
  on balance_readings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "balance_readings_delete_own" on balance_readings;
create policy "balance_readings_delete_own"
  on balance_readings for delete using (auth.uid() = user_id);
