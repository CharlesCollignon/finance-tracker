-- Savings accounts, the accounts a user keeps on Placements, and category
-- names in the reader's language.
--
-- 1. Savings accounts. Until now savings were one sum: everything logged in a
--    savings category, net of withdrawals. A Livret A, an LDDS and a PEL do
--    not grow at the same rate, are not taxed alike, have different ceilings
--    and are not all at hand (a withdrawal closes a PEL), so the Plan could
--    not say what each becomes. One row per kind of account and per user.
--
--    The balance is the one the user gave, on the day they gave it, plus
--    what they have logged in the account's own savings category since — or,
--    when the account is linked to one their bank reports, that balance.
--
-- 2. Which investment accounts a user keeps. Placements showed all five
--    wallets to everyone; it now shows those with positions and those the
--    user added (`wallet_plans.shown`). Every wallet someone already set
--    something up for stays shown.
--
-- 3. Category names. Accounts created while the defaults were English kept
--    their English names on a French app. A default still under its English
--    name is renamed to its French one for every reader whose language is
--    French (the default since 043), unless a category of that name already
--    exists. The investment defaults also lose "weekly" and "monthly" from
--    their names, in both languages: how often a purchase is made is the
--    recurring entry's business, not the category's.

create table if not exists savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('livret_a', 'ldds', 'lep', 'pel', 'cel', 'livret')),
  -- What the user said it held, and on which day.
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  balance_on date not null default current_date,
  -- Null means the regulated rate for the kind (Livret A, LDDS, LEP, CEL)
  -- or the app's default; a PEL keeps the rate of the year it was opened.
  annual_rate numeric(6, 5)
    check (annual_rate is null or (annual_rate >= 0 and annual_rate <= 0.2)),
  -- What is logged here after `balance_on` is added to the balance.
  category_id uuid references categories (id) on delete set null,
  -- The bank account whose reported balance this is, when there is one.
  bank_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

alter table savings_accounts enable row level security;

create policy "savings_accounts_select_own"
  on savings_accounts for select
  using (auth.uid() = user_id);

create policy "savings_accounts_insert_own"
  on savings_accounts for insert
  with check (auth.uid() = user_id);

create policy "savings_accounts_update_own"
  on savings_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "savings_accounts_delete_own"
  on savings_accounts for delete
  using (auth.uid() = user_id);

alter table wallet_plans
  add column if not exists shown boolean not null default false;

comment on column wallet_plans.shown is
  'Whether the user keeps this wallet on Placements. A wallet with positions is shown regardless.';

update wallet_plans set shown = true;

-- (French name, English name, former names) for every default category.
with defaults (type, fr, en, former) as (
  values
    ('income', 'Salaire', 'Salary', array[]::text[]),
    ('expense', 'Électricité', 'Electricity', array[]::text[]),
    ('expense', 'Internet', 'Internet', array[]::text[]),
    ('expense', 'Charges de copropriété', 'Condo fees', array[]::text[]),
    ('expense', 'Remboursement de prêt', 'Loan repayment', array[]::text[]),
    ('expense', 'Frais bancaires', 'Bank card fees', array[]::text[]),
    ('expense', 'Assurance', 'Insurance', array[]::text[]),
    ('expense', 'Courses', 'Groceries', array[]::text[]),
    ('expense', 'Sport', 'Sport', array[]::text[]),
    ('expense', 'Transports', 'Transportation', array[]::text[]),
    ('expense', 'Abonnements', 'Subscriptions', array[]::text[]),
    ('expense', 'Taxe foncière', 'Taxe Foncière', array[]::text[]),
    ('expense', 'Autre', 'Other', array[]::text[]),
    ('savings', 'Livret d''épargne', 'Savings account', array[]::text[]),
    ('investment', 'Virement vers le courtier', 'Broker transfer', array[]::text[]),
    ('investment', 'DCA CTO', 'CTO DCA',
      array['Achat hebdomadaire CTO', 'CTO weekly DCA']),
    ('investment', 'DCA PEA', 'PEA DCA',
      array['Versement mensuel PEA', 'PEA monthly DCA']),
    ('investment', 'DCA Bitstack', 'Bitstack DCA',
      array['Achat hebdomadaire Bitstack', 'Bitstack weekly DCA'])
),
readers as (
  select
    categories.id,
    categories.user_id,
    categories.type::text as type,
    categories.name,
    coalesce(user_preferences.locale, 'fr') as locale
  from categories
  left join user_preferences on user_preferences.user_id = categories.user_id
  where categories.deleted_at is null
),
candidates as (
  select
    readers.id,
    readers.user_id,
    readers.type,
    case when readers.locale = 'en' then defaults.en else defaults.fr end
      as target
  from readers
  join defaults
    on defaults.type = readers.type
   and (
     lower(readers.name) = any (
       select lower(former_name) from unnest(defaults.former) as former_name
     )
     or (readers.locale <> 'en' and lower(readers.name) = lower(defaults.en))
   )
),
-- One rename per target: someone with both "CTO weekly DCA" and "Achat
-- hebdomadaire CTO" keeps the second under its old name rather than
-- failing the unique index on (user, name, type).
renames as (
  select distinct on (user_id, type, lower(target)) id, user_id, type, target
  from candidates
  order by user_id, type, lower(target), id
)
update categories
set name = renames.target
from renames
where categories.id = renames.id
  and categories.name <> renames.target
  and not exists (
    select 1
    from categories as taken
    where taken.user_id = renames.user_id
      and taken.type::text = renames.type
      and lower(taken.name) = lower(renames.target)
      and taken.deleted_at is null
      and taken.id <> renames.id
  );
