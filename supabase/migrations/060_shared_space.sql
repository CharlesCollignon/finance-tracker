-- 060: a space two people share (docs/plans/SHARED_SPACE_DESIGN.md).
--
-- A space is an owner. The money tables keep their `user_id`, read from here
-- on as *owner*: a person's id for their own money, a space's for the joint
-- money. The joint rows are the same rows in the same tables under another
-- owner, so every read and write already written keeps working, handed the
-- space's id; what this migration changes is who may hand which id.
--
--   owners          one row per person and one per space: what the money
--                   tables now point at, `on delete cascade` as before.
--   spaces          the joint space: its name (« Commun » until renamed).
--   space_members   who is in it, and each one's share (phase 6b).
--   space_invites   a link to join, valid seven days, for one person.
--
-- The tables a space can own get one rule: a row is yours when its owner is
-- you, or a space you are a member of. The rest — preferences, push tokens,
-- the bank's keys, the AI accounts, wallets, savings — stay a person's.
-- `acting_for`, the gate of every definer function, takes a space's id from
-- a member too.
--
-- Run it on the hosted project only after a backup: it repoints seventeen
-- foreign keys and rewrites the rules of seventeen tables, in one
-- transaction.
--
-- Reversible, while no space exists (a space's rows would orphan):
--   drop the policies "<table>_*_owner" and restore 018–057's `*_own` ones;
--   alter table <table> drop constraint <table>_user_id_fkey,
--     add constraint <table>_user_id_fkey foreign key (user_id)
--     references auth.users (id) on delete cascade;   -- the 17 tables
--   drop function create_space, rename_space, create_space_invite,
--     join_space, leave_space, my_spaces; restore acting_for from 025;
--   drop table space_invites, space_members, spaces, owners cascade;
--   alter table transactions drop column created_by;
--   alter table recurring_templates drop column created_by;
--   alter table bank_accounts drop column iban_hash, drop column space_id;
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/060_shared_space.test.sql`.

-- 1. Owners: every person, every space.

create table if not exists public.owners (
  id uuid primary key,
  kind text not null check (kind in ('person', 'space')),
  created_at timestamptz not null default now()
);

insert into public.owners (id, kind)
select id, 'person' from auth.users
on conflict (id) do nothing;

create or replace function public.owner_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.owners (id, kind) values (new.id, 'person')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists owner_for_new_user on auth.users;
create trigger owner_for_new_user
  after insert on auth.users
  for each row execute function public.owner_for_new_user();

-- A person deleted takes their owner row, and through it their own money.
create or replace function public.owner_gone_with_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.owners where id = old.id and kind = 'person';
  return old;
end;
$$;

drop trigger if exists owner_gone_with_user on auth.users;
create trigger owner_gone_with_user
  after delete on auth.users
  for each row execute function public.owner_gone_with_user();

-- 2. Spaces, their members, their invites.

create table if not exists public.spaces (
  id uuid primary key references public.owners (id) on delete cascade,
  name text not null default 'Commun' check (length(trim(name)) between 1 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- What part of the joint spending is this member's (« ma part », 6b).
  share numeric(5, 4) not null default 0.5 check (share >= 0 and share <= 1),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index if not exists space_members_user_idx on public.space_members (user_id);

create table if not exists public.space_invites (
  token text primary key,
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

-- The spaces the signed-in person is in. Definer, so the rules below can ask
-- it without the members' own rule asking itself.
create or replace function public.my_spaces()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select space_id from public.space_members where user_id = auth.uid();
$$;
revoke all on function public.my_spaces() from public, anon;
grant execute on function public.my_spaces() to authenticated;

alter table public.owners enable row level security;
drop policy if exists "owners_select" on public.owners;
create policy "owners_select" on public.owners
  for select using (id = (select auth.uid()) or id in (select public.my_spaces()));

alter table public.spaces enable row level security;
drop policy if exists "spaces_select" on public.spaces;
create policy "spaces_select" on public.spaces
  for select using (id in (select public.my_spaces()));

alter table public.space_members enable row level security;
drop policy if exists "space_members_select" on public.space_members;
create policy "space_members_select" on public.space_members
  for select using (space_id in (select public.my_spaces()));

alter table public.space_invites enable row level security;
drop policy if exists "space_invites_select" on public.space_invites;
create policy "space_invites_select" on public.space_invites
  for select using (space_id in (select public.my_spaces()));

-- 3. The money tables point at owners, and two of them say who added a row.

do $$
declare
  owned text[] := array[
    'transactions', 'categories', 'recurring_templates', 'recurring_skips',
    'recurring_fulfilments', 'recurring_fulfilment_refusals',
    'recurring_proposal_dismissals', 'month_closes', 'month_close_settings',
    'balance_readings', 'deletion_undo', 'month_reads', 'bank_feed_items',
    'properties', 'property_loans', 'property_market_readings',
    'property_rent_references'
  ];
  owned_table text;
begin
  foreach owned_table in array owned loop
    if to_regclass('public.' || owned_table) is null then
      continue;
    end if;
    execute format(
      'alter table public.%I drop constraint if exists %I',
      owned_table, owned_table || '_user_id_fkey'
    );
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) '
      'references public.owners (id) on delete cascade',
      owned_table, owned_table || '_user_id_fkey'
    );
  end loop;
end $$;

alter table public.transactions
  add column if not exists created_by uuid default auth.uid()
    references auth.users (id) on delete set null;
alter table public.recurring_templates
  add column if not exists created_by uuid default auth.uid()
    references auth.users (id) on delete set null;

-- A joint account: which space its rows feed, and a fingerprint of its IBAN
-- — never the IBAN — so the second partner's copy of it can be told apart.
alter table public.bank_accounts
  add column if not exists iban_hash text,
  add column if not exists space_id uuid
    references public.spaces (id) on delete set null;

-- 4. Who may read and write a row: its owner, or a member of the space
--    that owns it. Every rule on the tables a space can own, rewritten from
--    `auth.uid() = user_id`, with the same cross-checks made against the row's
--    owner rather than the person: a joint transaction takes a joint category.

-- transactions
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'transactions'
  loop
    execute format('drop policy %I on public.transactions', policy.policyname);
  end loop;
end $$;
create policy "transactions_select_owner" on public.transactions
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and deleted_at is null);
create policy "transactions_insert_owner" on public.transactions
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from categories x where x.id = transactions.category_id and x.user_id = transactions.user_id) and (transactions.recurring_template_id is null or exists (select 1 from recurring_templates x where x.id = transactions.recurring_template_id and x.user_id = transactions.user_id)));
create policy "transactions_update_owner" on public.transactions
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from categories x where x.id = transactions.category_id and x.user_id = transactions.user_id) and (transactions.recurring_template_id is null or exists (select 1 from recurring_templates x where x.id = transactions.recurring_template_id and x.user_id = transactions.user_id)));
create policy "transactions_delete_owner" on public.transactions
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- categories
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'categories'
  loop
    execute format('drop policy %I on public.categories', policy.policyname);
  end loop;
end $$;
create policy "categories_select_owner" on public.categories
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and deleted_at is null);
create policy "categories_insert_owner" on public.categories
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "categories_update_owner" on public.categories
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "categories_delete_owner" on public.categories
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- recurring_templates
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'recurring_templates'
  loop
    execute format('drop policy %I on public.recurring_templates', policy.policyname);
  end loop;
end $$;
create policy "recurring_templates_select_owner" on public.recurring_templates
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_templates_insert_owner" on public.recurring_templates
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from categories x where x.id = recurring_templates.category_id and x.user_id = recurring_templates.user_id) and (recurring_templates.property_id is null or exists (select 1 from properties x where x.id = recurring_templates.property_id and x.user_id = recurring_templates.user_id)));
create policy "recurring_templates_update_owner" on public.recurring_templates
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from categories x where x.id = recurring_templates.category_id and x.user_id = recurring_templates.user_id) and (recurring_templates.property_id is null or exists (select 1 from properties x where x.id = recurring_templates.property_id and x.user_id = recurring_templates.user_id)));
create policy "recurring_templates_delete_owner" on public.recurring_templates
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- recurring_skips
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'recurring_skips'
  loop
    execute format('drop policy %I on public.recurring_skips', policy.policyname);
  end loop;
end $$;
create policy "recurring_skips_select_owner" on public.recurring_skips
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_skips_insert_owner" on public.recurring_skips
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from recurring_templates x where x.id = recurring_skips.template_id and x.user_id = recurring_skips.user_id));
create policy "recurring_skips_delete_owner" on public.recurring_skips
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- recurring_fulfilments
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'recurring_fulfilments'
  loop
    execute format('drop policy %I on public.recurring_fulfilments', policy.policyname);
  end loop;
end $$;
create policy "recurring_fulfilments_select_owner" on public.recurring_fulfilments
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_fulfilments_insert_owner" on public.recurring_fulfilments
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_fulfilments_update_owner" on public.recurring_fulfilments
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_fulfilments_delete_owner" on public.recurring_fulfilments
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- recurring_fulfilment_refusals
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'recurring_fulfilment_refusals'
  loop
    execute format('drop policy %I on public.recurring_fulfilment_refusals', policy.policyname);
  end loop;
end $$;
create policy "recurring_fulfilment_refusals_select_owner" on public.recurring_fulfilment_refusals
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_fulfilment_refusals_insert_owner" on public.recurring_fulfilment_refusals
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_fulfilment_refusals_delete_owner" on public.recurring_fulfilment_refusals
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- recurring_proposal_dismissals
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'recurring_proposal_dismissals'
  loop
    execute format('drop policy %I on public.recurring_proposal_dismissals', policy.policyname);
  end loop;
end $$;
create policy "recurring_proposal_dismissals_select_owner" on public.recurring_proposal_dismissals
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_proposal_dismissals_insert_owner" on public.recurring_proposal_dismissals
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "recurring_proposal_dismissals_delete_owner" on public.recurring_proposal_dismissals
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- month_closes
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'month_closes'
  loop
    execute format('drop policy %I on public.month_closes', policy.policyname);
  end loop;
end $$;
create policy "month_closes_select_owner" on public.month_closes
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "month_closes_insert_owner" on public.month_closes
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "month_closes_update_owner" on public.month_closes
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "month_closes_delete_owner" on public.month_closes
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- month_close_settings
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'month_close_settings'
  loop
    execute format('drop policy %I on public.month_close_settings', policy.policyname);
  end loop;
end $$;
create policy "month_close_settings_select_owner" on public.month_close_settings
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "month_close_settings_insert_owner" on public.month_close_settings
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "month_close_settings_update_owner" on public.month_close_settings
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "month_close_settings_delete_owner" on public.month_close_settings
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- balance_readings
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'balance_readings'
  loop
    execute format('drop policy %I on public.balance_readings', policy.policyname);
  end loop;
end $$;
create policy "balance_readings_select_owner" on public.balance_readings
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "balance_readings_insert_owner" on public.balance_readings
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "balance_readings_update_owner" on public.balance_readings
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "balance_readings_delete_owner" on public.balance_readings
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- deletion_undo
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'deletion_undo'
  loop
    execute format('drop policy %I on public.deletion_undo', policy.policyname);
  end loop;
end $$;
create policy "deletion_undo_select_owner" on public.deletion_undo
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- month_reads
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'month_reads'
  loop
    execute format('drop policy %I on public.month_reads', policy.policyname);
  end loop;
end $$;
create policy "month_reads_select_owner" on public.month_reads
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- bank_feed_items
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'bank_feed_items'
  loop
    execute format('drop policy %I on public.bank_feed_items', policy.policyname);
  end loop;
end $$;
create policy "bank_feed_items_select_owner" on public.bank_feed_items
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "bank_feed_items_insert_owner" on public.bank_feed_items
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "bank_feed_items_update_owner" on public.bank_feed_items
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "bank_feed_items_delete_owner" on public.bank_feed_items
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- properties
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'properties'
  loop
    execute format('drop policy %I on public.properties', policy.policyname);
  end loop;
end $$;
create policy "properties_select_owner" on public.properties
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "properties_insert_owner" on public.properties
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "properties_update_owner" on public.properties
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "properties_delete_owner" on public.properties
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- property_loans
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'property_loans'
  loop
    execute format('drop policy %I on public.property_loans', policy.policyname);
  end loop;
end $$;
create policy "property_loans_select_owner" on public.property_loans
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "property_loans_insert_owner" on public.property_loans
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from properties x where x.id = property_loans.property_id and x.user_id = property_loans.user_id) and (property_loans.recurring_template_id is null or exists (select 1 from recurring_templates x where x.id = property_loans.recurring_template_id and x.user_id = property_loans.user_id)) and (property_loans.insurance_template_id is null or exists (select 1 from recurring_templates x where x.id = property_loans.insurance_template_id and x.user_id = property_loans.user_id)));
create policy "property_loans_update_owner" on public.property_loans
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from properties x where x.id = property_loans.property_id and x.user_id = property_loans.user_id) and (property_loans.recurring_template_id is null or exists (select 1 from recurring_templates x where x.id = property_loans.recurring_template_id and x.user_id = property_loans.user_id)) and (property_loans.insurance_template_id is null or exists (select 1 from recurring_templates x where x.id = property_loans.insurance_template_id and x.user_id = property_loans.user_id)));
create policy "property_loans_delete_owner" on public.property_loans
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- property_market_readings
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'property_market_readings'
  loop
    execute format('drop policy %I on public.property_market_readings', policy.policyname);
  end loop;
end $$;
create policy "property_market_readings_select_owner" on public.property_market_readings
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "property_market_readings_insert_owner" on public.property_market_readings
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from properties x where x.id = property_market_readings.property_id and x.user_id = property_market_readings.user_id));
create policy "property_market_readings_update_owner" on public.property_market_readings
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from properties x where x.id = property_market_readings.property_id and x.user_id = property_market_readings.user_id));
create policy "property_market_readings_delete_owner" on public.property_market_readings
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- property_rent_references
do $$
declare policy record;
begin
  for policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'property_rent_references'
  loop
    execute format('drop policy %I on public.property_rent_references', policy.policyname);
  end loop;
end $$;
create policy "property_rent_references_select_owner" on public.property_rent_references
  for select using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));
create policy "property_rent_references_insert_owner" on public.property_rent_references
  for insert with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from properties x where x.id = property_rent_references.property_id and x.user_id = property_rent_references.user_id));
create policy "property_rent_references_update_owner" on public.property_rent_references
  for update using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())))
  with check ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())) and exists (select 1 from properties x where x.id = property_rent_references.property_id and x.user_id = property_rent_references.user_id));
create policy "property_rent_references_delete_owner" on public.property_rent_references
  for delete using ((user_id = (select auth.uid()) or user_id in (select public.my_spaces())));

-- 5. The gate of every definer function takes a space from its member.

create or replace function public.acting_for(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- Null-proof, as in 025: an anonymous caller is never trusted.
  select coalesce(
    target_user is not null
    and (
      auth.uid() is not distinct from target_user
      or exists (
        select 1 from public.space_members m
        where m.space_id = target_user and m.user_id = auth.uid()
      )
      or coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb
             ->> 'role',
           ''
         ) = 'service_role'
    ),
    false
  );
$function$;

-- 6. Making a space, inviting to it, joining it, leaving it.

-- One space a person, for now: a couple's.
create or replace function public.create_space(new_name text default 'Commun')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  made uuid := gen_random_uuid();
begin
  if who is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.space_members where user_id = who) then
    raise exception 'already in a space' using errcode = 'P0001';
  end if;
  insert into public.owners (id, kind) values (made, 'space');
  insert into public.spaces (id, name, created_by)
  values (made, coalesce(nullif(trim(new_name), ''), 'Commun'), who);
  insert into public.space_members (space_id, user_id) values (made, who);
  -- The joint categories, copied from the creator's to start.
  insert into public.categories (user_id, name, type, icon, counts_toward_summary)
  select made, c.name, c.type, c.icon, c.counts_toward_summary
  from public.categories c
  where c.user_id = who and c.deleted_at is null and coalesce(c.archived, false) = false;
  return made;
end;
$$;

create or replace function public.rename_space(target_space uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.space_members
    where space_id = target_space and user_id = auth.uid()
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  update public.spaces set name = trim(new_name) where id = target_space;
end;
$$;

create or replace function public.create_space_invite(target_space uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  made text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not exists (
    select 1 from public.space_members
    where space_id = target_space and user_id = auth.uid()
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  insert into public.space_invites (token, space_id, created_by)
  values (made, target_space, auth.uid());
  return made;
end;
$$;

-- What a link says before it is used: the space's name, who sent it, and
-- whether it can still be used — for the page that asks « Rejoindre ? ».
create or replace function public.peek_space_invite(invite_token text)
returns table (space_name text, invited_by text, usable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.name,
    coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      split_part(u.email, '@', 1)
    ),
    i.accepted_at is null
      and i.expires_at > now()
      and (select count(*) from public.space_members m where m.space_id = s.id) < 2
      and not exists (select 1 from public.space_members m where m.user_id = auth.uid())
  from public.space_invites i
  join public.spaces s on s.id = i.space_id
  left join auth.users u on u.id = i.created_by
  where i.token = invite_token;
$$;

create or replace function public.join_space(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  invite public.space_invites;
begin
  if who is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into invite from public.space_invites
  where token = invite_token for update;
  if invite.token is null
    or invite.accepted_at is not null
    or invite.expires_at <= now() then
    raise exception 'invite not usable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.space_members where user_id = who) then
    raise exception 'already in a space' using errcode = 'P0001';
  end if;
  if (select count(*) from public.space_members where space_id = invite.space_id) >= 2 then
    raise exception 'space full' using errcode = 'P0001';
  end if;
  insert into public.space_members (space_id, user_id) values (invite.space_id, who);
  update public.space_invites
    set accepted_by = who, accepted_at = now()
    where token = invite_token;
  return invite.space_id;
end;
$$;

create or replace function public.leave_space(target_space uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.space_members
  where space_id = target_space and user_id = auth.uid();
end;
$$;

-- The last member gone, the space goes, and its rows with it.
create or replace function public.space_gone_when_empty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.space_members where space_id = old.space_id) then
    delete from public.owners where id = old.space_id and kind = 'space';
  end if;
  return old;
end;
$$;

drop trigger if exists space_gone_when_empty on public.space_members;
create trigger space_gone_when_empty
  after delete on public.space_members
  for each row execute function public.space_gone_when_empty();

do $$
declare fn text;
begin
  foreach fn in array array[
    'create_space(text)', 'rename_space(uuid, text)',
    'create_space_invite(uuid)', 'peek_space_invite(text)',
    'join_space(text)', 'leave_space(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
