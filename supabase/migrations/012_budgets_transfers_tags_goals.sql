-- Phase 4 domain extensions: budgets, wallet transfers, tags, savings goals.

-- 1. Monthly budget caps (null category_id = global expense cap)

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index budgets_user_idx on budgets (user_id);

-- One global cap (null category) and one cap per category.
create unique index budgets_user_global_uidx
  on budgets (user_id)
  where category_id is null;

create unique index budgets_user_category_uidx
  on budgets (user_id, category_id)
  where category_id is not null;

alter table budgets enable row level security;

create policy "budgets_select_own"
  on budgets for select using (auth.uid() = user_id);

create policy "budgets_insert_own"
  on budgets for insert
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

create policy "budgets_update_own"
  on budgets for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

create policy "budgets_delete_own"
  on budgets for delete using (auth.uid() = user_id);

-- 2. Wallet transfers (cash → PEA/CTO/Crypto), replaces naming-convention
--    "Broker transfer" for new entries while keeping old txs intact.

create table wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  to_wallet investment_wallet not null,
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null,
  note text,
  created_at timestamptz not null default now()
);

create index wallet_transfers_user_occurred_idx
  on wallet_transfers (user_id, occurred_on desc);

alter table wallet_transfers enable row level security;

create policy "wallet_transfers_select_own"
  on wallet_transfers for select using (auth.uid() = user_id);

create policy "wallet_transfers_insert_own"
  on wallet_transfers for insert with check (auth.uid() = user_id);

create policy "wallet_transfers_update_own"
  on wallet_transfers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "wallet_transfers_delete_own"
  on wallet_transfers for delete using (auth.uid() = user_id);

-- 3. Tags

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  check (char_length(trim(name)) between 1 and 40)
);

create table transaction_tags (
  transaction_id uuid not null references transactions (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (transaction_id, tag_id)
);

create index tags_user_idx on tags (user_id);
create index transaction_tags_tag_idx on transaction_tags (tag_id);

alter table tags enable row level security;
alter table transaction_tags enable row level security;

create policy "tags_select_own"
  on tags for select using (auth.uid() = user_id);

create policy "tags_insert_own"
  on tags for insert with check (auth.uid() = user_id);

create policy "tags_update_own"
  on tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tags_delete_own"
  on tags for delete using (auth.uid() = user_id);

create policy "transaction_tags_select_own"
  on transaction_tags for select
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );

create policy "transaction_tags_insert_own"
  on transaction_tags for insert
  with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
    and exists (
      select 1 from tags g
      where g.id = tag_id and g.user_id = auth.uid()
    )
  );

create policy "transaction_tags_delete_own"
  on transaction_tags for delete
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );

-- 4. Savings goals

create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  target_date date,
  category_id uuid references categories (id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(trim(name)) between 1 and 100)
);

create index savings_goals_user_idx on savings_goals (user_id);

alter table savings_goals enable row level security;

create policy "savings_goals_select_own"
  on savings_goals for select using (auth.uid() = user_id);

create policy "savings_goals_insert_own"
  on savings_goals for insert
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

create policy "savings_goals_update_own"
  on savings_goals for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

create policy "savings_goals_delete_own"
  on savings_goals for delete using (auth.uid() = user_id);
