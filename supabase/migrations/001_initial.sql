-- Finance Tracker initial schema

create type category_type as enum (
  'income',
  'expense',
  'savings',
  'investment'
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type category_type not null,
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete restrict,
  recurring_template_id uuid references recurring_templates (id) on delete set null,
  occurred_on date not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index transactions_user_occurred_idx
  on transactions (user_id, occurred_on desc);

create index recurring_templates_user_idx
  on recurring_templates (user_id, active);

create unique index transactions_recurring_month_uidx
  on transactions (
    user_id,
    recurring_template_id,
    (date_trunc('month', occurred_on::timestamp))
  )
  where recurring_template_id is not null;

-- Row Level Security

alter table categories enable row level security;
alter table recurring_templates enable row level security;
alter table transactions enable row level security;

create policy "categories_select_own"
  on categories for select
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on categories for update
  using (auth.uid() = user_id);

create policy "categories_delete_own"
  on categories for delete
  using (auth.uid() = user_id);

create policy "recurring_select_own"
  on recurring_templates for select
  using (auth.uid() = user_id);

create policy "recurring_insert_own"
  on recurring_templates for insert
  with check (auth.uid() = user_id);

create policy "recurring_update_own"
  on recurring_templates for update
  using (auth.uid() = user_id);

create policy "recurring_delete_own"
  on recurring_templates for delete
  using (auth.uid() = user_id);

create policy "transactions_select_own"
  on transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on transactions for update
  using (auth.uid() = user_id);

create policy "transactions_delete_own"
  on transactions for delete
  using (auth.uid() = user_id);
