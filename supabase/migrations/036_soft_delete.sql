-- Taking a delete back.
--
-- Deleting a transaction or a category stops removing the row and starts
-- marking it. The toast that reports the deletion can then offer an Undo,
-- which is the one moment the reader is looking at the right place to be
-- offered one.
--
-- The design and the four things that made this larger than a column are in
-- `docs/superpowers/specs/2026-09-20-soft-delete-and-undo-design.md`. The
-- short version of the most important one: the hiding lives in the `select`
-- policies rather than in the queries, because `transactions` is read from 41
-- places in `apps/web` and 37 more in `apps/mobile`, and a filter repeated 78
-- times is a filter that will be forgotten on the 79th.
--
-- Every assertion this is meant to satisfy is in
-- `supabase/tests/036_soft_delete.test.sql`. Run it against a local stack
-- before this goes anywhere near real data — it is the only execution this
-- file can get in this repo.

/* ------------------------------------------------------------- the marks */

alter table transactions add column if not exists deleted_at timestamptz;
alter table categories add column if not exists deleted_at timestamptz;

comment on column transactions.deleted_at is
  'When this was deleted. Null is a live row. The select policy hides the '
  'rest, so no query has to remember to ask.';

comment on column categories.deleted_at is
  'When this was deleted. Null is a live row.';

-- Only the marked rows are indexed, which is what keeps this small: the
-- sweeper is the only reader and a live table is almost entirely nulls.
create index if not exists transactions_deleted_idx
  on transactions (deleted_at)
  where deleted_at is not null;

create index if not exists categories_deleted_idx
  on categories (deleted_at)
  where deleted_at is not null;

/* ----------------------------------------------- the slots a mark holds */

-- A deleted row goes on occupying any unique slot it held, which turns two
-- constraints from correct into obstructive. Both become partial.

-- `unique (user_id, name, type)` from 001, created as a table constraint and
-- so named by Postgres rather than by us. Found by its columns instead of by
-- a guessed name, because a wrong guess drops nothing and reports success.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
   where rel.relname = 'categories'
     and con.contype = 'u'
     and (
       select array_agg(att.attname order by att.attname)
         from unnest(con.conkey) as k(attnum)
         join pg_attribute att
           on att.attrelid = con.conrelid and att.attnum = k.attnum
     ) = array['name', 'type', 'user_id'];

  if constraint_name is not null then
    execute format('alter table categories drop constraint %I', constraint_name);
  end if;
end;
$$;

create unique index if not exists categories_user_name_type_uidx
  on categories (user_id, name, type)
  where deleted_at is null;

-- The recurring slot. Note the name: 001 created
-- `transactions_recurring_month_uidx`, 002 dropped it and created this
-- date-based one in its place. This is the constraint somebody meets straight
-- after deleting a charge by mistake and re-applying the template, so leaving
-- it whole would make the commonest undo the one that could not be done by
-- hand either.
drop index if exists transactions_recurring_date_uidx;

create unique index transactions_recurring_date_uidx
  on transactions (user_id, recurring_template_id, occurred_on)
  where recurring_template_id is not null and deleted_at is null;

/* -------------------------------------------------------- what is visible */

-- The whole mechanism. Both apps stop seeing deleted rows here, in two
-- policies, rather than in 78 query sites.
drop policy if exists "transactions_select_own" on transactions;
create policy "transactions_select_own"
  on transactions for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "categories_select_own" on categories;
create policy "categories_select_own"
  on categories for select
  using (auth.uid() = user_id and deleted_at is null);

-- The update policies are left as they were. Marking a row is an ordinary
-- update of a row you can still see, so nothing special is needed to delete;
-- it is *un*-deleting that needs to reach a row the policy hides, and that
-- goes through the definer functions below.

/* ------------------------------------------------- what a delete broke */

