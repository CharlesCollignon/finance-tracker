-- 081: The demo account — a sample everyone can open, nobody can change
-- (`docs/plans/REFERENCE_APP_PLAN.md`, Phase 10).
--
-- One auth user carries `{"demo": true}` in its app metadata (set by
-- `scripts/seed-demo.mjs`, never by the app). « Essayer la démo » on the
-- site signs a visitor in as that user; the account is shared by every
-- visitor at once, so it is read-only: a trigger on every public table
-- refuses an insert, update or delete made as that user, whatever the row.
-- The nightly reset (`/api/cron/demo`) writes under the service role, for
-- which `auth.uid()` is null, and passes.
--
-- A table added after this migration needs the same trigger: copy the
-- `create trigger` below, or run the block again.
--
-- Reverse:
--   drop function public.refuse_demo_write() cascade;  -- takes the triggers
--   drop function public.is_demo_user(uuid), public.demo_user_id();
--   and restore receipt_folder_is_mine from migration 079.

create or replace function public.is_demo_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (u.raw_app_meta_data ->> 'demo') = 'true'
       from auth.users u
      where u.id = uid),
    false
  );
$$;

revoke all on function public.is_demo_user(uuid) from public;
grant execute on function public.is_demo_user(uuid) to anon, authenticated, service_role;

-- The demo user's id, for the nightly reset: the service role alone.
create or replace function public.demo_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from auth.users u
   where (u.raw_app_meta_data ->> 'demo') = 'true'
   order by u.created_at
   limit 1;
$$;

revoke all on function public.demo_user_id() from public, anon, authenticated;
grant execute on function public.demo_user_id() to service_role;

create or replace function public.refuse_demo_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and public.is_demo_user((select auth.uid())) then
    raise exception 'demo_read_only'
      using errcode = 'P0001',
            hint = 'The demo account is read-only.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.refuse_demo_write() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
  loop
    execute format(
      'drop trigger if exists refuse_demo_write on public.%I',
      t.relname
    );
    execute format(
      'create trigger refuse_demo_write
         before insert or update or delete on public.%I
         for each row execute function public.refuse_demo_write()',
      t.relname
    );
  end loop;
end;
$$;

-- Receipts are files: no trigger reaches storage, so the folder check says
-- no to the demo instead.
create or replace function public.receipt_folder_is_mine(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_demo_user((select auth.uid()))
    and (
      (storage.foldername(object_name))[1] = (select auth.uid())::text
      or (storage.foldername(object_name))[1] in (
        select s::text from public.my_spaces() as s
      )
    );
$$;
