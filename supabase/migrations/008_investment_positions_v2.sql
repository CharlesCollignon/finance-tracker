-- Multi-item positions per wallet (PEA / CTO / Crypto), recurring or ad-hoc

create type investment_wallet as enum ('pea', 'cto', 'crypto');

drop table if exists investment_positions;

create table investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet investment_wallet not null,
  recurring_template_id uuid references recurring_templates (id) on delete set null,
  name text not null,
  category_id uuid references categories (id) on delete set null,
  initial_balance numeric(12, 2) not null default 0
    check (initial_balance >= 0),
  current_value numeric(12, 2)
    check (current_value is null or current_value >= 0),
  share_count integer
    check (share_count is null or share_count > 0),
  instrument_symbol text,
  instrument_name text,
  updated_at timestamptz not null default now()
);

create unique index investment_positions_recurring_uidx
  on investment_positions (user_id, recurring_template_id)
  where recurring_template_id is not null;

create index investment_positions_user_wallet_idx
  on investment_positions (user_id, wallet);

alter table investment_positions enable row level security;

create policy "investment_positions_select_own"
  on investment_positions for select
  using (auth.uid() = user_id);

create policy "investment_positions_insert_own"
  on investment_positions for insert
  with check (auth.uid() = user_id);

create policy "investment_positions_update_own"
  on investment_positions for update
  using (auth.uid() = user_id);

create policy "investment_positions_delete_own"
  on investment_positions for delete
  using (auth.uid() = user_id);