-- Two things follow a transaction into the grave today, by cascade and by
-- set-null, and an update fires neither. Both have to be done by hand, which
-- means both have to be written down or the undo cannot put them back.
--
-- `recurring_fulfilments` says so itself in 023: "a fulfilment whose evidence
-- has been deleted is not a fulfilment: undoing a bank import must put the
-- forecast back rather than leave the occurrence silently accounted for by
-- nothing." It is also read directly rather than through its transaction, so
-- hiding the transaction does not hide it.
--
-- `bank_feed_items.transaction_id` is `on delete set null` for the mirror
-- reason: a feed row whose transaction is gone belongs back in the inbox.
-- Left pointing at a hidden row it is neither matched nor offered.
create table if not exists deletion_undo (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The rows that were marked.
  transaction_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',

  -- (template_id, occurred_on, transaction_id, confirmed_at) per fulfilment
  -- that was removed, and (feed_item_id, transaction_id) per feed row that
  -- was unpointed. Held as jsonb rather than as two more tables because
  -- nothing ever queries into them: they are read once, by token, by the undo.
  fulfilments jsonb not null default '[]'::jsonb,
  feed_items jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists deletion_undo_user_created_idx
  on deletion_undo (user_id, created_at desc);

alter table deletion_undo enable row level security;

-- Select only, as every other tally and log in this schema is. Writes go
-- through the functions below, for the reason 024_month_reads sets out.
drop policy if exists "deletion_undo_select_own" on deletion_undo;
create policy "deletion_undo_select_own"
  on deletion_undo for select
  using (auth.uid() = user_id);

/* ----------------------------------------------------------- the writes */

-- Mark transactions, break what a hard delete would have broken, and hand
-- back the token that puts it all back.
create or replace function soft_delete_transactions(
  target_user uuid,
  ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  undo_token uuid;
  saved_fulfilments jsonb;
  saved_feed_items jsonb;
  marked uuid[];
begin
  if not acting_for(target_user) then
    raise exception 'soft_delete_transactions: not permitted for that user';
  end if;

  -- Only this user's live rows, whatever arrived in `ids`, and only the ones
  -- this call actually marked — a plain re-select afterwards would also sweep
  -- up anything a previous delete had left marked, and hand it to this undo.
  with marked_rows as (
    update transactions
       set deleted_at = now()
     where user_id = target_user
       and id = any(ids)
       and deleted_at is null
    returning id
  )
  select coalesce(array_agg(id), '{}') into marked from marked_rows;

  if marked is null or cardinality(marked) = 0 then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) into saved_fulfilments
    from recurring_fulfilments f
   where f.user_id = target_user and f.transaction_id = any(marked);

  select coalesce(
           jsonb_agg(jsonb_build_object('id', b.id, 'transaction_id', b.transaction_id)),
           '[]'::jsonb)
    into saved_feed_items
    from bank_feed_items b
   where b.user_id = target_user and b.transaction_id = any(marked);

  delete from recurring_fulfilments
   where user_id = target_user and transaction_id = any(marked);

  update bank_feed_items
     set transaction_id = null
   where user_id = target_user and transaction_id = any(marked);

  insert into deletion_undo
    (user_id, transaction_ids, fulfilments, feed_items)
  values
    (target_user, marked, saved_fulfilments, saved_feed_items)
  returning token into undo_token;

  return undo_token;
end;
$$;

-- Unmark transactions and re-assert what the delete broke.
--
-- Takes ids rather than a token as well, so the check script and any future
-- caller can restore without one. The token form is what the Undo button uses.
create or replace function restore_transactions(
  target_user uuid,
  ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  restored integer;
begin
  if not acting_for(target_user) then
    raise exception 'restore_transactions: not permitted for that user';
  end if;

  update transactions
     set deleted_at = null
   where user_id = target_user
     and id = any(ids)
     and deleted_at is not null;

  get diagnostics restored = row_count;
  return restored;
end;
$$;

create or replace function restore_deletion(
  target_user uuid,
  undo_token uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  record_row deletion_undo;
  restored integer := 0;
begin
  if not acting_for(target_user) then
    raise exception 'restore_deletion: not permitted for that user';
  end if;

  select * into record_row
    from deletion_undo
   where token = undo_token and user_id = target_user;

  if not found then
    return 0;
  end if;

  update transactions
     set deleted_at = null
   where user_id = target_user and id = any(record_row.transaction_ids);
  get diagnostics restored = row_count;

  update categories
     set deleted_at = null
   where user_id = target_user and id = any(record_row.category_ids);

  -- Put the fulfilments back. `on conflict do nothing`, because the occurrence
  -- may have been fulfilled by something else in the meantime and the newer
  -- answer is the truer one.
  insert into recurring_fulfilments
    (user_id, template_id, occurred_on, transaction_id, confirmed_at)
  select
    target_user,
    (entry ->> 'template_id')::uuid,
    (entry ->> 'occurred_on')::date,
    (entry ->> 'transaction_id')::uuid,
    (entry ->> 'confirmed_at')::timestamptz
  from jsonb_array_elements(record_row.fulfilments) as entry
  on conflict do nothing;

  -- And re-point the feed rows, unless they have since been matched to
  -- something else.
  update bank_feed_items b
     set transaction_id = (entry ->> 'transaction_id')::uuid
    from jsonb_array_elements(record_row.feed_items) as entry
   where b.id = (entry ->> 'id')::uuid
     and b.user_id = target_user
     and b.transaction_id is null;

  delete from deletion_undo where token = undo_token;

  return restored;
end;
$$;

-- Mark a category, keeping the refusal that `on delete restrict` used to make.
create or replace function soft_delete_category(
  target_user uuid,
  target_category uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  undo_token uuid;
begin
  if not acting_for(target_user) then
    raise exception 'soft_delete_category: not permitted for that user';
  end if;

  if not exists (
    select 1 from categories
     where id = target_category and user_id = target_user
  ) then
    raise exception 'soft_delete_category: % is not a category of that user',
      target_category;
  end if;

  -- The guard that `on delete restrict` used to provide for free. A soft
  -- delete is an update and fires no constraint, so without this a category
  -- could be hidden while live transactions still pointed at it — and the
  -- app's own words for that case ("Archive it instead") would never be said
  -- again.
  if exists (
    select 1 from transactions
     where category_id = target_category and deleted_at is null
    union all
    select 1 from recurring_templates
     where category_id = target_category
  ) then
    raise exception 'soft_delete_category: % is still in use', target_category
      using errcode = 'foreign_key_violation';
  end if;

  update categories
     set deleted_at = now()
   where id = target_category and user_id = target_user and deleted_at is null;

  if not found then
    return null;
  end if;

  insert into deletion_undo (user_id, category_ids)
  values (target_user, array[target_category])
  returning token into undo_token;

  return undo_token;
end;
$$;

/* ----------------------------------------------------------- the sweeper */

-- Hard-delete what has been marked for longer than the caller's window.
--
-- Ordinary deletes, so every cascade and set-null in the schema fires exactly
-- as it does today — the sweep is the delete that was deferred, not a
-- different one. Categories go last: a transaction marked in the same sweep
-- has to be gone before the category it points at can be.
create or replace function sweep_deleted(before timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer := 0;
  n integer;
begin
  delete from deletion_undo where created_at < before;

  delete from transactions where deleted_at is not null and deleted_at < before;
  get diagnostics n = row_count;
  swept := swept + n;

  delete from categories where deleted_at is not null and deleted_at < before;
  get diagnostics n = row_count;
  swept := swept + n;

  return swept;
end;
$$;

/* ------------------------------------------------------------- the grants */

revoke execute on function soft_delete_transactions(uuid, uuid[]) from public, anon;
revoke execute on function restore_transactions(uuid, uuid[]) from public, anon;
revoke execute on function restore_deletion(uuid, uuid) from public, anon;
revoke execute on function soft_delete_category(uuid, uuid) from public, anon;

-- The sweeper is nobody's to call from a browser. Service role only, which is
-- what the cron route authenticates as.
revoke execute on function sweep_deleted(timestamptz) from public, anon, authenticated;

grant execute on function soft_delete_transactions(uuid, uuid[]) to authenticated, service_role;
grant execute on function restore_transactions(uuid, uuid[]) to authenticated, service_role;
grant execute on function restore_deletion(uuid, uuid) to authenticated, service_role;
grant execute on function soft_delete_category(uuid, uuid) to authenticated, service_role;
grant execute on function sweep_deleted(timestamptz) to service_role;
