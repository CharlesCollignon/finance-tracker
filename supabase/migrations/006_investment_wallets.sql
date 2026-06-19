-- Per-wallet baseline: capital before tracking + optional market value

create type wallet_id as enum ('pea', 'cto', 'other');

create table investment_wallets (
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet wallet_id not null,
  initial_balance numeric(12, 2) not null default 0
    check (initial_balance >= 0),
  current_value numeric(12, 2)
    check (current_value is null or current_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, wallet)
);

alter table investment_wallets enable row level security;

create policy "investment_wallets_select_own"
  on investment_wallets for select
  using (auth.uid() = user_id);

create policy "investment_wallets_insert_own"
  on investment_wallets for insert
  with check (auth.uid() = user_id);

create policy "investment_wallets_update_own"
  on investment_wallets for update
  using (auth.uid() = user_id);

create policy "investment_wallets_delete_own"
  on investment_wallets for delete
  using (auth.uid() = user_id);
