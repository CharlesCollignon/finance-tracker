-- 087: cards, and the day a deferred-debit card's payments leave the account.
--
-- A card on deferred debit (« débit différé ») is paid with at the till and
-- debited once a month, all its payments together. Pluclair could not tell:
-- each payment counted as money gone on the day it was made, the balance it
-- read from the bank still held it, and the month-end debit came in as one
-- large unexplained expense on top of them (docs/plans/CARDS_CADENCE_PLAN.md,
-- Phases 1–4).
--
-- `cards`: every card Pluclair has seen, asked once whether it is debited at
-- once or later. `key` is how its lines name it: the last four digits banks
-- print (« CARTE X7322 »), or `acct:<provider account id>` for a card the
-- bank shows as its own account (`CARD`). `debit` stays null until the
-- question is answered, and nothing changes before then. `debit_day` is the
-- day of the month it is debited, 31 meaning the last day whatever the month.
--
-- `bank_feed_items.card_key`: the card a line is from, where it says.
-- `bank_feed_items.debited_on`: for a deferred card's payment, the day its
-- money leaves the current account — what the transaction written from it
-- takes as its `cash_on` (migration 045), so the balance line, the month close
-- and « Il vous reste » see the money go on that day.
--
-- `bank_accounts.role` gains `card`: a card the bank shows as its own account,
-- whose payments come into the ledger and whose balance is not cash.
--
-- Reverse:
--   alter table public.bank_accounts drop constraint bank_accounts_role_check,
--     add constraint bank_accounts_role_check
--       check (role in ('spending', 'savings', 'ignored', 'joint'));
--   alter table public.bank_feed_items drop column if exists card_key,
--     drop column if exists debited_on;
--   drop table if exists public.cards;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.owners (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  label text check (char_length(label) <= 100),
  debit text check (debit in ('immediate', 'deferred')),
  debit_day smallint check (debit_day between 1 and 31),
  first_seen_on date not null default current_date,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.cards enable row level security;

create policy "cards_select_owner" on public.cards
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "cards_insert_owner" on public.cards
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "cards_update_owner" on public.cards
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "cards_delete_owner" on public.cards
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

alter table public.bank_feed_items
  add column if not exists card_key text,
  add column if not exists debited_on date;

create index if not exists bank_feed_items_card_idx
  on public.bank_feed_items (user_id, card_key)
  where card_key is not null;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_role_check;
alter table public.bank_accounts
  add constraint bank_accounts_role_check
    check (role in ('spending', 'savings', 'ignored', 'joint', 'card'));
