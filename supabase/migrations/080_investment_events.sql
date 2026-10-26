-- 080: Investment events — what happened inside a wallet
-- (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 9).
--
-- A position says what is held and what it is worth; the ledger says what
-- was sent to the broker. Neither says what happened inside: a line sold,
-- a dividend received, a fee taken. Those are events, one row each, a
-- person's own (a wallet is never a space's): a buy, a sell, a dividend,
-- a fee — typed by hand, or read off the broker's export, each line of
-- which is known again by its fingerprint so a second export adds nothing
-- twice. From them, the realised gains per wrapper and year (first in,
-- first out) and the dividends received.
--
-- Run after 079. Reverse: drop table public.investment_events;

create table if not exists public.investment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet investment_wallet not null,
  kind text not null check (kind in ('buy', 'sell', 'dividend', 'fee')),
  occurred_on date not null,
  instrument_name text check (char_length(instrument_name) <= 200),
  instrument_symbol text check (char_length(instrument_symbol) <= 32),
  isin text check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  -- Shares or units moved, for a buy or a sell.
  quantity numeric(18, 6) check (quantity is null or quantity >= 0),
  -- The cash: a buy's cost, a sell's proceeds, a dividend received, a fee
  -- paid. Always what moved, never signed.
  amount numeric(12, 2) not null check (amount >= 0),
  note text check (char_length(note) <= 500),
  source text not null default 'manual' check (source in ('manual', 'file')),
  -- Day, kind, amount, instrument and a rank among identical lines: what
  -- makes a line read from a file the same line next time.
  fingerprint text check (char_length(fingerprint) <= 200),
  created_at timestamptz not null default now()
);

-- Plain, not partial: nulls are distinct, so a hand-typed event (no
-- fingerprint) never collides, and an upsert can name the index.
create unique index if not exists investment_events_fingerprint
  on public.investment_events (user_id, fingerprint);

create index if not exists investment_events_user_wallet
  on public.investment_events (user_id, wallet, occurred_on desc);

alter table public.investment_events enable row level security;

drop policy if exists investment_events_select_own on public.investment_events;
create policy investment_events_select_own on public.investment_events
  for select using ((select auth.uid()) = user_id);

drop policy if exists investment_events_insert_own on public.investment_events;
create policy investment_events_insert_own on public.investment_events
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists investment_events_update_own on public.investment_events;
create policy investment_events_update_own on public.investment_events
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists investment_events_delete_own on public.investment_events;
create policy investment_events_delete_own on public.investment_events
  for delete using ((select auth.uid()) = user_id);
