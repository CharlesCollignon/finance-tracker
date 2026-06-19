-- Per-category investment tracking (replaces coarse wallet buckets)

create table investment_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  initial_balance numeric(12, 2) not null default 0
    check (initial_balance >= 0),
  current_value numeric(12, 2)
    check (current_value is null or current_value >= 0),
  share_count integer
    check (share_count is null or share_count > 0),
  instrument_symbol text,
  instrument_name text,
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

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
