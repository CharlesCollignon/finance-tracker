-- The one balance the app is allowed to know.
--
-- Everything else here is a flow: a transaction is money having moved, and
-- the totals are sums of those movements. That model is honest about what it
-- was told and silent about what it was not — the restaurant, the round of
-- drinks, the thing bought on the way home. Those never become transactions,
-- so no amount of arithmetic over the ledger can find them.
--
-- One number a month closes that gap. Given what the account held at the end
-- of the previous month and what it holds now, the spending the app never
-- heard about is the difference the recorded movements fail to explain. The
-- user enters a balance; the app works out the rest.

-- 1. One close per month.

create table month_closes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The calendar month being closed, stored as its first day so it orders
  -- and compares as a date rather than as text.
  month date not null,
  -- What the accounts day-to-day spending leaves from actually held. Allowed
  -- to be negative: an overdraft is a real state and refusing to record it
  -- would make the month unclosable for the person who most needs the figure.
  closing_balance numeric(12, 2) not null,
  -- The day the balance was read, which is deliberately not the last of the
  -- month. With a deferred-debit card the month's card spending has not
  -- landed yet on the 31st, so the balance is read a few days into the next
  -- month instead. Recorded per close rather than assumed, so a close taken
  -- on an unusual day still says so.
  observed_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create index month_closes_user_month_idx
  on month_closes (user_id, month desc);

-- The first day of the month, and nothing else. A close is a statement about
-- a month, so a mid-month date here is a bug rather than extra precision.
-- The cast is explicit so the check resolves to the immutable
-- date_trunc(text, timestamp), which is what a CHECK constraint requires;
-- passing a date bare can pick the timestamptz overload, which is only
-- STABLE and would be rejected.
alter table month_closes
  add constraint month_closes_month_is_first_day
  check (month = date_trunc('month', month::timestamp)::date);

alter table month_closes enable row level security;

create policy "month_closes_select_own"
  on month_closes for select using (auth.uid() = user_id);

create policy "month_closes_insert_own"
  on month_closes for insert with check (auth.uid() = user_id);

create policy "month_closes_update_own"
  on month_closes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "month_closes_delete_own"
  on month_closes for delete using (auth.uid() = user_id);

-- 2. How the user wants closing to work.
--
-- One row per user, created lazily: someone who never closes a month has no
-- row and is asked nothing, which is the correct default.

create table month_close_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Day of the following month the app asks for the balance. The default is
  -- the 5th, by which a deferred debit has normally landed. Capped at 28 so
  -- the prompt exists in February.
  close_day smallint not null default 5
    check (close_day >= 1 and close_day <= 28),
  -- What the user is willing to spend without recording it. Null means they
  -- have not set one yet, which is the honest state until a few months have
  -- been closed and there is a baseline to set it from.
  unrecorded_cap numeric(12, 2)
    check (unrecorded_cap is null or unrecorded_cap >= 0),
  updated_at timestamptz not null default now()
);

alter table month_close_settings enable row level security;

create policy "month_close_settings_select_own"
  on month_close_settings for select using (auth.uid() = user_id);

create policy "month_close_settings_insert_own"
  on month_close_settings for insert with check (auth.uid() = user_id);

create policy "month_close_settings_update_own"
  on month_close_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "month_close_settings_delete_own"
  on month_close_settings for delete using (auth.uid() = user_id);
